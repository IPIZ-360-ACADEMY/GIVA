-- ============================================================
-- GIVA IPIZ — Notifications v2 + Bookmarks + Polls
-- Execute AFTER supabase-social.sql
-- ============================================================

-- ── 1. user_notifications ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type        TEXT NOT NULL CHECK (type IN (
    'reaction','comment','share','follow','message',
    'announcement','post_approved','company_approved','internship_match'
  )),
  object_type TEXT CHECK (object_type IN ('post','comment','message','profile','internship')),
  object_id   UUID,
  title       TEXT NOT NULL DEFAULT '',
  body        TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notif_user_id    ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notif_user_read  ON public.user_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_notif_created_at ON public.user_notifications(created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own"  ON public.user_notifications;
DROP POLICY IF EXISTS "notif_update_own"  ON public.user_notifications;
DROP POLICY IF EXISTS "notif_insert_any"  ON public.user_notifications;
DROP POLICY IF EXISTS "notif_delete_own"  ON public.user_notifications;

CREATE POLICY "notif_select_own"  ON public.user_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update_own"  ON public.user_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_any"  ON public.user_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_delete_own"  ON public.user_notifications FOR DELETE USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- ── 2. post_bookmarks ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_bookmark UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.post_bookmarks(user_id);
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookmarks_own" ON public.post_bookmarks;
CREATE POLICY "bookmarks_own" ON public.post_bookmarks
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. post_polls + post_poll_votes ──────────────────────────
CREATE TABLE IF NOT EXISTS public.post_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE UNIQUE,
  question   TEXT NOT NULL,
  options    JSONB NOT NULL,  -- ["Opção A", "Opção B", ...]
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES public.post_polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  option_idx INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_poll_vote UNIQUE (poll_id, user_id)
);

ALTER TABLE public.post_polls      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select"     ON public.post_polls;
DROP POLICY IF EXISTS "polls_insert"     ON public.post_polls;
DROP POLICY IF EXISTS "votes_select"     ON public.post_poll_votes;
DROP POLICY IF EXISTS "votes_insert"     ON public.post_poll_votes;
DROP POLICY IF EXISTS "votes_delete_own" ON public.post_poll_votes;

CREATE POLICY "polls_select"     ON public.post_polls      FOR SELECT USING (true);
CREATE POLICY "polls_insert"     ON public.post_polls      FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_select"     ON public.post_poll_votes FOR SELECT USING (true);
CREATE POLICY "votes_insert"     ON public.post_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_delete_own" ON public.post_poll_votes FOR DELETE USING (auth.uid() = user_id);

