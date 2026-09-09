import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  COMPONENTES_LABEL,
  SALAS,
  STATUS_LABEL,
  formatFreq,
  formatNota,
  gradeClass,
  statusBadgeClass,
} from "@/lib/sistema";
import { Download, Printer, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lista")({
  head: () => ({ meta: [{ title: "Lista Geral — Sistema de Notas CE 113" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    sala: typeof s.sala === "string" ? s.sala : "",
    status: typeof s.status === "string" ? s.status : "",
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: ListaPage,
});

const MEDIA_ESCOLAR = 7;
const FREQUENCIA_MINIMA = 75;
const NOTAS_PAGE_SIZE = 1000;
type Etapa = 1 | 2 | 3;

interface NotaEtapas {
  n1: number | null;
  n2: number | null;
  n3: number | null;
}

interface FrequenciaEtapas {
  f1: number | null;
  f2: number | null;
  f3: number | null;
}

interface NotaDb {
  aluno_id: string;
  componente: string;
  nota_etapa_1: number | null;
  nota_etapa_2: number | null;
  nota_etapa_3: number | null;
}

interface FrequenciaDb {
  aluno_id: string;
  freq1: number | null;
  freq2: number | null;
  freq3: number | null;
}

interface Row {
  id: string;
  nome: string;
  sala: string;
  matricula: string | null;
  foto_url: string | null;
  status_aluno: "AT" | "TR" | "RE";
  notas: Record<string, NotaEtapas>;
  frequencia: FrequenciaEtapas;
}

interface ConfigSala {
  sala: string;
  componente: string;
  ordem: number;
}

function notaDaEtapa(row: Row, componente: string, etapa: Etapa): number | null {
  const nota = row.notas[componente];
  if (!nota) return null;
  if (etapa === 1) return nota.n1;
  if (etapa === 2) return nota.n2;
  return nota.n3;
}

function frequenciaDaEtapa(row: Row, etapa: Etapa): number | null {
  if (etapa === 1) return row.frequencia.f1;
  if (etapa === 2) return row.frequencia.f2;
  return row.frequencia.f3;
}

function frequenciaClass(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "bg-muted text-muted-foreground";
  if (value < FREQUENCIA_MINIMA) return "bg-red-100 text-red-800";
  return "bg-emerald-100 text-emerald-900";
}

async function carregarTodasAsFrequencias(): Promise<FrequenciaDb[]> {
  const todas: FrequenciaDb[] = [];
  let inicio = 0;

  while (true) {
    const fim = inicio + NOTAS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("frequencias")
      .select("aluno_id,freq1,freq2,freq3")
      .range(inicio, fim);

    if (error) throw error;

    const pagina = (data ?? []) as FrequenciaDb[];
    todas.push(...pagina);

    if (pagina.length < NOTAS_PAGE_SIZE) break;
    inicio += NOTAS_PAGE_SIZE;
  }

  return todas;
}

async function carregarTodasAsNotas(): Promise<NotaDb[]> {
  const todas: NotaDb[] = [];
  let inicio = 0;

  while (true) {
    const fim = inicio + NOTAS_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("notas")
      .select("aluno_id,componente,nota_etapa_1,nota_etapa_2,nota_etapa_3")
      .range(inicio, fim);

    if (error) throw error;

    const pagina = (data ?? []) as NotaDb[];
    todas.push(...pagina);

    if (pagina.length < NOTAS_PAGE_SIZE) break;
    inicio += NOTAS_PAGE_SIZE;
  }

  return todas;
}

function ListaPage() {
  const search = useSearch({ from: "/_authenticated/lista" });
  const [sala, setSala] = useState(search.sala);
  const [status, setStatus] = useState(search.status);
  const [q, setQ] = useState(search.q);
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [onlyLowFrequency, setOnlyLowFrequency] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [configuracoes, setConfiguracoes] = useState<ConfigSala[]>([]);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setLoading(true);

      try {
        const [a, notas, frequencias, c] = await Promise.all([
          supabase
            .from("alunos")
            .select("id,nome,sala,matricula,foto_url,status_aluno")
            .order("sala")
            .order("nome"),
          carregarTodasAsNotas(),
          carregarTodasAsFrequencias(),
          supabase
            .from("configuracoes_salas")
            .select("sala,componente,ordem")
            .order("ordem"),
        ]);

        if (cancelado) return;
        const notasByAluno = new Map<string, Record<string, NotaEtapas>>();
        for (const r of notas) {
          const notasAluno = notasByAluno.get(r.aluno_id) ?? {};
          notasAluno[r.componente] = {
            n1: r.nota_etapa_1,
            n2: r.nota_etapa_2,
            n3: r.nota_etapa_3,
          };
          notasByAluno.set(r.aluno_id, notasAluno);
        }

        const frequenciasByAluno = new Map<string, FrequenciaEtapas>();
        for (const r of frequencias) {
          frequenciasByAluno.set(r.aluno_id, {
            f1: r.freq1,
            f2: r.freq2,
            f3: r.freq3,
          });
        }

        const lista: Row[] = (a.data ?? []).map((al) => ({
          id: al.id,
          nome: al.nome,
          sala: al.sala,
          matricula: al.matricula,
          foto_url: al.foto_url,
          status_aluno: al.status_aluno as Row["status_aluno"],
          notas: notasByAluno.get(al.id) ?? {},
          frequencia: frequenciasByAluno.get(al.id) ?? { f1: null, f2: null, f3: null },
        }));

        setConfiguracoes((c.data ?? []) as ConfigSala[]);
        setRows(lista);
      } catch (error) {
        console.error("Erro ao carregar a Lista Geral:", error);
        if (!cancelado) {
          setRows([]);
          setConfiguracoes([]);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const componentes = useMemo(() => {
    const ordemPorComponente = new Map<string, number>();
    for (const config of configuracoes) {
      if (sala && config.sala !== sala) continue;
      const ordemAtual = ordemPorComponente.get(config.componente);
      if (ordemAtual === undefined || config.ordem < ordemAtual) {
        ordemPorComponente.set(config.componente, config.ordem);
      }
    }
    return [...ordemPorComponente.entries()]
      .sort(
        ([componenteA, ordemA], [componenteB, ordemB]) =>
          ordemA - ordemB || componenteA.localeCompare(componenteB),
      )
      .map(([componente]) => componente);
  }, [configuracoes, sala]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const temComponenteAbaixoDaMedia = componentes.some((componente) => {
          const nota = notaDaEtapa(r, componente, etapa);
          return nota !== null && !Number.isNaN(nota) && nota < MEDIA_ESCOLAR;
        });
        const frequenciaAtual = frequenciaDaEtapa(r, etapa);
        const frequenciaAbaixoDoMinimo =
          frequenciaAtual !== null && !Number.isNaN(frequenciaAtual) && frequenciaAtual < FREQUENCIA_MINIMA;

        return (
          (!sala || r.sala === sala) &&
          (!status || r.status_aluno === status) &&
          (!q ||
            r.nome.toLowerCase().includes(q.toLowerCase()) ||
            r.matricula?.toLowerCase().includes(q.toLowerCase())) &&
          (!onlyBelow || temComponenteAbaixoDaMedia) &&
          (!onlyLowFrequency || frequenciaAbaixoDoMinimo)
        );
      }),
    [rows, sala, status, q, onlyBelow, onlyLowFrequency, componentes, etapa],
  );

  const exportCsv = () => {
    const headers = ["Aluno", "Matricula", "Sala", "Status", "Etapa", "Frequencia", ...componentes];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const frequenciaAtual = frequenciaDaEtapa(r, etapa);
      lines.push(
        [
          `"${r.nome.replace(/"/g, '""')}"`,
          r.matricula ?? "",
          r.sala,
          r.status_aluno,
          `${etapa}a Etapa`,
          frequenciaAtual?.toFixed(2) ?? "",
          ...componentes.map((componente) => {
            const nota = notaDaEtapa(r, componente, etapa);
            return nota?.toFixed(2) ?? "";
          }),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lista-alunos-${etapa}a-etapa-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_minmax(220px,1fr)_150px_150px_auto_auto_auto] items-end print:hidden">
          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Sala
            </label>
            <Select value={sala || "all"} onValueChange={(v) => setSala(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas as salas</SelectItem>
                {SALAS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Buscar
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou matrícula..."
            />
          </div>

          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status
            </label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="AT">Ativo</SelectItem>
                <SelectItem value="TR">Transferido</SelectItem>
                <SelectItem value="RE">Realocado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Etapa
            </label>
            <Select value={String(etapa)} onValueChange={(v) => setEtapa(Number(v) as Etapa)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1ª Etapa</SelectItem>
                <SelectItem value="2">2ª Etapa</SelectItem>
                <SelectItem value="3">3ª Etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={onlyBelow ? "default" : "outline"}
            onClick={() => setOnlyBelow((v) => !v)}
            className="w-full lg:w-auto whitespace-nowrap"
            title={`Mostrar alunos com pelo menos um componente abaixo de 7,0 na ${etapa}ª etapa`}
          >
            Abaixo da média
          </Button>

          <Button
            variant={onlyLowFrequency ? "default" : "outline"}
            onClick={() => setOnlyLowFrequency((v) => !v)}
            className="w-full lg:w-auto whitespace-nowrap"
            title={`Mostrar alunos com frequência abaixo de ${FREQUENCIA_MINIMA}% na ${etapa}ª etapa`}
          >
            Frequência &lt; 75%
          </Button>

          <div className="grid grid-cols-2 gap-2 lg:flex lg:gap-1">
            <Button variant="outline" onClick={exportCsv} className="w-full lg:w-auto">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="w-full lg:w-auto">
              <Printer className="h-4 w-4 mr-1 lg:mr-0" />
              <span className="lg:hidden">Imprimir</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="p-0">
          <div className="px-3 sm:px-4 py-2 text-xs text-muted-foreground border-b flex flex-wrap gap-2 items-center justify-between">
            <span>{filtered.length} aluno(s)</span>
            <span className="font-medium text-primary">Notas da {etapa}ª Etapa</span>
            {onlyBelow && (
              <span className="font-medium text-amber-700">
                Com pelo menos uma disciplina abaixo de 7,0 na {etapa}ª etapa
              </span>
            )}
            {onlyLowFrequency && (
              <span className="font-medium text-red-700">
                Frequência abaixo de {FREQUENCIA_MINIMA}% na {etapa}ª etapa
              </span>
            )}
            <span className="sm:hidden text-[10px]">Deslize para o lado para ver as notas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 sticky left-0 z-20 bg-muted">Aluno</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Sala</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2 whitespace-nowrap">Frequência</th>
                  {componentes.map((componente) => (
                    <th
                      key={componente}
                      className="text-center px-3 py-2 whitespace-nowrap"
                      title={COMPONENTES_LABEL[componente] ?? componente}
                    >
                      {componente}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={4 + componentes.length}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Carregando notas e frequências...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4 + componentes.length}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((r) => {
                  const frequenciaAtual = frequenciaDaEtapa(r, etapa);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 group">
                      <td className="px-3 py-2 sticky left-0 z-10 bg-card group-hover:bg-muted">
                        <div className="flex items-center gap-2 min-w-[220px]">
                          <div className="h-8 w-8 rounded-full bg-muted overflow-hidden shrink-0">
                            {r.foto_url ? (
                              <img src={r.foto_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <User className="h-full w-full p-1.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[180px]">{r.nome}</div>
                            {r.matricula && (
                              <div className="text-xs text-muted-foreground">{r.matricula}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="whitespace-nowrap min-w-fit">
                          {r.sala}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(r.status_aluno)}`}
                        >
                          {STATUS_LABEL[r.status_aluno]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block min-w-[4rem] px-2 py-1 rounded font-semibold ${frequenciaClass(frequenciaAtual)}`}
                        >
                          {formatFreq(frequenciaAtual)}
                        </span>
                      </td>
                      {componentes.map((componente) => {
                        const nota = notaDaEtapa(r, componente, etapa);
                        return (
                          <td key={componente} className="px-3 py-2 text-center">
                            <span
                              className={`inline-block min-w-[3rem] px-2 py-1 rounded font-semibold ${gradeClass(nota)}`}
                            >
                              {formatNota(nota)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
