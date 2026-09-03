import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SALAS, COMPONENTES_LABEL, STATUS_LABEL, projecao,
  gradeClass, statusBadgeClass, formatNota, formatFreq, type Etapa,
} from "@/lib/sistema";
import { Printer, RefreshCw, Map as MapIcon, IdCard, ArrowRight, User } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/consulta")({
  head: () => ({ meta: [{ title: "Consulta Individual — Sistema de Notas CE 113" }] }),
  component: ConsultaPage,
});

interface Aluno {
  id: string;
  nome: string;
  sala: string;
  matricula: string | null;
  foto_url: string | null;
  status_aluno: "AT" | "TR" | "RE";
}
interface Nota { componente: string; nota_etapa_1: number | null; nota_etapa_2: number | null; nota_etapa_3: number | null; }
interface Frequencia { freq1: number | null; freq2: number | null; freq3: number | null; }
interface ConfigSala { componente: string; ordem: number; }

function ConsultaPage() {
  const navigate = useNavigate();
  const [sala, setSala] = useState<string>("");
  const [alunoId, setAlunoId] = useState<string>("");
  const [etapa, setEtapa] = useState<Etapa>(1);

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [freq, setFreq] = useState<Frequencia | null>(null);
  const [config, setConfig] = useState<ConfigSala[]>([]);
  const [loadingAlunos, setLoadingAlunos] = useState(false);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  useEffect(() => {
    if (!sala) { setAlunos([]); setAlunoId(""); return; }
    setLoadingAlunos(true);
    Promise.all([
      supabase.from("alunos").select("id,nome,sala,matricula,foto_url,status_aluno").eq("sala", sala).order("nome"),
      supabase.from("configuracoes_salas").select("componente,ordem").eq("sala", sala).order("ordem"),
    ]).then(([a, c]) => {
      setAlunos((a.data ?? []) as Aluno[]);
      setConfig((c.data ?? []) as ConfigSala[]);
      setAlunoId("");
      setAluno(null);
      setLoadingAlunos(false);
    });
  }, [sala]);

  useEffect(() => {
    if (!alunoId) { setAluno(null); setNotas([]); setFreq(null); return; }
    const a = alunos.find((x) => x.id === alunoId) ?? null;
    setAluno(a);
    setLoadingDetalhe(true);
    Promise.all([
      supabase.from("notas").select("componente,nota_etapa_1,nota_etapa_2,nota_etapa_3").eq("aluno_id", alunoId),
      supabase.from("frequencias").select("freq1,freq2,freq3").eq("aluno_id", alunoId).maybeSingle(),
    ]).then(([n, f]) => {
      setNotas((n.data ?? []) as Nota[]);
      setFreq((f.data ?? null) as Frequencia | null);
      setLoadingDetalhe(false);
    });
  }, [alunoId, alunos]);

  const rows = useMemo(() => {
    const byComp = new Map(notas.map((n) => [n.componente, n] as const));
    return config.map((c, idx) => {
      const n = byComp.get(c.componente);
      const n1 = n?.nota_etapa_1 ?? null;
      const n2 = n?.nota_etapa_2 ?? null;
      const n3 = n?.nota_etapa_3 ?? null;
      return { idx: idx + 1, componente: c.componente, n1, n2, n3, proj: projecao(n1, n2, n3) };
    });
  }, [config, notas]);

  const freqAtual = etapa === 1 ? freq?.freq1 : etapa === 2 ? freq?.freq2 : freq?.freq3;

  const refresh = () => {
    setAlunoId((id) => { setTimeout(() => setAlunoId(id), 0); return ""; });
  };

  return (
    <div className="space-y-3 sm:space-y-4 print:space-y-2">
      <Card>
        <CardContent className="p-3 sm:p-4 grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto] items-end print:hidden">
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sala</label>
            <Select value={sala} onValueChange={setSala}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a sala" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {SALAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Aluno</label>
            <Select value={alunoId} onValueChange={setAlunoId} disabled={!sala || loadingAlunos}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={!sala ? "Selecione a sala primeiro" : loadingAlunos ? "Carregando..." : alunos.length ? "Selecione o aluno" : "Nenhum aluno nesta sala"} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {alunos.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Etapa atual</label>
            <Select value={String(etapa)} onValueChange={(v) => setEtapa(Number(v) as Etapa)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1ª Etapa</SelectItem>
                <SelectItem value="2">2ª Etapa</SelectItem>
                <SelectItem value="3">3ª Etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={refresh} disabled={!alunoId} className="w-full md:w-auto">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar
          </Button>
        </CardContent>
      </Card>

      {!aluno && (
        <Card>
          <CardContent className="p-6 sm:p-10 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm sm:text-base">Selecione uma sala e um aluno para visualizar a ficha individual.</p>
          </CardContent>
        </Card>
      )}

      {aluno && (
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="overflow-hidden">
            <div className="aspect-[4/3] sm:aspect-[3/4] bg-muted relative">
              {aluno.foto_url ? (
                <img src={aluno.foto_url} alt={aluno.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <User className="h-20 w-20 opacity-20" />
                </div>
              )}
            </div>
            <CardContent className="p-3 sm:p-4 space-y-2">
              <h2 className="font-semibold text-base leading-tight">{aluno.nome}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{aluno.sala}</Badge>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(aluno.status_aluno)}`}>
                  {STATUS_LABEL[aluno.status_aluno]}
                </span>
              </div>
              {aluno.matricula && <div className="text-xs text-muted-foreground">Matrícula: {aluno.matricula}</div>}
              <div className="border-t pt-3 mt-2">
                <div className="text-xs uppercase text-muted-foreground tracking-wider">Frequência ({etapa}ª etapa)</div>
                <div className="text-2xl font-bold text-primary mt-1">{formatFreq(freqAtual)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  1ª {formatFreq(freq?.freq1)} · 2ª {formatFreq(freq?.freq2)} · 3ª {formatFreq(freq?.freq3)}
                </div>
              </div>
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 print:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ to: "/lista", search: { sala: aluno.sala } as never })}
                >
                  <MapIcon className="h-3.5 w-3.5 mr-1" />Mapeamento
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/carometro" search={{ sala: aluno.sala } as never}>
                    <IdCard className="h-3.5 w-3.5 mr-1" />Carômetro
                  </Link>
                </Button>
                <Button variant="default" size="sm" className="sm:col-span-2" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5 mr-1" />Imprimir ficha
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardContent className="p-0">
              <div className="px-3 sm:px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 bg-secondary/40">
                <h3 className="font-semibold text-sm sm:text-base">Notas por componente</h3>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Etapa atual:</span>
                  <span className="font-semibold text-primary flex items-center gap-1">
                    {etapa}ª <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
              {loadingDetalhe ? (
                <div className="p-4 space-y-2">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="sm:hidden px-3 py-2 text-[11px] text-muted-foreground border-b bg-muted/20">
                    Deslize a tabela para o lado para visualizar todas as etapas.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-3 py-2 w-10">Nº</th>
                          <th className="text-left px-3 py-2">Componente</th>
                          <EtapaTh n={1} active={etapa === 1} />
                          <EtapaTh n={2} active={etapa === 2} />
                          <EtapaTh n={3} active={etapa === 3} />
                          <th className="text-center px-3 py-2 font-semibold">Projeção</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">
                            Sem componentes configurados para esta sala.
                          </td></tr>
                        )}
                        {rows.map((r) => (
                          <tr key={r.componente} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{r.idx}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.componente}</div>
                              <div className="text-xs text-muted-foreground">{COMPONENTES_LABEL[r.componente] ?? r.componente}</div>
                            </td>
                            <NotaTd value={r.n1} active={etapa === 1} />
                            <NotaTd value={r.n2} active={etapa === 2} />
                            <NotaTd value={r.n3} active={etapa === 3} />
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block px-2 py-1 rounded font-semibold ${gradeClass(r.proj)}`}>
                                {formatNota(r.proj)}
                              </span>
                            </td>
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
      )}
    </div>
  );
}

function EtapaTh({ n, active }: { n: number; active: boolean }) {
  return (
    <th className={`text-center px-3 py-2 ${active ? "bg-primary/10 text-primary font-bold border-x-2 border-primary/30" : ""}`}>
      {active ? <>▼<br /></> : null}{n}ª Etapa
    </th>
  );
}

function NotaTd({ value, active }: { value: number | null; active: boolean }) {
  return (
    <td className={`px-3 py-2 text-center ${active ? "bg-primary/5 border-x-2 border-primary/30" : ""}`}>
      <span className={`inline-block min-w-[3rem] px-2 py-1 rounded font-medium ${gradeClass(value)}`}>
        {formatNota(value)}
      </span>
    </td>
  );
}
