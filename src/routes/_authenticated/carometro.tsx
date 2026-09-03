import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SALAS, STATUS_LABEL, statusBadgeClass } from "@/lib/sistema";
import { Printer, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carometro")({
  head: () => ({ meta: [{ title: "Carômetro — Sistema de Notas CE 113" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ sala: typeof s.sala === "string" ? s.sala : "" }),
  component: CarometroPage,
});

interface Aluno { id: string; nome: string; sala: string; matricula: string | null; foto_url: string | null; status_aluno: "AT"|"TR"|"RE"; }

function CarometroPage() {
  const search = useSearch({ from: "/_authenticated/carometro" });
  const [sala, setSala] = useState(search.sala || SALAS[0]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sala) return;
    setLoading(true);
    supabase.from("alunos").select("id,nome,sala,matricula,foto_url,status_aluno")
      .eq("sala", sala).order("nome")
      .then(({ data }) => { setAlunos((data ?? []) as Aluno[]); setLoading(false); });
  }, [sala]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-end print:hidden">
          <div className="w-full sm:min-w-[200px] sm:w-auto">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sala</label>
            <Select value={sala} onValueChange={setSala}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {SALAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden sm:block flex-1" />
          <Button variant="outline" onClick={() => window.print()} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground print:block hidden">
        Sala {sala} — {alunos.length} alunos
      </div>

      {loading && <div className="text-center py-10 text-muted-foreground">Carregando...</div>}
      {!loading && alunos.length === 0 && (
        <Card><CardContent className="p-6 sm:p-10 text-center text-muted-foreground">Nenhum aluno cadastrado em {sala}.</CardContent></Card>
      )}

      <div className="grid gap-3 grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 print:grid-cols-4">
        {alunos.map((a) => (
          <div key={a.id} className="bg-card border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow print:shadow-none print:break-inside-avoid">
            <div className="aspect-[4/3] min-[380px]:aspect-[3/4] bg-muted relative">
              {a.foto_url ? (
                <img src={a.foto_url} alt={a.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <User className="h-16 w-16 opacity-20" />
                </div>
              )}
              <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadgeClass(a.status_aluno)}`}>
                {STATUS_LABEL[a.status_aluno]}
              </span>
            </div>
            <div className="p-2.5 sm:p-2 text-center">
              <div className="text-xs font-semibold leading-tight line-clamp-2 min-h-[2.25rem]">{a.nome}</div>
              <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{a.sala}</div>
              {a.matricula && <div className="text-[10px] text-muted-foreground">Mat. {a.matricula}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
