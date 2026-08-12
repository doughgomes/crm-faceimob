
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

// ⚠️ IMPORTANTE: o pacote @supabase/supabase-js NÃO expõe um subpath "/cors".
// O import antigo (`npm:@supabase/supabase-js@2/cors`) quebrava o boot da função,
// fazendo com que NENHUMA ação de roster (adicionar/desligar corretor) fosse salva.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const Schema = z.object({
  team_id: z.string().uuid().optional().nullable(),
  slug: z.string().min(1).max(120).optional().nullable(),
  pin: z.string().min(4).max(10).optional().nullable(),
  director_slug: z.string().min(1).max(120).optional().nullable(),
  // Ação opcional de gestão de roster (adicionar/desligar/remover corretor).
  // Requer pin_ok OU director_ok (diretor entra sem PIN nas equipes dos
  // gerentes abaixo dele e tem a MESMA permissão de gestão do gerente).
  action: z
    .enum(["set_active", "add_custom", "remove_custom"])
    .optional()
    .nullable(),
  broker_id: z.string().min(1).max(120).optional().nullable(),
  broker_name: z.string().min(1).max(160).optional().nullable(),
  active: z.boolean().optional().nullable(),
});

function slugify(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^equipe\s+/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function directorSlugMatches(name: string, requested: string) {
  const normalized = slugify(requested);
  if (!normalized) return false;
  const full = slugify(name || "");
  const first = slugify((name || "").split(/\s+/)[0] || "");
  return full === normalized || first === normalized;
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type RosterItem = {
  broker_id: string;
  broker_name: string;
  active: boolean;
  is_custom: boolean;
};

async function buildRoster(
  supabase: ReturnType<typeof createClient>,
  team_id: string,
): Promise<RosterItem[]> {
  const { data: rosterRows, error: rosterErr } = await supabase.rpc(
    "get_team_roster",
    { _team_id: team_id },
  );
  if (rosterErr) throw rosterErr;

  const base = (((rosterRows as any) ?? []) as Array<{
    broker_id: string;
    broker_name: string;
  }>);

  // merge daily_team_roster overrides (inativações + customs)
  const { data: overrides, error: ovErr } = await supabase
    .from("daily_team_roster")
    .select("broker_id, broker_name, active, is_custom")
    .eq("team_id", team_id);
  if (ovErr) throw ovErr;

  const ov = (((overrides as any) ?? []) as Array<{
    broker_id: string;
    broker_name: string;
    active: boolean;
    is_custom: boolean;
  }>);

  const ovMap = new Map(
    ov.filter((o) => !o.is_custom).map((o) => [o.broker_id, o]),
  );

  const merged: RosterItem[] = base.map((b) => {
    const o = ovMap.get(b.broker_id);
    return {
      broker_id: b.broker_id,
      broker_name: o?.broker_name || b.broker_name,
      active: o ? o.active !== false : true,
      is_custom: false,
    };
  });

  ov.filter((o) => o.is_custom).forEach((o) => {
    merged.push({
      broker_id: o.broker_id,
      broker_name: o.broker_name,
      active: o.active !== false,
      is_custom: true,
    });
  });

  merged.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.broker_name.localeCompare(b.broker_name, "pt-BR"),
  );

  return merged;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const parsed = Schema.safeParse(payload);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten() }, 400);
    }

    const {
      team_id: teamIdIn,
      slug,
      pin,
      director_slug,
      action,
      broker_id,
      broker_name,
      active,
    } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ===== Resolve equipe (uuid direto ou slug) =====
    let team_id = teamIdIn ?? null;
    if (!team_id && slug) {
      const wanted = slugify(slug);
      const { data: all } = await supabase
        .from("teams")
        .select("id, name, display_name");
      const match = (all ?? []).find(
        (t: any) =>
          slugify(t.display_name || "") === wanted ||
          slugify(t.name || "") === wanted,
      );
      if (match) team_id = match.id;
    }

    if (!team_id) {
      return json({ error: "Equipe não encontrada" }, 404);
    }

    const { data: infoRows, error: infoErr } = await supabase.rpc(
      "get_team_public_info",
      { _team_id: team_id },
    );
    if (infoErr) throw infoErr;

    const info: any = Array.isArray(infoRows) ? infoRows[0] : infoRows;
    if (!info) {
      return json({ error: "Equipe não encontrada" }, 404);
    }
    info.team_id = team_id;

    const { data: teamRow } = await supabase
      .from("teams")
      .select("display_name, manager_id")
      .eq("id", team_id)
      .maybeSingle();
    if (teamRow?.display_name) info.team_name = teamRow.display_name;

    let pin_ok = false;
    let director_ok = false;

    // ===== Bypass do diretor =====
    // O link do diretor libera acesso SEM PIN às equipes dos gerentes abaixo
    // dele. Essa mesma permissão vale para LER o roster e para SALVAR as
    // alterações (adicionar / desligar corretor).
    if (director_slug) {
      const { data: dirs } = await supabase
        .from("brokers")
        .select("id, name, active, role")
        .eq("role", "director");

      const dir = (dirs || []).find(
        (b: any) =>
          b.active !== false && directorSlugMatches(b.name || "", director_slug),
      );

      if (dir) {
        const { data: mgrs } = await supabase
          .from("brokers")
          .select("id")
          .eq("director_id", dir.id);

        const scopeIds = new Set<string>([
          dir.id,
          ...((mgrs || []).map((m: any) => m.id)),
        ]);

        if (teamRow?.manager_id && scopeIds.has(teamRow.manager_id)) {
          director_ok = true;
        }
      }
    }

    // ===== PIN do gerente =====
    if (pin) {
      const { data: pinRow } = await supabase
        .from("team_pins")
        .select("pin_hash, active")
        .eq("team_id", team_id)
        .maybeSingle();
      if (
        pinRow &&
        pinRow.active &&
        (await sha256(pin)) === pinRow.pin_hash
      ) {
        pin_ok = true;
      }
    }

    const authorized = pin_ok || director_ok;

    // ===== Ação de gestão de roster =====
    // Centraliza a autorização: PIN válido do gerente OU diretor no escopo.
    let action_ok = false;

    if (action) {
      if (!authorized) {
        return json(
          {
            error: "Não autorizado a alterar esta equipe.",
            pin_ok,
            director_ok,
          },
          403,
        );
      }

      if (action === "set_active") {
        if (!broker_id) {
          return json({ error: "broker_id é obrigatório." }, 400);
        }

        const nextActive = active ?? true;

        const { data: existing, error: exErr } = await supabase
          .from("daily_team_roster")
          .select("id, is_custom, broker_name")
          .eq("team_id", team_id)
          .eq("broker_id", broker_id)
          .maybeSingle();
        if (exErr) throw exErr;

        if (existing) {
          const { error: updErr } = await supabase
            .from("daily_team_roster")
            .update({ active: nextActive })
            .eq("id", existing.id);
          if (updErr) throw updErr;
        } else {
          const { data: rosterRows } = await supabase.rpc("get_team_roster", {
            _team_id: team_id,
          });
          const baseBroker = (((rosterRows as any) ?? []) as any[]).find(
            (b: any) => b.broker_id === broker_id,
          );
          const name =
            broker_name?.trim() || baseBroker?.broker_name || "Corretor";

          const { error: insErr } = await supabase
            .from("daily_team_roster")
            .insert({
              team_id,
              broker_id,
              broker_name: name,
              active: nextActive,
              is_custom: false,
            });
          if (insErr) throw insErr;
        }

        action_ok = true;
      } else if (action === "add_custom") {
        const name = broker_name?.trim();
        if (!name) {
          return json({ error: "Nome do corretor é obrigatório." }, 400);
        }

        const newId =
          broker_id?.trim() ||
          `custom:${crypto.randomUUID()}`;

        const { error: insErr } = await supabase
          .from("daily_team_roster")
          .insert({
            team_id,
            broker_id: newId,
            broker_name: name,
            active: active ?? true,
            is_custom: true,
          });
        if (insErr) throw insErr;

        action_ok = true;
      } else if (action === "remove_custom") {
        if (!broker_id) {
          return json({ error: "broker_id é obrigatório." }, 400);
        }

        const { error: delErr } = await supabase
          .from("daily_team_roster")
          .delete()
          .eq("team_id", team_id)
          .eq("broker_id", broker_id)
          .eq("is_custom", true);
        if (delErr) throw delErr;

        action_ok = true;
      }
    }

    // ===== Roster (sempre recalculado DEPOIS da ação) =====
    let roster: RosterItem[] = [];
    if (authorized) {
      roster = await buildRoster(supabase, team_id);
    }

    return json({
      ok: true,
      info,
      team: info,
      team_id,
      roster,
      pin_ok,
      director_ok,
      authorized,
      can_manage: authorized,
      action_ok,
    });
  } catch (e: any) {
    console.error("[daily-team-info] erro:", e?.message || e);
    return json(
      { error: e?.message ?? "Erro inesperado ao processar a solicitação." },
      500,
    );
  }
});
