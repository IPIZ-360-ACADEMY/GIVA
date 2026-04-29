-- ============================================================
-- GIVA IPIZ — Chat em Tempo Real + Seguidores
-- Executar DEPOIS de supabase-user-profiles.sql
-- ============================================================

-- 1. Seguidores
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);

-- 2. Conversas
CREATE TABLE IF NOT EXISTS public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_conversations_updated ON public.conversations;
CREATE TRIGGER trg_conversations_updated
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Participantes de conversa
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  last_read_at     TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants (user_id);

-- 4. Mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv    ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON public.messages (sender_id);

-- Trigger: atualizar updated_at da conversa ao enviar mensagem
CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_touch_conv ON public.messages;
CREATE TRIGGER trg_message_touch_conv
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- 5. RLS
ALTER TABLE public.follows                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                   ENABLE ROW LEVEL SECURITY;

-- Follows
DROP POLICY IF EXISTS "follows_select"  ON public.follows;
DROP POLICY IF EXISTS "follows_insert"  ON public.follows;
DROP POLICY IF EXISTS "follows_delete"  ON public.follows;

CREATE POLICY "follows_select"  ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert"  ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete"  ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- Conversations: visível apenas para participantes
DROP POLICY IF EXISTS "conv_select"   ON public.conversations;
DROP POLICY IF EXISTS "conv_insert"   ON public.conversations;

CREATE POLICY "conv_select"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "conv_insert"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Participants
DROP POLICY IF EXISTS "cp_select"  ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_insert"  ON public.conversation_participants;
DROP POLICY IF EXISTS "cp_update"  ON public.conversation_participants;

CREATE POLICY "cp_select"
  ON public.conversation_participants FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_id AND cp2.user_id = auth.uid()
    )
  );

CREATE POLICY "cp_insert"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "cp_update"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Messages: visível apenas para participantes da conversa
DROP POLICY IF EXISTS "msg_select"  ON public.messages;
DROP POLICY IF EXISTS "msg_insert"  ON public.messages;
DROP POLICY IF EXISTS "msg_delete"  ON public.messages;

CREATE POLICY "msg_select"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "msg_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "msg_delete"
  ON public.messages FOR DELETE
  USING (sender_id = auth.uid());

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;

-- 7. Função atómica para criar conversa (evita RLS race condition)
CREATE OR REPLACE FUNCTION public.create_conversation(other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user     UUID;
  v_conv_id  UUID;
  v_existing UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_user = other_user_id THEN RAISE EXCEPTION 'Cannot chat with yourself'; END IF;

  SELECT cp1.conversation_id INTO v_existing
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = v_user
    AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO v_conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, v_user), (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$$;
