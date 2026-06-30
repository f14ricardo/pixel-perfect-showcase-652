import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SALAS, STATUS_LABEL, formatFreq, formatNota, gradeClass, projecao, statusBadgeClass } from "@/lib/sistema";
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

interface Row {
  id: string; nome: string; sala: string; matricula: string | null; foto_url: string | null;
  status_aluno: "AT" | "TR" | "RE";
  freq1: number | null; freq2: number | null; freq3: number | null;
  proj: number | null;
  abaixo_media: boolean;
}

function ListaPage() {
  const search = useSearch({ from: "/_authenticated/lista" });
  const [sala, setSala] = useState(search.sala);
  const [status, setStatus] = useState(search.status);
  const [q, setQ] = useState(search.q);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("alunos").select("id,nome,sala,matricula,foto_url,status_aluno").order("sala").order("nome"),
      supabase.from("frequencias").select("aluno_id,freq1,freq2,freq3"),
      supabase.from("notas").select("aluno_id,nota_etapa_1,nota_etapa_2,nota_etapa_3"),
    ]).then(([a, f, n]) => {
      const freqMap = new Map((f.data ?? []).map((x: { aluno_id: string; freq1: number | null; freq2: number | null; freq3: number | null }) => [x.aluno_id, x]));
      const notasByAluno = new Map<string, { n1: number | null; n2: number | null; n3: number | null }[]>();
      for (const r of (n.data ?? []) as { aluno_id: string; nota_etapa_1: number | null; nota_etapa_2: number | null; nota_etapa_3: number | null }[]) {
        const arr = notasByAluno.get(r.aluno_id) ?? [];
        arr.push({ n1: r.nota_etapa_1, n2: r.nota_etapa_2, n3: r.nota_etapa_3 });
        notasByAluno.set(r.aluno_id, arr);
      }
      const rows: Row[] = (a.data ?? []).map((al) => {
        const fr = freqMap.get(al.id);
        const ns = notasByAluno.get(al.id) ?? [];
        const projs = ns.map((x) => projecao(x.n1, x.n2, x.n3)).filter((v): v is number => v !== null);
        const proj = projs.length ? projs.reduce((s, v) => s + v, 0) / projs.length : null;
        const abaixo = projs.some((v) => v < 5);
        return {
          id: al.id, nome: al.nome, sala: al.sala, matricula: al.matricula,
          foto_url: al.foto_url, status_aluno: al.status_aluno as Row["status_aluno"],
          freq1: fr?.freq1 ?? null, freq2: fr?.freq2 ?? null, freq3: fr?.freq3 ?? null,
          proj, abaixo_media: abaixo,
        };
      });
      setRows(rows);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (!sala || r.sala === sala) &&
    (!status || r.status_aluno === status) &&
    (!q || r.nome.toLowerCase().includes(q.toLowerCase()) || r.matricula?.toLowerCase().includes(q.toLowerCase())) &&
    (!onlyBelow || r.abaixo_media)
  ), [rows, sala, status, q, onlyBelow]);

  const exportCsv = () => {
    const headers = ["Sala", "Matricula", "Nome", "Status", "Freq1", "Freq2", "Freq3", "Projecao_Media"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        r.sala, r.matricula ?? "", `"${r.nome.replace(/"/g, '""')}"`, r.status_aluno,
        r.freq1 ?? "", r.freq2 ?? "", r.freq3 ?? "", r.proj?.toFixed(2) ?? "",
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `lista-alunos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-[200px_1fr_180px_auto_auto] items-end print:hidden">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sala</label>
            <Select value={sala || "all"} onValueChange={(v) => setSala(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas as salas</SelectItem>
                {SALAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buscar</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou matrícula..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="AT">Ativo</SelectItem>
                <SelectItem value="TR">Transferido</SelectItem>
                <SelectItem value="RE">Realocado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant={onlyBelow ? "default" : "outline"} onClick={() => setOnlyBelow((v) => !v)}>
            Abaixo da média
          </Button>
          <div className="flex gap-1">
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 text-xs text-muted-foreground border-b flex items-center justify-between">
            <span>{filtered.length} aluno(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2">Aluno</th>
                  <th className="text-left px-3 py-2">Sala</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-center px-3 py-2">Freq. 1</th>
                  <th className="text-center px-3 py-2">Freq. 2</th>
                  <th className="text-center px-3 py-2">Freq. 3</th>
                  <th className="text-center px-3 py-2">Projeção média</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum aluno encontrado.</td></tr>}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden shrink-0">
                          {r.foto_url ? <img src={r.foto_url} className="w-full h-full object-cover" alt="" /> : <User className="h-full w-full p-1.5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.nome}</div>
                          {r.matricula && <div className="text-xs text-muted-foreground">{r.matricula}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><Badge variant="outline">{r.sala}</Badge></td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(r.status_aluno)}`}>{STATUS_LABEL[r.status_aluno]}</span></td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{formatFreq(r.freq1)}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{formatFreq(r.freq2)}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{formatFreq(r.freq3)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded font-semibold ${gradeClass(r.proj)}`}>{formatNota(r.proj)}</span>
                    </td>
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
