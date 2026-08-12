
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const Schema = z.object({
  team_id: z.string().uuid().optional().nullable(),
  slug: z.string().min(1).max(120).optional().nullable(),
  pin: z.string().min(4).max(10).optional().nullable(),
  director_slug: z.string().min(1).max(120).optional().nullable(),
  // Ação opcional de gestão de roster (adicionar/desligar corretor).
  // Precisa de pin_ok OU director_ok (diretor entra sem PIN nas equipes
  // dos gerentes abaixo dele, e deve ter a mesma permissão de gestão).
  action: z.enum(["set_active", "add_custom"]).optional().nullable(),
  broker_id: z.string().min(1).max(120).optional().nullable(),
  broker_name: z.string().min(1).max(160).optional().nullable(),
  active: z.boolean().optional().nullable(),
});

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/^equipe\s+/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function directorSlugMatches(name: string, requested: string) {
  const normalized = slugify(requested);
  if (!normalized) return false;
  const full = slugify(name || "");
  const first = slugify((name || "").split(/\s+/)[0] || "");
  return full === normalized || first === normalized;
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildRoster(supabase: ReturnType<typeof createClient>, team_id: string) {
  const { data: rosterRows, error: rosterErr } = await supabase.rpc("get_team_roster", { _team_id: team_id });
  if (rosterErr) throw rosterErr;
  const base = ((rosterRows as any) ?? []) as Array<{ broker_id: string; broker_name: string }>;
  // merge daily_team_roster overrides (inactivations + customs)
  const { data: overrides } = await supabase
    .from("daily_team_roster").select("broker_id, broker_name, active, is_custom").eq("team_id", team_id);
  const ov = ((overrides as any) ?? []) as Array<{ broker_id: string; broker_name: string; active: boolean; is_custom: boolean }>;
  const ovMap = new Map(ov.filter((o) => !o.is_custom).map((o) => [o.broker_id, o]));
  const merged: any[] = base.map((b) => {
    const o = ovMap.get(b.broker_id);
    return { ...b, active: o ? o.active : true, is_custom: false };
  });
  ov.filter((o) => o.is_custom).forEach((o) => {
    merged.push({ broker_id: o.broker_id, broker_name: o.broker_name, active: o.active, is_custom: true });
  });
  merged.sort((a, b) => (Number(b.active !== false) - Number(a.active !== false)) || a.broker_name.localeCompare(b.broker_name));
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { team_id: teamIdIn, slug, pin, director_slug, action, broker_id, broker_name, active } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve team by slug if no uuid provided
    let team_id = teamIdIn ?? null;
    if (!team_id && slug) {
      const { data: all } = await supabase.from("teams").select("id, name, display_name");
      const match = (all ?? []).find((t: any) =>
        slugify(t.display_name || "") === slug || slugify(t.name || "") === slug
      );
      if (match) team_id = match.id;
    }
    if (!team_id) {
      return new Response(JSON.stringify({ error: "Equipe não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: infoRows, error: infoErr } = await supabase.rpc("get_team_public_info", { _team_id: team_id });
    if (infoErr) throw infoErr;
    const info = Array.isArray(infoRows) ? infoRows[0] : null;
    if (!info) {
      return new Response(JSON.stringify({ error: "Equipe não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    (info as any).team_id = team_id;

    const { data: teamRow } = await supabase.from("teams").select("display_name, manager_id").eq("id", team_id).maybeSingle();
    if (teamRow?.display_name) (info as any).team_name = teamRow.display_name;

    let roster: Array<{ broker_id: string; broker_name: string; active?: boolean; is_custom?: boolean }> = [];
    let pin_ok = false;
    let director_ok = false;

    // Director bypass: link do diretor libera acesso sem PIN às equipes dos
    // gerentes abaixo dele (escopo = diretor + gerentes com director_id = diretor).
    // Essa mesma permissão precisa valer tanto para leitura do roster quanto
    // para a ação de adicionar/desligar corretores (não só visualizar).
    if (director_slug) {
      const { data: dirs } = await supabase.from("brokers").select("id, name, active, role").eq("role", "director");
      const dir = (dirs || []).find((b: any) => b.active !== false && directorSlugMatches(b.name || "", director_slug));
      if (dir) {
        const { data: mgrs } = await supabase.from("brokers").select("id").eq("director_id", dir.id);
        const scopeIds = new Set<string>([dir.id, ...((mgrs || []).map((m: any) => m.id))]);
        if (teamRow?.manager_id && scopeIds.has(teamRow.manager_id)) director_ok = true;
      }
    }

    if (pin) {
      const { data: pinRow } = await supabase
        .from("team_pins").select("pin_hash, active").eq("team_id", team_id).maybeSingle();
      if (pinRow && pinRow.active && (await sha256(pin)) === pinRow.pin_hash) {
        pin_ok = true;
      }
    }

    const authorized = pin_ok || director_ok;

    // ===== Ação de gestão de roster (adicionar / desligar corretor) =====
    // Exige a mesma autorização usada para liberar o roster (PIN válido do
    // gerente OU acesso de diretor no escopo dele). Antes, essa ação podia
    // ficar sujeita a checagens divergentes; agora está centralizada aqui.
    if (action) {
      if (!authorized) {
        return new Response(JSON.stringify({ error: "Não autorizado a alterar esta equipe." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "set_active") {
        if (!broker_id) {
          return new Response(JSON.stringify({ error: "broker_id é obrigatório." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { data: existing } = await supabase
          .from("daily_team_roster")
          .select("id, is_custom, broker_name")
          .eq("team_id", team_id)
          .eq("broker_id", broker_id)
          .maybeSingle();

        if (existing) {
          const { error: updErr } = await supabase
            .from("daily_team_roster")
            .update({ active: active ?? true })
            .eq("id", existing.id);
          if (updErr) throw updErr;
        } else {
          const { data: rosterRows } = await supabase.rpc("get_team_roster", { _team_id: team_id });
          const baseBroker = ((rosterRows as any) ?? []).find((b: any) => b.broker_id === broker_id);
          const name = broker_name?.trim() || baseBroker?.broker_name || "Corretor";
          const { error: insErr } = await supabase
            .from("daily_team_roster")
            .insert({ team_id, broker_id, broker_name: name, active: active ?? true, is_custom: false });
          if (insErr) throw insErr;
        }
      } else if (action === "add_custom") {
        if (!broker_name?.trim()) {
          return new Response(JSON.stringify({ error: "Nome do corretor é obrigatório." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const newId = crypto.randomUUID();
        const { error: insErr } = await supabase
          .from("daily_team_roster")
          .insert({ team_id, broker_id: newId, broker_name: broker_name.trim(), active: true, is_custom: true });
        if (insErr) throw insErr;
      }
    }

    if (authorized) {
      roster = await buildRoster(supabase, team_id);
    }

    return new Response(JSON.stringify({ info, roster, pin_ok, director_ok }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-team-info error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
