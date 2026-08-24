-- O modo Consulta pode visualizar notas, sem permissão para alterá-las.
DROP POLICY IF EXISTS "notas_read_privileged" ON public.notas;
DROP POLICY IF EXISTS "notas_read_authorized_roles" ON public.notas;

CREATE POLICY "notas_read_authorized_roles"
ON public.notas
FOR SELECT
TO authenticated
USING (
  (SELECT public.has_any_role(
    (SELECT auth.uid()),
    ARRAY['admin', 'coordenacao', 'professor', 'consulta']::public.app_role[]
  ))
);
