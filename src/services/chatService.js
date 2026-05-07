import { supabase } from "../lib/supabase.js";

function ensureChatApi() {
  if (!supabase) {
    throw new Error("Chat indisponível: Supabase não configurado.");
  }
}

async function getCurrentUserOrThrow() {
  ensureChatApi();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error("Sessão inválida para mensagens.");
  }
  return user;
}

/**
 * Lista conversas do utilizador autenticado, ordenadas pela mais recente.
 * Usa 3 queries simples para evitar problemas com self-joins no PostgREST.
 */
export async function getConversations() {
  const user = await getCurrentUserOrThrow();

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

  // 3. Outros participantes
  const { data: otherParts, error: e3 } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", convIds)
    .neq("user_id", user.id);

  if (e3) throw e3;

  // 4. Perfis reais dos outros participantes
  const otherUserIds = [...new Set((otherParts ?? []).map((p) => p.user_id).filter(Boolean))];
  let profileRows = [];

  if (otherUserIds.length > 0) {
    // Tenta usar view com fallback de email para nome, se disponível no schema
    const { data: viewProfiles, error: viewError } = await supabase
      .from("user_profiles_with_email")
      .select("id, display_name, avatar_url, type, email")
      .in("id", otherUserIds);

    if (!viewError && Array.isArray(viewProfiles)) {
      profileRows = viewProfiles;
    } else {
      const { data: directProfiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, display_name, avatar_url, type")
        .in("id", otherUserIds);
      if (profileError) throw profileError;
      profileRows = directProfiles ?? [];
    }
  }

  const profileMap = new Map(
    (profileRows ?? []).map((row) => {
      const display = String(row.display_name ?? "").trim();
      const emailLocal = String(row.email ?? "").trim().split("@")[0];
      return [row.id, {
        id: row.id,
        display_name: display || emailLocal || "Utilizador",
        avatar_url: row.avatar_url ?? null,
        type: row.type ?? "external",
      }];
    })
  );

  // 5. Últimas mensagens para preview e não lidas
  const { data: messageRows, error: msgError } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, content, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (msgError) throw msgError;

  const latestMessageMap = new Map();
  const unreadCountMap = new Map();
  const readMap = new Map((myParts ?? []).map((p) => [p.conversation_id, p.last_read_at]));

  for (const msg of messageRows ?? []) {
    if (!latestMessageMap.has(msg.conversation_id)) {
      latestMessageMap.set(msg.conversation_id, msg);
    }

    const lastReadAt = readMap.get(msg.conversation_id);
    const isUnread = msg.sender_id !== user.id && (!lastReadAt || new Date(msg.created_at) > new Date(lastReadAt));
    if (isUnread) {
      unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) ?? 0) + 1);
    }
  }

  // Construir mapa de metadados e de participantes
  const convMap = Object.fromEntries((convRows ?? []).map((c) => [c.id, c]));
  const partMap = {};
  for (const p of otherParts ?? []) {
    if (!partMap[p.conversation_id]) partMap[p.conversation_id] = [];
    partMap[p.conversation_id].push({ user_id: p.user_id, profile: profileMap.get(p.user_id) ?? null });
  }

  const result = myParts
    .map((p) => {
      const latest = latestMessageMap.get(p.conversation_id) ?? null;
      const participants = (partMap[p.conversation_id] ?? []).filter((x) => x.profile?.id);
      return {
        conversation_id: p.conversation_id,
        last_read_at: p.last_read_at,
        conversation: convMap[p.conversation_id] ?? null,
        other_participants: participants,
        last_message_preview: String(latest?.content ?? "").trim(),
        last_message_at: latest?.created_at ?? convMap[p.conversation_id]?.updated_at ?? null,
        unread_count: unreadCountMap.get(p.conversation_id) ?? 0,
      };
    })
    // Só manter conversas com participante real resolvido
    .filter((c) => c.other_participants.length > 0);

  return result.sort((a, b) => {
    const dateA = new Date(a.last_message_at ?? a.conversation?.updated_at ?? 0).getTime();
    const dateB = new Date(b.last_message_at ?? b.conversation?.updated_at ?? 0).getTime();
    return dateB - dateA;
  });
}

/**
 * Encontra ou cria uma conversa 1-a-1 com outro utilizador.
 */
export async function getOrCreateConversation(otherUserId) {
  ensureChatApi();
  if (!otherUserId) {
    throw new Error("Utilizador de destino inválido.");
  }
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
  ensureChatApi();
  if (!conversationId) return [];
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
  const user = await getCurrentUserOrThrow();
  if (!conversationId) {
    throw new Error("Conversa inválida.");
  }
  if (!String(content ?? "").trim()) {
    throw new Error("Mensagem vazia.");
  }
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
  const user = await getCurrentUserOrThrow();
  if (!conversationId) return;
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
  if (!supabase) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return 0;

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
  if (!supabase || !conversationId) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;
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
// Gestor de canais partilhados para atualizações de conversas (badge/unread)
const _conversationChannels = new Map();

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
            listeners.forEach((cb) => {
              try {
                cb(payload.new.last_read_at);
              } catch {
                // Isola falha de um listener para não derrubar os restantes.
              }
            });
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
  if (!supabase || !conversationId) return () => {};
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
  if (!supabase || !userId) return () => {};

  const key = `convs:${userId}`;

  if (!_conversationChannels.has(key)) {
    const listeners = new Set();
    const channel = supabase
      .channel(key)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          listeners.forEach((cb) => {
            try {
              cb(payload);
            } catch {
              // Isola erro de listener para não quebrar a subscrição partilhada.
            }
          });
        }
      )
      .subscribe();

    _conversationChannels.set(key, { channel, listeners });
  }

  const entry = _conversationChannels.get(key);
  entry.listeners.add(callback);

  return () => {
    entry.listeners.delete(callback);
    if (entry.listeners.size === 0) {
      supabase.removeChannel(entry.channel);
      _conversationChannels.delete(key);
    }
  };
}
