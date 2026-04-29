import { supabase } from "../lib/supabase.js";

/**
 * Retorna o perfil do utilizador autenticado atual.
 */
export async function getMyProfile() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, student_accounts(*), company_accounts(*)")
    .eq("id", (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Retorna o perfil de qualquer utilizador pelo ID.
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, student_accounts(*), company_accounts(*)")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cria o perfil base + conta específica do tipo.
 * Chamado após supabase.auth.signUp().
 */
export async function createProfile(userId, type, baseData, typeData) {
  const { error: profileError } = await supabase
    .from("user_profiles")
    .insert({ id: userId, type, display_name: baseData.display_name, avatar_url: baseData.avatar_url ?? null });

  if (profileError) throw profileError;

  if (type === "student") {
    const { error } = await supabase
      .from("student_accounts")
      .insert({ id: userId, ...typeData });
    if (error) throw error;
  } else if (type === "company") {
    const { error } = await supabase
      .from("company_accounts")
      .insert({ id: userId, ...typeData });
    if (error) throw error;
  }
}

/**
 * Atualiza campos do perfil base (display_name, bio, avatar_url).
 */
export async function updateProfile(userId, data) {
  const { error } = await supabase
    .from("user_profiles")
    .update(data)
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Upload de avatar e devolve a URL pública.
 */
export async function uploadAvatar(userId, file) {
  const ext = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Pesquisa utilizadores por nome (para chat / seguir).
 */
export async function searchProfiles(query, limit = 10) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, type")
    .ilike("display_name", `%${query}%`)
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function listProfilesByTypeFromUserProfiles(type) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, type")
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function listProfilesByTypeFromAdminRpc(type) {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;

  return (data ?? [])
    .filter((row) => row?.type === type)
    .map((row) => ({
      id: row.id,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
      type: row.type,
    }));
}

async function attachTypeAccounts(type, profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) return [];

  const ids = profiles.map((profile) => profile.id).filter(Boolean);
  if (ids.length === 0) return profiles;

  if (type === "student") {
    const { data, error } = await supabase
      .from("student_accounts")
      .select("*")
      .in("id", ids);

    if (error) {
      return profiles.map((profile) => ({ ...profile, student_accounts: null }));
    }

    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return profiles.map((profile) => ({
      ...profile,
      student_accounts: byId.get(profile.id) ?? null,
    }));
  }

  if (type === "company") {
    const { data, error } = await supabase
      .from("company_accounts")
      .select("*")
      .in("id", ids);

    if (error) {
      return profiles.map((profile) => ({ ...profile, company_accounts: null }));
    }

    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return profiles.map((profile) => ({
      ...profile,
      company_accounts: byId.get(profile.id) ?? null,
    }));
  }

  return profiles;
}

/**
 * Lista perfis por tipo com dados de contas associadas.
 */
export async function listProfilesByType(type) {
  let profiles = [];
  let lastError = null;

  try {
    profiles = await listProfilesByTypeFromUserProfiles(type);
  } catch (error) {
    lastError = error;
  }

  if (profiles.length === 0) {
    try {
      profiles = await listProfilesByTypeFromAdminRpc(type);
      lastError = null;
    } catch (error) {
      if (!lastError) lastError = error;
    }
  }

  if (profiles.length === 0 && lastError) {
    throw lastError;
  }

  return attachTypeAccounts(type, profiles);
}

/**
 * Seguir um utilizador.
 */
export async function followUser(followingId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: user.id, following_id: followingId });
  if (error) throw error;
}

/**
 * Deixar de seguir um utilizador.
 */
export async function unfollowUser(followingId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);
  if (error) throw error;
}

/**
 * Verifica se o utilizador atual segue outro.
 */
export async function isFollowing(followingId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();
  return Boolean(data);
}
