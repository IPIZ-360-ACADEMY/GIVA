-- ============================================================
-- GIVA IPIZ — Migração: Read Receipts + Notificações de Mensagem
-- Executar no Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Habilitar Realtime em conversation_participants
--    Para que o frontend receba eventos UPDATE de last_read_at
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'conversation_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  END IF;c
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Trigger: notificar participantes ao receber mensagem
--    Insere uma user_notification para cada destinatário que
--    NÃO está activamente a ver a conversa (last_read_at há
--    mais de 45 segundos, ou NULL).
--    Isto dispara o som e o toast estilo WhatsApp no frontend.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_message_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_name TEXT;
  _body_preview TEXT;
  _recipient RECORD;
BEGIN
  -- Nome do remetente
  SELECT display_name INTO _sender_name
  FROM public.user_profiles
  WHERE id = NEW.sender_id;

  -- Prévia do corpo da mensagem (máx. 120 caracteres)
  _body_preview := left(NEW.content, 120);

  -- Inserir notificação para cada participante excepto o remetente
  -- que não está activamente a ver a conversa
  FOR _recipient IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND (
        cp.last_read_at IS NULL
        OR cp.last_read_at < (now() - INTERVAL '45 seconds')
      )
  LOOP
    INSERT INTO public.user_notifications (
      user_id, actor_id, type, title, body, object_type, object_id
    ) VALUES (
      _recipient.user_id,
      NEW.sender_id,
      'message',
      COALESCE(_sender_name, 'Mensagem nova'),
      _body_preview,
      'message',
      NEW.conversation_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_notify_recipients ON public.messages;
CREATE TRIGGER trg_message_notify_recipients
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_recipients();

-- ────────────────────────────────────────────────────────────
-- 3. Corrigir trigger de criação de perfil OAuth
--    O trigger original só lia full_name/name do metadata.
--    Os alunos passam display_name → fallback era o email
--    (ex: "aluno.ipiz-2026-0001") em vez do nome real.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _display_name TEXT;
  _avatar_url   TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;
  _display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  INSERT INTO public.user_profiles (id, type, display_name, avatar_url)
  VALUES (NEW.id, 'external', _display_name, _avatar_url);
  RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. Corrigir perfis existentes com display_name errado
--    (alunos cujo display_name ficou como "aluno.ipiz-xxxx"
--     por causa do fallback do trigger antigo)
-- ────────────────────────────────────────────────────────────
UPDATE public.user_profiles up
SET display_name = s.full_name
FROM public.student_accounts sa
JOIN public.students s ON s.process_number = sa.process_number
WHERE up.id = sa.id
  AND s.full_name IS NOT NULL
  AND s.full_name <> ''
  AND (
    up.display_name = ''
    OR up.display_name ILIKE 'aluno.%'
    OR up.display_name ILIKE 'ipiz-%'
  );
