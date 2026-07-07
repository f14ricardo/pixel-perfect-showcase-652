import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { GraduationCap, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import sesiLogo from "@/assets/sesi-sp.svg.asset.json";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Sistema de Notas CE 113" }] }),
  component: AuthPage,
});

type FeedbackKind = "error" | "info" | "success";
interface Feedback {
  kind: FeedbackKind;
  title: string;
  description?: string;
}

function translateAuthError(msg: string): Feedback {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return {
      kind: "error",
      title: "E-mail ou senha incorretos",
      description:
        "Verifique se digitou o e-mail e a senha corretamente. Se ainda não tem conta, use a aba Cadastrar.",
    };
  }
  if (m.includes("email not confirmed") || m.includes("not confirmed")) {
    return {
      kind: "error",
      title: "Conta ainda não ativada",
      description:
        "Sua conta existe mas o e-mail não foi confirmado. Peça a um administrador para ativá-la.",
    };
  }
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already been registered")) {
    return {
      kind: "info",
      title: "E-mail já cadastrado",
      description: "Este e-mail já possui conta. Use a aba Entrar.",
    };
  }
  if (m.includes("password") && (m.includes("pwned") || m.includes("compromised") || m.includes("breach"))) {
    return {
      kind: "error",
      title: "Senha rejeitada por segurança",
      description:
        "Esta senha aparece em vazamentos públicos. Escolha outra senha, com pelo menos 8 caracteres e combinação de letras, números e símbolos.",
    };
  }
  if (m.includes("password") && m.includes("short")) {
    return { kind: "error", title: "Senha muito curta", description: "Use no mínimo 6 caracteres." };
  }
  if (m.includes("rate") && m.includes("limit")) {
    return {
      kind: "error",
      title: "Muitas tentativas",
      description: "Aguarde alguns instantes antes de tentar novamente.",
    };
  }
  if (m.includes("invalid email")) {
    return { kind: "error", title: "E-mail inválido", description: "Verifique o formato do e-mail." };
  }
  return { kind: "error", title: "Não foi possível concluir", description: msg };
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/consulta", replace: true });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setFeedback(translateAuthError(error.message));
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/consulta", replace: true });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { nome } },
    });
    if (error) {
      setLoading(false);
      setFeedback(translateAuthError(error.message));
      return;
    }
    // With auto-confirm on, session is created immediately.
    if (data.session) {
      setLoading(false);
      toast.success("Conta criada");
      navigate({ to: "/consulta", replace: true });
      return;
    }
    // Fallback: try to sign in immediately (auto-confirm should allow it)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInErr) {
      setFeedback({
        kind: "info",
        title: "Cadastro criado",
        description: "Sua conta foi criada, mas o login automático falhou. Use a aba Entrar.",
      });
      setTab("signin");
      return;
    }
    toast.success("Conta criada");
    navigate({ to: "/consulta", replace: true });
  };

  const handleGoogle = async () => {
    setFeedback(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setLoading(false);
      setFeedback({ kind: "error", title: "Falha no Google", description: String(result.error) });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/consulta", replace: true });
  };

  const FeedbackBanner = () =>
    feedback ? (
      <Alert
        variant={feedback.kind === "error" ? "destructive" : "default"}
        className={
          feedback.kind === "success"
            ? "border-emerald-500/50 text-emerald-800 [&>svg]:text-emerald-600"
            : feedback.kind === "info"
              ? "border-blue-500/50 text-blue-800 [&>svg]:text-blue-600"
              : ""
        }
      >
        {feedback.kind === "success" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <AlertTitle>{feedback.title}</AlertTitle>
        {feedback.description && <AlertDescription>{feedback.description}</AlertDescription>}
      </Alert>
    ) : null;

  return (
    <div className="min-h-screen bg-header text-header-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block bg-white rounded-lg px-4 py-3 mb-4">
            <img src={sesiLogo.url} alt="SESI-SP" className="h-8 w-auto" />
          </div>
          <h1 className="text-xl font-semibold flex items-center justify-center gap-2">
            <GraduationCap className="h-5 w-5 text-brand" />
            Sistema de Notas CE 113
          </h1>
          <p className="text-sm text-white/60 mt-1">Escola SESI Milton Sobrosa Cordeiro</p>
        </div>

        <div className="bg-card text-card-foreground rounded-xl p-6 shadow-2xl border border-white/10 space-y-3">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as "signin" | "signup"); setFeedback(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 pt-3">
                <FeedbackBanner />
                <div>
                  <Label htmlFor="email-in">E-mail</Label>
                  <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pwd-in">Senha</Label>
                  <Input id="pwd-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 pt-3">
                <FeedbackBanner />
                <div>
                  <Label htmlFor="nome-up">Nome</Label>
                  <Input id="nome-up" required value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email-up">E-mail</Label>
                  <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pwd-up">Senha</Label>
                  <Input id="pwd-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Novos cadastros são ativados automaticamente e recebem o perfil <strong>Consulta</strong>. Um administrador pode alterar.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={handleGoogle} disabled={loading} className="w-full">
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Google
          </Button>
        </div>
      </div>
    </div>
  );
}
