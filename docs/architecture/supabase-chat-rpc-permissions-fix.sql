-- Fecho de permissões da RPC de chat
REVOKE EXECUTE ON FUNCTION public.create_conversation(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_conversation(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.create_conversation(UUID) TO authenticated;

-- conv_select explicitamente autenticado
DROP POLICY IF EXISTS conv_select ON public.conversations;
CREATE POLICY conv_select
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_participants
      WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
    )
    -- COMMENT ADD --
    
  );
