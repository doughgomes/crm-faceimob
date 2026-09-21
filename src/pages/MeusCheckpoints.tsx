import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Target, Loader2, ExternalLink, Search, Users } from "lucide-react";

type TeamRow = { id: string; name: string; display_name: string | null; manager_id: string | null };
type BrokerRow = { id: string; name: string; manager_id: string | null; director_id: string | null; user_id: string | null; login_email: string | null; email: string | null; role: string };

const slugify = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/^equipe\s+/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function MeusCheckpoints() {
  const { role, user } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [brokers, setBrokers] = useState<BrokerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [t, b] = await Promise.all([
        supabase.from("teams").select("id,name,display_name,manager_id").order("name"),
        supabase.from("brokers").select("id,name,manager_id,director_id,user_id,login_email,email,role"),
      ]);
      setTeams(((t.data as any) || []) as TeamRow[]);
      setBrokers(((b.data as any) || []) as BrokerRow[]);
      setLoading(false);
    })();
  }, []);

  const myBroker = useMemo(() => {
    const email = (user?.email || "").toLowerCase();
    return (
      brokers.find((b) => b.user_id === user?.id) ||
      brokers.find((b) => (b.login_email || "").toLowerCase() === email && !!email) ||
      brokers.find((b) => (b.email || "").toLowerCase() === email && !!email) ||
      null
    );
  }, [brokers, user]);

  const visibleTeams = useMemo(() => {
    if (role === "admin" || role === "partner") return teams;
    if (role === "director" && myBroker) {
      const mine = brokers.filter((b) => b.director_id === myBroker.id).map((b) => b.id);
      return teams.filter((t) => t.manager_id && (mine.includes(t.manager_id) || t.manager_id === myBroker.id));
    }
    if (myBroker) {
      const own = teams.filter((t) => t.manager_id === myBroker.id);
      if (own.length) return own;
      const mgr = myBroker.manager_id;
      return teams.filter((t) => t.manager_id && t.manager_id === mgr);
    }
    return [];
  }, [role, teams, brokers, myBroker]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return visibleTeams;
    return visibleTeams.filter((t) => `${t.display_name || ""} ${t.name}`.toLowerCase().includes(term));
  }, [visibleTeams, q]);

  const nameFor = (t: TeamRow) => t.display_name?.trim() || t.name || "Equipe";
  const managerFor = (t: TeamRow) => brokers.find((b) => b.id === t.manager_id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Preencher Checkpoint
          </h1>
          <p className="text-[11px] text-muted-foreground">Escolha a equipe e lance os números do dia. Não é necessário PIN.</p>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar equipe" className="h-8 w-56 pl-8 text-xs" />
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma equipe disponível para você ainda.
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <Card key={t.id} className="border-border/50 hover:border-primary/40 transition-colors">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{nameFor(t)}</p>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                    <Users className="h-3 w-3" /> {managerFor(t)}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 px-1">Checkpoint</Badge>
                <Button asChild size="sm" className="h-8">
                  <a href={`/daily/${slugify(t.display_name || t.name)}`}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
