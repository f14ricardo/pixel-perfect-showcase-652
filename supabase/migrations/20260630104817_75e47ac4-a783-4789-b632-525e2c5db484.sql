
CREATE TYPE public.app_role AS ENUM ('admin', 'coordenacao', 'professor', 'consulta');
CREATE TYPE public.status_aluno AS ENUM ('AT', 'TR', 'RE');

-- USER ROLES first (referenced by has_role and by profiles policy)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "user_roles_view_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consulta');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ALUNOS
CREATE TABLE public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula TEXT UNIQUE,
  nome TEXT NOT NULL,
  sala TEXT NOT NULL,
  foto_url TEXT,
  sexo TEXT,
  data_nascimento DATE,
  cpf TEXT,
  email TEXT,
  status_aluno public.status_aluno NOT NULL DEFAULT 'AT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT ALL ON public.alunos TO service_role;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alunos_read_auth" ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "alunos_admin_insert" ON public.alunos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "alunos_admin_update" ON public.alunos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "alunos_admin_delete" ON public.alunos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- NOTAS
CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  sala TEXT NOT NULL,
  componente TEXT NOT NULL,
  nota_etapa_1 NUMERIC(4,2),
  nota_etapa_2 NUMERIC(4,2),
  nota_etapa_3 NUMERIC(4,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, componente)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas TO authenticated;
GRANT ALL ON public.notas TO service_role;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_read_auth" ON public.notas FOR SELECT TO authenticated USING (true);
CREATE POLICY "notas_admin_write" ON public.notas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- FREQUENCIAS
CREATE TABLE public.frequencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL UNIQUE REFERENCES public.alunos(id) ON DELETE CASCADE,
  freq1 NUMERIC(5,2),
  freq2 NUMERIC(5,2),
  freq3 NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias TO authenticated;
GRANT ALL ON public.frequencias TO service_role;
ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frequencias_read_auth" ON public.frequencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "frequencias_admin_write" ON public.frequencias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CONFIGURACOES SALAS
CREATE TABLE public.configuracoes_salas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sala TEXT NOT NULL,
  componente TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  UNIQUE(sala, componente)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_salas TO authenticated;
GRANT ALL ON public.configuracoes_salas TO service_role;
ALTER TABLE public.configuracoes_salas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cfg_read_auth" ON public.configuracoes_salas FOR SELECT TO authenticated USING (true);
CREATE POLICY "cfg_admin_write" ON public.configuracoes_salas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default grade configuration
INSERT INTO public.configuracoes_salas (sala, componente, ordem)
SELECT s.sala, c.componente, c.ordem
FROM (VALUES ('1EF-A'),('1EF-B'),('2EF-A'),('2EF-B'),('3EF-A'),('3EF-B'),('4EF-A'),('4EF-B'),('5EF-A'),('5EF-B')) AS s(sala)
CROSS JOIN (VALUES ('LP',1),('MA',2),('CN',3),('HI',4),('GE',5),('AR',6),('EF',7),('LI',8)) AS c(componente, ordem);

INSERT INTO public.configuracoes_salas (sala, componente, ordem)
SELECT s.sala, c.componente, c.ordem
FROM (VALUES ('6EF-A'),('6EF-B'),('7EF-A'),('7EF-B'),('8EF-A'),('8EF-B'),('9EF-A'),('9EF-B')) AS s(sala)
CROSS JOIN (VALUES ('LP',1),('MA',2),('CN',3),('HI',4),('GE',5),('AR',6),('EF',7),('LI',8),('PR',9),('STE',10)) AS c(componente, ordem);

INSERT INTO public.configuracoes_salas (sala, componente, ordem)
SELECT s.sala, c.componente, c.ordem
FROM (VALUES ('1EM-A'),('1EM-B'),('2EM-A'),('2EM-B'),('3EM-A'),('3EM-B')) AS s(sala)
CROSS JOIN (VALUES ('LP',1),('MA',2),('BIO',3),('FIS',4),('QUI',5),('HI',6),('GE',7),('SOC',8),('FIL',9),('AR',10),('EF',11),('LI',12),('MTE',13),('TPT',14)) AS c(componente, ordem);
