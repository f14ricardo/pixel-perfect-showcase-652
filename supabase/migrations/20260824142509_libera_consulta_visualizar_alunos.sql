-- Usuários de consulta precisam visualizar a lista de alunos, sem permissão de escrita.
DROP POLICY IF EXISTS "alunos_read_privileged" ON public.alunos;

CREATE POLICY "alunos_read_authorized_roles"
ON public.alunos
FOR SELECT
TO authenticated
USING (
  (SELECT public.has_any_role(
    (SELECT auth.uid()),
    ARRAY['admin', 'coordenacao', 'professor', 'consulta']::public.app_role[]
  ))
);
