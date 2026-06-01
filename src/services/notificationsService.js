import { supabase } from "../lib/supabase.js";

const TABLE = "user_notifications";

// Sem join FK (actor_id referencia auth.users, não user_profiles — join resolvido em JS)
const NOTIF_SELECT = `
  id, type, object_type, object_id, title, body, read, data, created_at, actor_id
`;

export function canUseNotificationsApi() {
  return Boolean(supabase);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
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
 * Envia notificação de segurança para o utilizador autenticado.
 * Falhas são devolvidas para o caller decidir se ignora ou apresenta feedback.
 */
export async function sendSecurityNotificationToCurrentUser({
  title,
  body = null,
  objectType = "security",
  objectId = null,
}) {
  if (!supabase) throw new Error("Supabase não configurado");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const userId = authData?.user?.id;
  if (!userId) {
    throw new Error("Sessão inválida para enviar notificação de segurança.");
  }

  return sendNotification({
    userId,
    actorId: userId,
    type: "security_mfa",
    title,
    body,
    objectType,
    objectId,
  });
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

export async function notifyEligibleStudentsForVacancyPublished({
  vacancyId,
  actorId = null,
  partnerId,
  vacancyTitle,
  partnerName,
  totalSlots,
}) {
  if (!supabase || !partnerId) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("id, empresa, area_id, areas")
    .eq("id", partnerId)
    .maybeSingle();

  if (partnerError || !partner) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const trainingAreaIds = new Set();
  if (isUuid(partner.area_id)) {
    trainingAreaIds.add(partner.area_id);
  }

  const partnerAreaCodes = normalizeStringArray(partner.areas).map((code) => code.toUpperCase());
  if (partnerAreaCodes.length > 0) {
    const { data: areaRows, error: areaError } = await supabase
      .from("training_area")
      .select("id, code")
      .in("code", partnerAreaCodes);

    if (!areaError) {
      for (const row of areaRows ?? []) {
        if (isUuid(row?.id)) {
          trainingAreaIds.add(row.id);
        }
      }
    }
  }

  if (trainingAreaIds.size === 0) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const { data: courseRows, error: coursesError } = await supabase
    .from("course")
    .select("id")
    .in("area_id", Array.from(trainingAreaIds));

  const courseIds = new Set();
  if (!coursesError) {
    for (const row of courseRows ?? []) {
      if (isUuid(row?.id)) {
        courseIds.add(row.id);
      }
    }
  }

  const areaFilter = `training_area_id.in.(${Array.from(trainingAreaIds).join(",")})`;
  const courseFilter = courseIds.size > 0
    ? `course_id.in.(${Array.from(courseIds).join(",")})`
    : null;
  const eligibilityFilter = courseFilter ? `${areaFilter},${courseFilter}` : areaFilter;

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id")
    .eq("status", "ACTIVE")
    .or(eligibilityFilter);

  if (studentsError || !students?.length) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const studentEntityIds = students.map((student) => student.id).filter(Boolean);
  if (studentEntityIds.length === 0) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const { data: studentAccounts, error: accountsError } = await supabase
    .from("student_accounts")
    .select("id")
    .in("student_id", studentEntityIds);

  if (accountsError || !studentAccounts?.length) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const userIds = studentAccounts.map((row) => row.id).filter((id) => isUuid(id));
  if (userIds.length === 0) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const { data: activeProfiles, error: profilesError } = await supabase
    .from("user_profiles")
    .select("id")
    .in("id", userIds)
    .eq("type", "student")
    .eq("moderation", "active");

  if (profilesError || !activeProfiles?.length) {
    return { sent: 0, errors: 0, matched: 0 };
  }

  const eligibleUserIds = activeProfiles.map((row) => row.id);
  const safeTitle = String(vacancyTitle ?? "").trim() || "Nova vaga publicada";
  const safePartnerName = String(partnerName ?? partner.empresa ?? "Empresa").trim() || "Empresa";
  const safeSlots = Math.max(1, Number(totalSlots ?? 1) || 1);
  const notificationRows = eligibleUserIds.map((userId) => ({
    user_id: userId,
    actor_id: actorId,
    type: "internship_match",
    object_type: "vacancy",
    object_id: vacancyId,
    title: `Nova vaga: ${safeTitle}`,
    body: `${safePartnerName} publicou ${safeSlots} vaga(s) compatível(is) com o teu perfil.`,
  }));

  let sent = 0;
  let errors = 0;
  for (let i = 0; i < notificationRows.length; i += 100) {
    const chunk = notificationRows.slice(i, i + 100);
    const { error } = await supabase.from(TABLE).insert(chunk);
    if (error) {
      errors += chunk.length;
    } else {
      sent += chunk.length;
    }
  }

  return { sent, errors, matched: eligibleUserIds.length };
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
