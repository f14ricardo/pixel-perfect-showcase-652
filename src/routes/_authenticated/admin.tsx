import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Save, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Role = Database["public"]["Enums"]["app_role"];

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Administrador", description: "Importa, edita tudo, gerencia usuários" },
  { value: "coordenacao", label: "Coordenação", description: "Vê todas as salas, lista geral, carômetro, imprime" },
  { value: "professor", label: "Professor", description: "Consulta alunos, notas e frequência" },
  { value: "consulta", label: "Consulta", description: "Visualização básica, sem dados sensíveis" },
];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Usuários — Sistema de Notas CE 113" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/consulta" });
  },
  component: AdminPage,
});

interface UserRow { id: string; nome: string | null; email: string | null; roles: Role[]; }

function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id,nome,email").order("nome"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const rolesByUser = new Map<string, Role[]>();
    for (const r of (roles ?? []) as { user_id: string; role: Role }[]) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    setUsers((profiles ?? []).map((p) => ({
      id: p.id, nome: p.nome, email: p.email, roles: rolesByUser.get(p.id) ?? [],
    })));
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const toggleRole = (userId: string, role: Role) => {
    setUsers((prev) => prev.map((u) =>
      u.id === userId
        ? { ...u, roles: u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role] }
        : u
    ));
  };

  const saveUser = async (user: UserRow) => {
    setSavingId(user.id);
    const { data: current } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const currentRoles = new Set((current ?? []).map((r) => r.role as Role));
    const desired = new Set(user.roles);
    const toAdd = [...desired].filter((r) => !currentRoles.has(r));
    const toRemove = [...currentRoles].filter((r) => !desired.has(r));

    for (const role of toAdd) {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
      if (error) { toast.error(`Erro ao adicionar ${role}`, { description: error.message }); setSavingId(null); return; }
    }
    for (const role of toRemove) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
      if (error) { toast.error(`Erro ao remover ${role}`, { description: error.message }); setSavingId(null); return; }
    }
    toast.success("Permissões atualizadas");
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h1 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5 text-brand" />Gestão de Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atribua perfis aos usuários cadastrados. Novos cadastros recebem automaticamente o perfil <strong>Consulta</strong>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="text-left px-3 py-2">Usuário</th>
                    {ROLES.map((r) => <th key={r.value} className="text-center px-3 py-2" title={r.description}>{r.label}</th>)}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && <tr><td colSpan={ROLES.length + 2} className="text-center py-10 text-muted-foreground">Nenhum usuário cadastrado ainda.</td></tr>}
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">{u.nome || u.email}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {u.roles.length === 0 && <Badge variant="outline" className="text-[10px]">sem perfil</Badge>}
                          {u.roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
                        </div>
                      </td>
                      {ROLES.map((r) => (
                        <td key={r.value} className="px-3 py-2 text-center">
                          <Checkbox checked={u.roles.includes(r.value)} onCheckedChange={() => toggleRole(u.id, r.value)} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" disabled={savingId === u.id} onClick={() => saveUser(u)}>
                          <Save className="h-3.5 w-3.5 mr-1" />{savingId === u.id ? "..." : "Salvar"}
                        </Button>
                      </td>
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
