-- ============================================================
-- App de Manutenção e Vistorias — Schema Supabase
-- Execute este script no SQL Editor do seu projeto Supabase
-- ============================================================

-- ─── Enums ───────────────────────────────────────────────────
CREATE TYPE public.role AS ENUM ('admin', 'tecnico');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'concluido');

-- ─── Tabela: profiles ────────────────────────────────────────
-- Estende auth.users com dados de perfil de cada usuário.
CREATE TABLE public.profiles (
  id        UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name      TEXT        NOT NULL,
  role      public.role NOT NULL DEFAULT 'tecnico',
  phone     TEXT
);

-- ─── Tabela: projects ────────────────────────────────────────
CREATE TABLE public.projects (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- ─── Tabela: units ───────────────────────────────────────────
CREATE TABLE public.units (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  identifier TEXT NOT NULL
);

-- ─── Tabela: tickets ─────────────────────────────────────────
CREATE TABLE public.tickets (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id        UUID                  NOT NULL REFERENCES public.units (id)    ON DELETE CASCADE,
  tech_id        UUID                  NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  scheduled_date DATE                  NOT NULL,
  description    TEXT                  NOT NULL,
  status         public.ticket_status  NOT NULL DEFAULT 'aberto',
  report         TEXT,
  photo_url      TEXT,
  signature_url  TEXT
);

-- ─── Índices ─────────────────────────────────────────────────
CREATE INDEX idx_tickets_tech_id        ON public.tickets (tech_id);
CREATE INDEX idx_tickets_status         ON public.tickets (status);
CREATE INDEX idx_tickets_scheduled_date ON public.tickets (scheduled_date);
CREATE INDEX idx_units_project_id       ON public.units (project_id);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets   ENABLE ROW LEVEL SECURITY;

-- ── Helper: retorna o role do usuário autenticado ────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── Policies: profiles ──────────────────────────────────────

-- Qualquer usuário autenticado pode ver seu próprio perfil
CREATE POLICY "profiles: leitura própria"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Admin pode ver todos os perfis
CREATE POLICY "profiles: admin lê todos"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Usuário pode atualizar apenas seu próprio perfil
CREATE POLICY "profiles: atualização própria"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Somente admin pode inserir/deletar perfis
CREATE POLICY "profiles: admin insere"
  ON public.profiles FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "profiles: admin deleta"
  ON public.profiles FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ─── Policies: projects ──────────────────────────────────────

-- Todos os autenticados podem ler projetos
CREATE POLICY "projects: autenticados lêem"
  ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Somente admin pode criar, editar e deletar
CREATE POLICY "projects: admin insere"
  ON public.projects FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "projects: admin atualiza"
  ON public.projects FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "projects: admin deleta"
  ON public.projects FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ─── Policies: units ─────────────────────────────────────────

-- Todos os autenticados podem ler unidades
CREATE POLICY "units: autenticados lêem"
  ON public.units FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Somente admin pode criar, editar e deletar
CREATE POLICY "units: admin insere"
  ON public.units FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "units: admin atualiza"
  ON public.units FOR UPDATE
  USING (public.get_my_role() = 'admin');

CREATE POLICY "units: admin deleta"
  ON public.units FOR DELETE
  USING (public.get_my_role() = 'admin');

-- ─── Policies: tickets ───────────────────────────────────────

-- Admin vê todos os tickets
CREATE POLICY "tickets: admin lê todos"
  ON public.tickets FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Técnico vê apenas seus próprios tickets
CREATE POLICY "tickets: tecnico lê os seus"
  ON public.tickets FOR SELECT
  USING (
    public.get_my_role() = 'tecnico'
    AND tech_id = auth.uid()
  );

-- Somente admin pode criar e deletar tickets
CREATE POLICY "tickets: admin insere"
  ON public.tickets FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "tickets: admin deleta"
  ON public.tickets FOR DELETE
  USING (public.get_my_role() = 'admin');

-- Admin pode atualizar qualquer ticket
CREATE POLICY "tickets: admin atualiza"
  ON public.tickets FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- Técnico pode atualizar apenas os seus tickets (para dar baixa)
CREATE POLICY "tickets: tecnico atualiza os seus"
  ON public.tickets FOR UPDATE
  USING (
    public.get_my_role() = 'tecnico'
    AND tech_id = auth.uid()
  )
  WITH CHECK (
    public.get_my_role() = 'tecnico'
    AND tech_id = auth.uid()
  );

-- ============================================================
-- Trigger: cria perfil automaticamente ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.role, 'tecnico')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
//ALTERAÇÃO FEITA\\
-- 1. Remove a relação antiga com a tabela units
ALTER TABLE public.tickets DROP CONSTRAINT tickets_unit_id_fkey;
ALTER TABLE public.tickets DROP COLUMN unit_id;

-- 2. Conecta o ticket direto ao empreendimento (projects)
ALTER TABLE public.tickets ADD COLUMN project_id uuid REFERENCES public.projects(id);

-- 3. Adiciona os novos campos manuais
ALTER TABLE public.tickets ADD COLUMN unidade text;
ALTER TABLE public.tickets ADD COLUMN bloco text;
ALTER TABLE public.tickets ADD COLUMN scheduled_time time;
ALTER TABLE public.tickets ADD COLUMN categoria text;
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'pendente';