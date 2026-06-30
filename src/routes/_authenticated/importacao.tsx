import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/importacao")({
  head: () => ({ meta: [{ title: "Importação — Sistema de Notas CE 113" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!r) throw redirect({ to: "/consulta" });
  },
  component: ImportacaoPage,
});

type Tipo = "alunos" | "frequencias" | "notas";

const TEMPLATES: Record<Tipo, { headers: string[]; example: string[][] }> = {
  alunos: {
    headers: ["matricula","nome","sala","foto_url","sexo","data_nascimento","cpf","email","status_aluno"],
    example: [["2024001","João da Silva","1EM-A","https://...","M","2008-03-15","000.000.000-00","aluno@sesi.org","AT"]],
  },
  frequencias: {
    headers: ["matricula","freq1","freq2","freq3"],
    example: [["2024001","95.5","92.0","88.7"]],
  },
  notas: {
    headers: ["matricula","componente","nota_etapa_1","nota_etapa_2","nota_etapa_3"],
    example: [["2024001","MA","8.5","7.0","9.2"]],
  },
};

function ImportacaoPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <h1 className="text-lg font-semibold">Importação de Dados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie arquivos CSV contendo alunos, frequências ou notas. A primeira linha deve conter os cabeçalhos exatos do modelo.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="alunos">
        <TabsList>
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="frequencias">Frequências</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>
        <TabsContent value="alunos"><ImportPanel tipo="alunos" /></TabsContent>
        <TabsContent value="frequencias"><ImportPanel tipo="frequencias" /></TabsContent>
        <TabsContent value="notas"><ImportPanel tipo="notas" /></TabsContent>
      </Tabs>
    </div>
  );
}

interface RowResult { row: number; ok: boolean; message: string }

function ImportPanel({ tipo }: { tipo: Tipo }) {
  const tpl = TEMPLATES[tipo];
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);

  const downloadTemplate = () => {
    const csv = [tpl.headers.join(","), ...tpl.example.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `modelo-${tipo}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const process = async () => {
    if (!file) return;
    setBusy(true); setResults([]);
    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      toast.error("Erro ao ler CSV", { description: parsed.errors[0].message });
      setBusy(false); return;
    }
    const rows = parsed.data;
    const out: RowResult[] = [];
    // For frequencias/notas we need aluno_id resolution by matricula
    const matriculas = [...new Set(rows.map((r) => r.matricula).filter(Boolean))];
    let matMap = new Map<string, string>();
    if (tipo !== "alunos" && matriculas.length) {
      const { data } = await supabase.from("alunos").select("id,matricula").in("matricula", matriculas);
      matMap = new Map((data ?? []).map((a) => [a.matricula as string, a.id]));
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const lineNum = i + 2;
      try {
        if (tipo === "alunos") {
          if (!r.nome || !r.sala) { out.push({ row: lineNum, ok: false, message: "nome e sala obrigatórios" }); continue; }
          const payload = {
            matricula: r.matricula || null,
            nome: r.nome,
            sala: r.sala,
            foto_url: r.foto_url || null,
            sexo: r.sexo || null,
            data_nascimento: r.data_nascimento || null,
            cpf: r.cpf || null,
            email: r.email || null,
            status_aluno: (r.status_aluno || "AT") as "AT" | "TR" | "RE",
          };
          const { error } = await supabase.from("alunos").upsert(payload, { onConflict: "matricula" });
          if (error) throw error;
          out.push({ row: lineNum, ok: true, message: r.nome });
        } else if (tipo === "frequencias") {
          const aluno_id = matMap.get(r.matricula);
          if (!aluno_id) { out.push({ row: lineNum, ok: false, message: `matrícula ${r.matricula} não encontrada` }); continue; }
          const { error } = await supabase.from("frequencias").upsert({
            aluno_id,
            freq1: r.freq1 ? Number(r.freq1) : null,
            freq2: r.freq2 ? Number(r.freq2) : null,
            freq3: r.freq3 ? Number(r.freq3) : null,
          }, { onConflict: "aluno_id" });
          if (error) throw error;
          out.push({ row: lineNum, ok: true, message: r.matricula });
        } else {
          const aluno_id = matMap.get(r.matricula);
          if (!aluno_id) { out.push({ row: lineNum, ok: false, message: `matrícula ${r.matricula} não encontrada` }); continue; }
          if (!r.componente) { out.push({ row: lineNum, ok: false, message: "componente obrigatório" }); continue; }
          const { data: al } = await supabase.from("alunos").select("sala").eq("id", aluno_id).maybeSingle();
          const { error } = await supabase.from("notas").upsert({
            aluno_id,
            sala: al?.sala ?? "",
            componente: r.componente,
            nota_etapa_1: r.nota_etapa_1 ? Number(r.nota_etapa_1) : null,
            nota_etapa_2: r.nota_etapa_2 ? Number(r.nota_etapa_2) : null,
            nota_etapa_3: r.nota_etapa_3 ? Number(r.nota_etapa_3) : null,
          }, { onConflict: "aluno_id,componente" });
          if (error) throw error;
          out.push({ row: lineNum, ok: true, message: `${r.matricula} · ${r.componente}` });
        }
      } catch (e) {
        out.push({ row: lineNum, ok: false, message: e instanceof Error ? e.message : "erro" });
      }
    }
    setResults(out);
    const okCount = out.filter((x) => x.ok).length;
    toast.success(`Importação concluída`, { description: `${okCount}/${out.length} linhas processadas com sucesso` });
    setBusy(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Arquivo CSV</label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1.5" />Modelo</Button>
          <Button onClick={process} disabled={!file || busy}>
            <Upload className="h-4 w-4 mr-1.5" />{busy ? "Importando..." : "Importar"}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground border rounded p-3 bg-secondary/30">
          <div className="font-semibold mb-1 flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Cabeçalhos esperados:</div>
          <code className="text-xs">{tpl.headers.join(", ")}</code>
        </div>

        {results.length > 0 && (
          <div className="border rounded max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 sticky top-0">
                <tr><th className="text-left px-3 py-1.5 w-16">Linha</th><th className="text-left px-3 py-1.5 w-16">Status</th><th className="text-left px-3 py-1.5">Mensagem</th></tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5">{r.row}</td>
                    <td className="px-3 py-1.5">
                      {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </td>
                    <td className="px-3 py-1.5">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
