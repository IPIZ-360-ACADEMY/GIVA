import { supabase } from "../lib/supabase.js";

const TABLE = "user_notifications";

// Sem join FK (actor_id referencia auth.users, não user_profiles — join resolvido em JS)
const NOTIF_SELECT = `
  id, type, object_type, object_id, title, body, read, data, created_at, actor_id
`;

export function canUseNotificationsApi() {
  return Boolean(supabase);
}

/** Batch-enriquecer notificações com perfis de actor */
async function enrichWithActors(notifications) {
  if (!notifications?.length) return notifications ?? [];
  const ids = [...new Set(notifications.map((n) => n.actor_id).filter(Boolean))];
  if (!ids.length) return notifications.map((n) => ({ ...n, actor: null }));
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  return notifications.map((n) => ({ ...n, actor: map[n.actor_id] ?? null }));
}

/** Lista notificações do utilizador autenticado (mais recentes primeiro). */
export async function listNotifications(limit = 60) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select(NOTIF_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return enrichWithActors(data ?? []);
}

/** Conta notificações não lidas. */
export async function getUnreadNotifCount() {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count ?? 0;
}

/** Marca uma notificação como lida. */
export async function markNotificationAsRead(id) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { data, error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .eq("id", id)
    .select(NOTIF_SELECT)
    .single();
  if (error) throw error;
  const [enriched] = await enrichWithActors([data]);
  return enriched;
}

/** Marca todas as notificações como lidas. */
export async function markAllAsRead() {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase
    .from(TABLE)
    .update({ read: true })
    .eq("read", false);
  if (error) throw error;
}

/** Remove uma notificação. */
export async function deleteNotification(id) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Envia uma notificação para um utilizador específico.
 * @param {object} opts
 * @param {string} opts.userId - UUID do destinatário
 * @param {string} [opts.actorId] - UUID do actor (quem originou)
 * @param {string} opts.type - tipo (announcement|message|reaction|…)
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {string} [opts.objectType]
 * @param {string} [opts.objectId]
 */
export async function sendNotification({ userId, actorId = null, type, title, body = null, objectType = null, objectId = null }) {
  if (!supabase) throw new Error("Supabase não configurado");
  const { error } = await supabase.from(TABLE).insert({
    user_id: userId,
    actor_id: actorId,
    type,
    object_type: objectType,
    object_id: objectId,
    title,
    body,
  });
  if (error) throw error;
}

/**
 * Envia um anúncio para todos os utilizadores activos (ou por tipo de conta).
 * Requer que a política RLS permita inserção para qualquer user_id.
 * @returns {{ sent: number, errors: number }}
 */
export async function broadcastAnnouncement({ actorId, title, body, targetType = null }) {
  if (!supabase) throw new Error("Supabase não configurado");

  let query = supabase.from("user_profiles").select("id").eq("moderation", "active");
  if (targetType) query = query.eq("type", targetType);

  const { data: targets, error: fetchErr } = await query;
  if (fetchErr) throw fetchErr;
  if (!targets?.length) return { sent: 0, errors: 0 };

  const rows = targets.map((t) => ({
    user_id: t.id,
    actor_id: actorId ?? null,
    type: "announcement",
    title,
    body: body || null,
  }));

  let sent = 0, errors = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from(TABLE).insert(chunk);
    if (error) errors += chunk.length;
    else sent += chunk.length;
  }
  return { sent, errors };
}

/**
 * Gestor de canais Realtime: um único canal por userId partilhado por todos os
 * chamadores. Evita o erro "cannot add postgres_changes callbacks after subscribe()".
 */
const _notifChannels = new Map(); // userId -> { channel, listeners: Set }

/**
 * Subscreve a novas notificações do utilizador via Supabase Realtime.
 * Múltiplos chamadores com o mesmo userId partilham um único canal.
 * Devolve função de unsubscribe que limpa apenas o callback registado.
 */
export function subscribeToNotifications(userId, callback) {
  if (!supabase || !userId) return () => {};

  if (!_notifChannels.has(userId)) {
    const listeners = new Set();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
        (payload) => listeners.forEach((cb) => cb(payload))
      )
      .subscribe();
    _notifChannels.set(userId, { channel, listeners });
  }

  const entry = _notifChannels.get(userId);
  entry.listeners.add(callback);

  return () => {
    entry.listeners.delete(callback);
    if (entry.listeners.size === 0) {
      supabase.removeChannel(entry.channel);
      _notifChannels.delete(userId);
    }
  };
}

// Compatibilidade com código legado
export async function createNotification() { return null; }
