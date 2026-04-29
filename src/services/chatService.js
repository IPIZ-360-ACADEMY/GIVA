import { supabase } from "../lib/supabase.js";

/**
 * Lista conversas do utilizador autenticado, ordenadas pela mais recente.
 * Usa 3 queries simples para evitar problemas com self-joins no PostgREST.
 */
export async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Participações do utilizador actual
  const { data: myParts, error: e1 } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  if (e1) throw e1;
  if (!myParts?.length) return [];

  const convIds = myParts.map((p) => p.conversation_id);

  // 2. Metadados das conversas (updated_at para ordenação)
  const { data: convRows, error: e2 } = await supabase
    .from("conversations")
    .select("id, updated_at")
    .in("id", convIds);

  if (e2) throw e2;

  // 3. Outros participantes com o seu perfil
  const { data: otherParts, error: e3 } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id, profile:user_profiles!user_id (id, display_name, avatar_url, type)")
    .in("conversation_id", convIds)
    .neq("user_id", user.id);

  if (e3) throw e3;

  // Construir mapa de metadados e de participantes
  const convMap = Object.fromEntries((convRows ?? []).map((c) => [c.id, c]));
  const partMap = {};
  for (const p of otherParts ?? []) {
    if (!partMap[p.conversation_id]) partMap[p.conversation_id] = [];
    partMap[p.conversation_id].push({ user_id: p.user_id, profile: p.profile });
  }

  const result = myParts.map((p) => ({
    conversation_id: p.conversation_id,
    last_read_at: p.last_read_at,
    conversation: convMap[p.conversation_id] ?? null,
    other_participants: partMap[p.conversation_id] ?? [],
  }));

  return result.sort((a, b) => {
    const dateA = new Date(a.conversation?.updated_at ?? 0).getTime();
    const dateB = new Date(b.conversation?.updated_at ?? 0).getTime();
    return dateB - dateA;
  });
}

/**
 * Encontra ou cria uma conversa 1-a-1 com outro utilizador.
 */
export async function getOrCreateConversation(otherUserId) {
  const { data, error } = await supabase.rpc("create_conversation", {
    other_user_id: otherUserId,
  });
  if (error) throw error;
  return data;
}

/**
 * Lista mensagens de uma conversa.
 */
export async function getMessages(conversationId, limit = 50) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, content, created_at, sender:user_profiles!sender_id (id, display_name, avatar_url)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).reverse();
}

/**
 * Envia uma mensagem numa conversa.
 */
export async function sendMessage(conversationId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, content })
    .select("id, content, created_at, sender:user_profiles!sender_id (id, display_name, avatar_url)")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marca a conversa como lida (atualiza last_read_at).
 */
export async function markAsRead(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) throw error;
}

/**
 * Conta mensagens não lidas em todas as conversas.
 */
export async function getUnreadCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  if (error || !data) return 0;

  let total = 0;
  for (const cp of data) {
    const q = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", cp.conversation_id)
      .neq("sender_id", user.id);

    if (cp.last_read_at) {
      q.gt("created_at", cp.last_read_at);
    }

    const { count } = await q;
    total += count ?? 0;
  }

  return total;
}

/**
 * Devolve o last_read_at do outro participante na conversa.
 * Usado para calcular o estado de "visto" nas mensagens.
 */
export async function getOtherReadAt(conversationId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .neq("user_id", user.id)
    .maybeSingle();
  if (error) return null;
  return data?.last_read_at ?? null;
}

// Gestor de canais partilhados para read receipts
const _receiptChannels = new Map();

/**
 * Subscreve a atualizações de last_read_at do outro participante.
 * Devolve função de unsubscribe.
 */
export function subscribeToReadReceipts(conversationId, currentUserId, callback) {
  if (!supabase || !conversationId) return () => {};

  const key = `receipts:${conversationId}`;
  if (!_receiptChannels.has(key)) {
    const listeners = new Set();
    const channel = supabase
      .channel(key)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Apenas propaga atualizações do OUTRO participante
          if (payload.new?.user_id !== currentUserId) {
            listeners.forEach((cb) => cb(payload.new.last_read_at));
          }
        }
      )
      .subscribe();
    _receiptChannels.set(key, { channel, listeners });
  }

  const entry = _receiptChannels.get(key);
  entry.listeners.add(callback);

  return () => {
    entry.listeners.delete(callback);
    if (entry.listeners.size === 0) {
      supabase.removeChannel(entry.channel);
      _receiptChannels.delete(key);
    }
  };
}

/**
 * Subscreve a novas mensagens numa conversa.
 * Devolve função de unsubscribe.
 */
export function subscribeToMessages(conversationId, callback) {
  const channel = supabase
    .channel(`chat:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Subscreve a atualizações nas conversas do utilizador (badge não lidas).
 * Devolve função de unsubscribe.
 */
export function subscribeToConversations(userId, callback) {
  const channel = supabase
    .channel(`convs:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      callback
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
