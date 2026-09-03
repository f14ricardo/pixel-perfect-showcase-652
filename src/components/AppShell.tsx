import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Users, ListChecks, IdCard, Upload, Shield, GraduationCap, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import sesiLogo from "@/assets/sesi-sp.svg.asset.json";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = { to: string; label: string; icon: typeof Users; adminOnly?: boolean };
const nav: NavItem[] = [
  { to: "/consulta", label: "Consulta", icon: Users },
  { to: "/lista", label: "Lista Geral", icon: ListChecks },
  { to: "/carometro", label: "Carômetro", icon: IdCard },
  { to: "/importacao", label: "Importação", icon: Upload, adminOnly: true },
  { to: "/admin", label: "Usuários", icon: Shield, adminOnly: true },
  { to: "/usuarios-status", label: "Status", icon: UserCog, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <header className="bg-header text-header-foreground border-b border-white/10 sticky top-0 z-50 print:static">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="bg-white rounded-md px-2 py-1.5 shrink-0">
              <img src={sesiLogo.url} alt="SESI-SP" className="h-5 sm:h-6 w-auto" />
            </div>
            <div className="min-w-0 sm:hidden">
              <div className="font-semibold text-sm leading-tight truncate flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-brand shrink-0" />
                Notas CE 113
              </div>
              <div className="text-[10px] uppercase tracking-wider text-white/55 truncate">SESI Milton Sobrosa Cordeiro</div>
            </div>
            <div className="min-w-0 hidden sm:block">
              <div className="text-xs uppercase tracking-wider text-white/60 leading-none">Escola SESI Milton Sobrosa Cordeiro</div>
              <div className="font-semibold text-base leading-tight mt-0.5 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-brand" />
                Sistema de Notas CE 113
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-1 text-right">
            <div className="text-xs text-white/60 mr-3">
              <div className="truncate max-w-[180px]">{user?.email}</div>
              <div className="uppercase tracking-wider text-[10px] text-brand/90 font-semibold">
                {roles.length ? roles.join(" · ") : "consulta"}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1.5 hidden lg:inline">Sair</span>
            </Button>
          </div>
        </div>
        <nav className="border-t border-white/10 bg-black/20">
          <div className="mobile-nav max-w-[1400px] mx-auto px-1.5 sm:px-2 flex items-stretch gap-0.5 sm:gap-1 overflow-x-auto overscroll-x-contain">
            {nav.map((item) => {
              if (item.adminOnly && !isAdmin) return null;
              const active = pathname === item.to || (item.to !== "/consulta" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`shrink-0 min-w-[72px] sm:min-w-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-sm whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? "border-brand text-white font-medium bg-white/5"
                      : "border-transparent text-white/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="flex-1 min-w-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              aria-label="Sair"
              className="md:hidden shrink-0 self-center text-white/80 hover:text-white hover:bg-white/10 mx-1 min-h-10 min-w-10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
      <footer className="border-t border-border px-3 py-3 text-center text-[11px] sm:text-xs text-muted-foreground">
        Escola SESI Milton Sobrosa Cordeiro · Sistema de Notas CE 113
      </footer>
    </div>
  );
}
