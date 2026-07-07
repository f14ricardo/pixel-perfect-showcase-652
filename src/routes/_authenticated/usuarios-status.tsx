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
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <UserCog className="h-5 w-5 text-brand" /> Status de Usuários
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Consulte por e-mail o status de ativação da conta e os perfis atribuídos.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span><strong>{totalConfirmed}</strong> ativos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-amber-600" />
                <span><strong>{totalPending}</strong> pendentes</span>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
          <div className="mt-3 relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail ou nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Usuário</th>
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
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <div className="font-medium">{u.nome || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
