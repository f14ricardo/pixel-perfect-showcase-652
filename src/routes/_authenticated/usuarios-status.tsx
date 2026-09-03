import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Search, UserCog, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listUsersStatus, type UserStatusRow } from "@/lib/users-status.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/usuarios-status")({
  head: () => ({ meta: [{ title: "Status de Usuários — Sistema de Notas CE 113" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!r) throw redirect({ to: "/consulta" });
  },
  component: UsersStatusPage,
});

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}

function UsersStatusPage() {
  const [rows, setRows] = useState<UserStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const fetchStatus = useServerFn(listUsersStatus);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchStatus();
      setRows(data);
    } catch (e: any) {
      toast.error("Falha ao carregar", { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        (r.email ?? "").toLowerCase().includes(term) ||
        (r.nome ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  const totalConfirmed = rows.filter((r) => r.confirmed).length;
  const totalPending = rows.length - totalConfirmed;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <UserCog className="h-5 w-5 text-brand shrink-0" /> Status de Usuários
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Consulte por e-mail o status de ativação da conta e os perfis atribuídos.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 text-xs w-full sm:w-auto">
              <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 sm:border-0 sm:p-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span><strong>{totalConfirmed}</strong> ativos</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-2 sm:border-0 sm:p-0">
                <XCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span><strong>{totalPending}</strong> pendentes</span>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={loading} className="col-span-2 sm:col-span-1 w-full sm:w-auto">
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
          <div className="mt-3 relative w-full sm:max-w-md">
            <Search className="absolute left-2.5 top-3.5 sm:top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail ou nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="sm:hidden px-3 py-2 text-[11px] text-muted-foreground border-b bg-muted/20">
                Deslize para o lado para visualizar todos os dados do usuário.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 sticky left-0 z-20 bg-muted">Usuário</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-left px-3 py-2">Perfis</th>
                      <th className="text-left px-3 py-2">Provedor</th>
                      <th className="text-left px-3 py-2">Último login</th>
                      <th className="text-left px-3 py-2">Criado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    )}
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 group">
                        <td className="px-3 py-2 sticky left-0 z-10 bg-card group-hover:bg-muted">
                          <div className="min-w-[220px]">
                            <div className="font-medium truncate max-w-[210px]">{u.nome || u.email}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[210px]">{u.email}</div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {u.confirmed ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">
                              <XCircle className="h-3 w-3 mr-1" /> Pendente
                            </Badge>
                          )}
                          {u.confirmed_at && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              desde {fmt(u.confirmed_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 && (
                              <Badge variant="outline" className="text-[10px]">sem perfil</Badge>
                            )}
                            {u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs">{u.provider ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{fmt(u.last_sign_in_at)}</td>
                        <td className="px-3 py-2 text-xs">{fmt(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
