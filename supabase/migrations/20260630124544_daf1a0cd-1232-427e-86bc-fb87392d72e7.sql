DROP POLICY IF EXISTS "alunos_read_auth" ON public.alunos;
CREATE POLICY "alunos_read_privileged" ON public.alunos FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','coordenacao','professor']::public.app_role[]));

DROP POLICY IF EXISTS "notas_read_auth" ON public.notas;
CREATE POLICY "notas_read_privileged" ON public.notas FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','coordenacao','professor']::public.app_role[]));

DROP POLICY IF EXISTS "frequencias_read_auth" ON public.frequencias;
CREATE POLICY "frequencias_read_privileged" ON public.frequencias FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','coordenacao','professor']::public.app_role[]));