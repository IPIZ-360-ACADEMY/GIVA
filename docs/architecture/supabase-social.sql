-- ============================================================
-- GIVA IPIZ — Social Feed (Posts, Reactions, Comments, Shares)
-- Auto-suficiente: define handle_updated_at() se ainda não existir
-- ============================================================

-- 0. Função utilitária (criada aqui se supabase-user-profiles.sql ainda não foi executado)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 1. Tipos enum
DO $$ BEGIN
  CREATE TYPE public.reaction_type AS ENUM ('adoro', 'aplausos', 'riso', 'apoio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.post_visibility AS ENUM ('public', 'authenticated', 'followers');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.post_moderation AS ENUM ('approved', 'pending', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Posts
CREATE TABLE IF NOT EXISTS public.posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 3000),
  image_url       TEXT,
  visibility      public.post_visibility NOT NULL DEFAULT 'public',
  moderation      public.post_moderation NOT NULL DEFAULT 'approved',
  is_official     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts de externos começam como 'pending'
CREATE OR REPLACE FUNCTION public.set_post_moderation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT type FROM public.user_profiles WHERE id = NEW.author_id) = 'external' THEN
    NEW.moderation := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_moderation ON public.posts;
CREATE TRIGGER trg_post_moderation
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_moderation();

DROP TRIGGER IF EXISTS trg_posts_updated_at ON public.posts;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Reações (uma por tipo por utilizador por post)
CREATE TABLE IF NOT EXISTS public.post_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type        public.reaction_type NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_reaction_per_user_per_post UNIQUE (post_id, user_id, type)
);

-- 4. Comentários (1 nível de threading via parent_id)
CREATE TABLE IF NOT EXISTS public.post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Partilhas internas
CREATE TABLE IF NOT EXISTS public.post_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_share_per_user UNIQUE (post_id, user_id)
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_moderation ON public.posts (moderation);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON public.post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.post_comments (parent_id);

-- 7. RLS
ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares    ENABLE ROW LEVEL SECURITY;

-- Posts: públicos visíveis a todos; criar/editar/apagar só o autor
DROP POLICY IF EXISTS "posts_select_public"       ON public.posts;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"          ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"          ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"          ON public.posts;

CREATE POLICY "posts_select_public"
  ON public.posts FOR SELECT
  USING (moderation = 'approved');

CREATE POLICY "posts_insert_own"
  ON public.posts FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "posts_update_own"
  ON public.posts FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "posts_delete_own"
  ON public.posts FOR DELETE
  USING (author_id = auth.uid());

-- Reactions
DROP POLICY IF EXISTS "reactions_select"  ON public.post_reactions;
DROP POLICY IF EXISTS "reactions_insert"  ON public.post_reactions;
DROP POLICY IF EXISTS "reactions_delete"  ON public.post_reactions;

CREATE POLICY "reactions_select"
  ON public.post_reactions FOR SELECT USING (true);

CREATE POLICY "reactions_insert"
  ON public.post_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete"
  ON public.post_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Comments
DROP POLICY IF EXISTS "comments_select"  ON public.post_comments;
DROP POLICY IF EXISTS "comments_insert"  ON public.post_comments;
DROP POLICY IF EXISTS "comments_delete"  ON public.post_comments;

CREATE POLICY "comments_select"
  ON public.post_comments FOR SELECT USING (true);

CREATE POLICY "comments_insert"
  ON public.post_comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "comments_delete"
  ON public.post_comments FOR DELETE
  USING (author_id = auth.uid());

-- Shares
DROP POLICY IF EXISTS "shares_select"  ON public.post_shares;
DROP POLICY IF EXISTS "shares_insert"  ON public.post_shares;

CREATE POLICY "shares_select"
  ON public.post_shares FOR SELECT USING (true);

CREATE POLICY "shares_insert"
  ON public.post_shares FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;

-- 9. Storage bucket para imagens de posts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('posts', 'posts', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "posts_images_select" ON storage.objects;
DROP POLICY IF EXISTS "posts_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "posts_images_delete" ON storage.objects;

CREATE POLICY "posts_images_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "posts_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.uid() IS NOT NULL);

CREATE POLICY "posts_images_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posts' AND auth.uid()::TEXT = (storage.foldername(name))[1]);
