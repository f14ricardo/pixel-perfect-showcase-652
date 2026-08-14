import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";
import { COMPONENTES_LABEL, projecao } from "@/lib/sistema";

export default defineTool({
  name: "boletim_aluno",
  title: "Boletim do aluno",
  description:
    "Retorna notas das 3 etapas por componente, a projeção (média) e a frequência de um aluno pelo id ou pelo nome.",
  inputSchema: {
    aluno_id: z.string().uuid().optional().describe("ID do aluno."),
    nome: z.string().trim().min(2).optional().describe("Nome (ou parte) do aluno, se o id não for conhecido."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ aluno_id, nome }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (!aluno_id && !nome) {
      return { content: [{ type: "text", text: "Informe aluno_id ou nome." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let alunoQuery = supabase.from("alunos").select("id, nome, sala, matricula, status_aluno").limit(5);
    alunoQuery = aluno_id ? alunoQuery.eq("id", aluno_id) : alunoQuery.ilike("nome", `%${nome}%`);
    const { data: alunos, error: alunoErr } = await alunoQuery;
    if (alunoErr) return { content: [{ type: "text", text: alunoErr.message }], isError: true };
    if (!alunos?.length) return { content: [{ type: "text", text: "Aluno não encontrado." }], isError: true };
    if (alunos.length > 1) {
      return {
        content: [
          {
            type: "text",
            text: `Vários alunos correspondem. Reenvie com aluno_id: ${JSON.stringify(alunos)}`,
          },
        ],
        isError: true,
      };
    }

    const aluno = alunos[0]!;
    const [{ data: notas, error: notasErr }, { data: freq }] = await Promise.all([
      supabase
        .from("notas")
        .select("componente, nota_etapa_1, nota_etapa_2, nota_etapa_3")
        .eq("aluno_id", aluno.id),
      supabase.from("frequencias").select("freq1, freq2, freq3").eq("aluno_id", aluno.id).maybeSingle(),
    ]);
    if (notasErr) return { content: [{ type: "text", text: notasErr.message }], isError: true };

    const boletim = (notas ?? []).map((n) => ({
      componente: n.componente,
      componente_nome: COMPONENTES_LABEL[n.componente] ?? n.componente,
      etapa1: n.nota_etapa_1,
      etapa2: n.nota_etapa_2,
      etapa3: n.nota_etapa_3,
      projecao: projecao(n.nota_etapa_1, n.nota_etapa_2, n.nota_etapa_3),
    }));
    const payload = { aluno, boletim, frequencia: freq ?? null };

    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
