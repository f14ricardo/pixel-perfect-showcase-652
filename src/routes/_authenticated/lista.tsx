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
  formatNota,
  gradeClass,
  projecao,
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

interface Row {
  id: string;
  nome: string;
  sala: string;
  matricula: string | null;
  foto_url: string | null;
  status_aluno: "AT" | "TR" | "RE";
  notas: Record<string, number | null>;
}

interface ConfigSala {
  sala: string;
  componente: string;
  ordem: number;
}

function ListaPage() {
  const search = useSearch({ from: "/_authenticated/lista" });
  const [sala, setSala] = useState(search.sala);
  const [status, setStatus] = useState(search.status);
  const [q, setQ] = useState(search.q);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [configuracoes, setConfiguracoes] = useState<ConfigSala[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from("alunos")
        .select("id,nome,sala,matricula,foto_url,status_aluno")
        .order("sala")
        .order("nome"),
      supabase.from("notas").select("aluno_id,componente,nota_etapa_1,nota_etapa_2,nota_etapa_3"),
      supabase.from("configuracoes_salas").select("sala,componente,ordem").order("ordem"),
    ]).then(([a, n, c]) => {
      const notasByAluno = new Map<string, Record<string, number | null>>();
      for (const r of (n.data ?? []) as {
        aluno_id: string;
        componente: string;
        nota_etapa_1: number | null;
        nota_etapa_2: number | null;
        nota_etapa_3: number | null;
      }[]) {
        const notas = notasByAluno.get(r.aluno_id) ?? {};
        notas[r.componente] = projecao(r.nota_etapa_1, r.nota_etapa_2, r.nota_etapa_3);
        notasByAluno.set(r.aluno_id, notas);
      }
      const rows: Row[] = (a.data ?? []).map((al) => ({
        id: al.id,
        nome: al.nome,
        sala: al.sala,
        matricula: al.matricula,
        foto_url: al.foto_url,
        status_aluno: al.status_aluno as Row["status_aluno"],
        notas: notasByAluno.get(al.id) ?? {},
      }));
      setConfiguracoes((c.data ?? []) as ConfigSala[]);
      setRows(rows);
      setLoading(false);
    });
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
          const nota = r.notas[componente];
          return nota !== null && nota !== undefined && !Number.isNaN(nota) && nota < MEDIA_ESCOLAR;
        });

        return (
          (!sala || r.sala === sala) &&
          (!status || r.status_aluno === status) &&
          (!q ||
            r.nome.toLowerCase().includes(q.toLowerCase()) ||
            r.matricula?.toLowerCase().includes(q.toLowerCase())) &&
          (!onlyBelow || temComponenteAbaixoDaMedia)
        );
      }),
    [rows, sala, status, q, onlyBelow, componentes],
  );

  const exportCsv = () => {
    const headers = ["Aluno", "Matricula", "Sala", "Status", ...componentes];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          `"${r.nome.replace(/"/g, '""')}"`,
          r.matricula ?? "",
          r.sala,
          r.status_aluno,
          ...componentes.map((componente) => r.notas[componente]?.toFixed(2) ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lista-alunos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 grid gap-3 md:grid-cols-[200px_1fr_180px_auto_auto] items-end print:hidden">
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
          <Button
            variant={onlyBelow ? "default" : "outline"}
            onClick={() => setOnlyBelow((v) => !v)}
            className="w-full md:w-auto whitespace-nowrap"
            title="Mostrar alunos com pelo menos um componente curricular abaixo de 7,0"
          >
            Abaixo da média
          </Button>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-1">
            <Button variant="outline" onClick={exportCsv} className="w-full md:w-auto">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="w-full md:w-auto">
              <Printer className="h-4 w-4 mr-1 md:mr-0" />
              <span className="md:hidden">Imprimir</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardContent className="p-0">
          <div className="px-3 sm:px-4 py-2 text-xs text-muted-foreground border-b flex flex-wrap gap-2 items-center justify-between">
            <span>{filtered.length} aluno(s)</span>
            {onlyBelow && (
              <span className="font-medium text-amber-700">Com pelo menos uma disciplina abaixo de 7,0</span>
            )}
            <span className="sm:hidden text-[10px]">Deslize para o lado para ver as notas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 sticky left-0 z-20 bg-muted">Aluno</th>
                  <th className="text-left px-3 py-2 whitespace-nowrap">Sala</th>
                  <th className="text-left px-3 py-2">Status</th>
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
                      colSpan={3 + componentes.length}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={3 + componentes.length}
                      className="text-center py-10 text-muted-foreground"
                    >
                      Nenhum aluno encontrado.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
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
                    {componentes.map((componente) => (
                      <td key={componente} className="px-3 py-2 text-center">
                        <span
                          className={`inline-block min-w-[3rem] px-2 py-1 rounded font-semibold ${gradeClass(r.notas[componente])}`}
                        >
                          {formatNota(r.notas[componente])}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
