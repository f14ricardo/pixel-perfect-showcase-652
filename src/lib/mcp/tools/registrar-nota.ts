import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "registrar_nota",
  title: "Registrar nota",
  description:
    "Cria ou atualiza a nota de uma etapa (1, 2 ou 3) de um componente para um aluno. Requer perfil com permissão de escrita.",
  inputSchema: {
    aluno_id: z.string().uuid().describe("ID do aluno."),
    componente: z.string().trim().min(1).describe("Sigla do componente, ex.: MA, LP, HI."),
    etapa: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe("Etapa da nota."),
    nota: z.number().min(0).max(10).nullable().describe("Nota de 0 a 10, ou null para limpar."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ aluno_id, componente, etapa, nota }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: aluno, error: alunoErr } = await supabase
      .from("alunos")
      .select("id, sala, nome")
      .eq("id", aluno_id)
      .maybeSingle();
    if (alunoErr) return { content: [{ type: "text", text: alunoErr.message }], isError: true };
    if (!aluno) return { content: [{ type: "text", text: "Aluno não encontrado." }], isError: true };

    const patch =
      etapa === 1
        ? { nota_etapa_1: nota }
        : etapa === 2
          ? { nota_etapa_2: nota }
          : { nota_etapa_3: nota };

    const { data: existente } = await supabase
      .from("notas")
      .select("id")
      .eq("aluno_id", aluno_id)
      .eq("componente", componente)
      .maybeSingle();

    const { data, error } = existente
      ? await supabase.from("notas").update(patch).eq("id", existente.id).select().maybeSingle()
      : await supabase
          .from("notas")
          .insert({ aluno_id, componente, sala: aluno.sala, ...patch })
          .select()
          .maybeSingle();


    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { nota: data },
    };
  },
});
