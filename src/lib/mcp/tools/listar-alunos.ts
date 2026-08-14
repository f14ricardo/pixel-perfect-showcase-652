import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_alunos",
  title: "Listar alunos",
  description:
    "Lista alunos do CE 113, com filtro opcional por sala, status (AT/TR/RE) e busca por nome ou matrícula.",
  inputSchema: {
    sala: z.string().trim().optional().describe("Código da sala, ex.: 9EF-A."),
    status: z.enum(["AT", "TR", "RE"]).optional().describe("Status do aluno."),
    busca: z.string().trim().optional().describe("Trecho do nome ou matrícula."),
    limite: z.number().int().min(1).max(200).default(50).describe("Máximo de alunos retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ sala, status, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("alunos")
      .select("id, nome, sala, matricula, status_aluno")
      .order("nome")
      .limit(limite ?? 50);
    if (sala) query = query.eq("sala", sala);
    if (status) query = query.eq("status_aluno", status);
    if (busca) query = query.or(`nome.ilike.%${busca}%,matricula.ilike.%${busca}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { alunos: data ?? [] },
    };
  },
});
