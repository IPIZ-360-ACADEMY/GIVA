-- ============================================================
-- GIVA IPIZ — Chat Reliability + Security Hardening
-- ============================================================

-- 1) Garantir realtime nas tabelas críticas (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

-- 2) Harden das policies para escopo authenticated explícito
DROP POLICY IF EXISTS conv_insert ON public.conversations;
CREATE POLICY conv_insert
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS cp_insert ON public.conversation_participants;
CREATE POLICY cp_insert
  ON public.conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS cp_select ON public.conversation_participants;
CREATE POLICY cp_select
  ON public.conversation_participants
  FOR SELECT
  TO authenticated
  USING (is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS cp_update ON public.conversation_participants;
CREATE POLICY cp_update
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS msg_select ON public.messages;
CREATE POLICY msg_select
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS msg_delete ON public.messages;
CREATE POLICY msg_delete
  ON public.messages
  FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- 3) create_conversation com lock transacional para evitar duplicatas concorrentes
CREATE OR REPLACE FUNCTION public.create_conversation(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user UUID;
  v_conv_id UUID;
  v_existing UUID;
  v_low TEXT;
  v_high TEXT;
BEGIN
  v_user := auth.uid();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Other user is required';
  END IF;

  IF v_user = other_user_id THEN
    RAISE EXCEPTION 'Cannot chat with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = other_user_id) THEN
    RAISE EXCEPTION 'Other user not found';
  END IF;

  v_low := LEAST(v_user::text, other_user_id::text);
  v_high := GREATEST(v_user::text, other_user_id::text);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_low || ':' || v_high, 0));

  INSERT INTO public.user_profiles (id, type, display_name)
  SELECT u.id,
         'external',
         COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Utilizador')
  FROM auth.users u
  WHERE u.id IN (v_user, other_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id)
  ON CONFLICT (id) DO NOTHING;

  SELECT cp1.conversation_id INTO v_existing
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = v_user
    AND cp2.user_id = other_user_id
  ORDER BY cp1.conversation_id
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

-- 4) Permissões explícitas da RPC
REVOKE ALL ON FUNCTION public.create_conversation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_conversation(UUID) TO authenticated;
