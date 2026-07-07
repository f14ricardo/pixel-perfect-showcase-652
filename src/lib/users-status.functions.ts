import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface UserStatusRow {
  id: string;
  email: string | null;
  nome: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  roles: string[];
  provider: string | null;
}

export const listUsersStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserStatusRow[]> => {
    // Verify caller is admin
    const { data: isAdmin, error: rerr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (rerr) throw new Error(rerr.message);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // List all auth users (paginate up to 1000)
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      allUsers.push(...data.users);
      if (data.users.length < 200) break;
      page++;
      if (page > 20) break;
    }

    const ids = allUsers.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,nome,email").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);
    const profById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const rolesById = new Map<string, string[]>();
    for (const r of (roles ?? []) as any[]) {
      const arr = rolesById.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesById.set(r.user_id, arr);
    }

    return allUsers.map((u) => {
      const p = profById.get(u.id) as any;
      return {
        id: u.id,
        email: u.email ?? p?.email ?? null,
        nome: p?.nome ?? (u.user_metadata?.nome as string) ?? null,
        confirmed: Boolean(u.email_confirmed_at || u.confirmed_at),
        confirmed_at: u.email_confirmed_at ?? u.confirmed_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at ?? null,
        roles: rolesById.get(u.id) ?? [],
        provider: (u.app_metadata?.provider as string) ?? null,
      };
    });
  });
