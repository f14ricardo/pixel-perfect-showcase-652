import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarAlunos from "./tools/listar-alunos";
import boletimAluno from "./tools/boletim-aluno";
import registrarNota from "./tools/registrar-nota";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "sistema-notas-sesi",
  title: "Sistema Notas SESI",
  version: "0.1.0",
  instructions:
    "Ferramentas do Sistema de Notas CE 113 (Escola SESI Milton Sobrosa Cordeiro). Use `listar_alunos` para localizar alunos por sala, status ou nome; `boletim_aluno` para notas das 3 etapas, projeção e frequência; `registrar_nota` para lançar ou corrigir uma nota. O acesso segue o perfil do usuário conectado (admin, coordenação, professor ou consulta).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarAlunos, boletimAluno, registrarNota],
});