-- ── 4. Helper para inserir notificações sem falhar ───────────
CREATE OR REPLACE FUNCTION public.insert_notification(
  p_user_id   UUID,
  p_actor_id  UUID,
  p_type      TEXT,
  p_obj_type  TEXT,
  p_obj_id    UUID,
  p_title     TEXT,
  p_body      TEXT  DEFAULT NULL,
  p_data      JSONB DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_notifications
    (user_id, actor_id, type, object_type, object_id, title, body, data)
  VALUES
    (p_user_id, p_actor_id, p_type, p_obj_type, p_obj_id, p_title, p_body, p_data);
EXCEPTION WHEN OTHERS THEN
  NULL; -- Nunca bloquear transação por causa de notificação
END;
$$;

-- ── 5. Trigger: notificar ao reagir a post ───────────────────
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author UUID;
  v_name   TEXT;
  v_emoji  TEXT;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;

  SELECT display_name INTO v_name FROM public.user_profiles WHERE id = NEW.user_id;
  v_emoji := CASE NEW.type
    WHEN 'adoro'    THEN '❤️'
    WHEN 'aplausos' THEN '👏'
    WHEN 'riso'     THEN '😄'
    WHEN 'apoio'    THEN '🤝'
    ELSE '👍'
  END;

  -- remover notif duplicada anterior do mesmo actor no mesmo post
  DELETE FROM public.user_notifications
    WHERE user_id = v_author AND actor_id = NEW.user_id
      AND type = 'reaction' AND object_id = NEW.post_id;

  PERFORM public.insert_notification(
    v_author, NEW.user_id, 'reaction', 'post', NEW.post_id,
    v_name || ' reagiu com ' || v_emoji, NULL,
    jsonb_build_object('reaction_type', NEW.type)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reaction ON public.post_reactions;
CREATE TRIGGER trg_notify_reaction
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ── 6. Trigger: notificar ao comentar ───────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_author   UUID;
  v_parent_author UUID;
  v_name          TEXT;
  v_preview       TEXT;
BEGIN
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = NEW.post_id;
  SELECT display_name INTO v_name FROM public.user_profiles WHERE id = NEW.author_id;
  v_preview := left(NEW.content, 100);

  IF v_post_author IS NOT NULL AND v_post_author != NEW.author_id THEN
    PERFORM public.insert_notification(
      v_post_author, NEW.author_id, 'comment', 'post', NEW.post_id,
      v_name || ' comentou na tua publicação', v_preview
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author
      FROM public.post_comments WHERE id = NEW.parent_id;
    IF v_parent_author IS NOT NULL
      AND v_parent_author != NEW.author_id
      AND v_parent_author != v_post_author THEN
      PERFORM public.insert_notification(
        v_parent_author, NEW.author_id, 'comment', 'comment', NEW.post_id,
        v_name || ' respondeu ao teu comentário', v_preview
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ── 7. Trigger: notificar ao partilhar ──────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_share()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author UUID;
  v_name   TEXT;
BEGIN
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT display_name INTO v_name FROM public.user_profiles WHERE id = NEW.user_id;

  PERFORM public.insert_notification(
    v_author, NEW.user_id, 'share', 'post', NEW.post_id,
    v_name || ' partilhou a tua publicação'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_share ON public.post_shares;
CREATE TRIGGER trg_notify_share
  AFTER INSERT ON public.post_shares
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_share();

-- ── 8. Trigger: notificar ao seguir ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_name TEXT;
BEGIN
  SELECT display_name INTO v_name FROM public.user_profiles WHERE id = NEW.follower_id;
  PERFORM public.insert_notification(
    NEW.following_id, NEW.follower_id, 'follow', 'profile', NEW.follower_id,
    v_name || ' começou a seguir-te'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ── 9. Trigger: post aprovado ────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_post_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.moderation != 'approved' AND NEW.moderation = 'approved' THEN
    PERFORM public.insert_notification(
      NEW.author_id, NULL, 'post_approved', 'post', NEW.id,
      'A tua publicação foi aprovada e está agora visível'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_post_approved ON public.posts;
CREATE TRIGGER trg_notify_post_approved
  AFTER UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_approved();

-- ── 10. Trigger: empresa aprovada ───────────────────────────
CREATE OR REPLACE FUNCTION public.notify_on_company_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 'approved' foi renomeado para 'active' no enum moderation_status
  IF OLD.moderation::text = 'pending' AND NEW.moderation::text = 'active' AND NEW.type::text = 'company' THEN
    PERFORM public.insert_notification(
      NEW.id, NULL, 'company_approved', 'profile', NEW.id,
      'A vossa empresa foi aprovada no GIVA! Bem-vindos à comunidade IPIZ.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_company_approved ON public.user_profiles;
CREATE TRIGGER trg_notify_company_approved
  AFTER UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_company_approved();

-- ── 11. Função vote_on_poll (upsert/change vote) ─────────────
CREATE OR REPLACE FUNCTION public.vote_on_poll(p_poll_id UUID, p_option_idx INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.post_poll_votes (poll_id, user_id, option_idx)
  VALUES (p_poll_id, v_user, p_option_idx)
  ON CONFLICT (poll_id, user_id) DO UPDATE SET option_idx = EXCLUDED.option_idx;
END;
$$;

-- ── 12. Trigger: notificar ao receber mensagem ───────────────
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_name TEXT;
  v_recv        RECORD;
BEGIN
  SELECT display_name INTO v_sender_name
    FROM public.user_profiles WHERE id = NEW.sender_id;

  -- Notificar todos os outros participantes da conversa
  FOR v_recv IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    PERFORM public.insert_notification(
      v_recv.user_id,
      NEW.sender_id,
      'message',
      'message',
      NEW.conversation_id,
      v_sender_name || ' enviou-te uma mensagem',
      left(NEW.content, 100)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();
