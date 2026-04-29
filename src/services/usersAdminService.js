import { supabase } from "../lib/supabase.js";

/** Lista todos os utilizadores com email, bio e role JWT. Requer ADMIN_1+. */
export async function adminListUsers() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return data ?? [];
}

/** Muda o JWT role (app_metadata.role). Requer SUPER_ADMIN. */
export async function adminSetUserRole(targetUid, newRole) {
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_target_uid: targetUid,
    p_new_role: newRole,
  });
  if (error) throw error;
}

/** Atribui area_id no app metadata (escopo de coordenador). Requer SUPER_ADMIN. */
export async function adminSetUserArea(targetUid, areaId) {
  const { error } = await supabase.rpc("admin_set_user_area", {
    p_target_uid: targetUid,
    p_area_id: areaId,
  });
  if (error) throw error;
}

/** Actualiza campos do perfil (type, moderation, display_name, bio, avatar_url). */
export async function adminUpdateUserProfile(uid, updates) {
  const { error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", uid);
  if (error) throw error;
}

/** Elimina utilizador da auth + perfil. Requer SUPER_ADMIN. */
export async function adminDeleteUser(uid) {
  const { error } = await supabase.rpc("admin_delete_user", { p_uid: uid });
  if (error) throw error;
}

/** Cria utilizador na plataforma via RPC. Requer SUPER_ADMIN. */
export async function adminCreatePlatformUser(payload) {
  const { data, error } = await supabase.rpc("admin_create_platform_user", {
    p_email: payload.email,
    p_password: payload.password,
    p_display_name: payload.display_name,
    p_type: payload.type,
    p_role: payload.role,
    p_moderation: payload.moderation ?? "active",
    p_require_password_change: payload.requirePasswordChange ?? true,
  });
  if (error) throw error;
  return data;
}

async function ensureStudentAccount(uid) {
  const { data: existing, error: checkError } = await supabase
    .from("student_accounts")
    .select("id")
    .eq("id", uid)
    .maybeSingle();
  if (checkError) throw checkError;
  if (existing) return;

  const base = `MIG-${uid.slice(0, 8).toUpperCase()}`;
  let processNumber = base;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from("student_accounts")
      .insert({ id: uid, process_number: processNumber });

    if (!error) return;
    if (error.code !== "23505") throw error;

    processNumber = `${base}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  throw new Error("Não foi possível garantir registo de estudante (process_number duplicado).");
}

async function ensureCompanyAccount(uid, displayName) {
  const { data: existing, error: checkError } = await supabase
    .from("company_accounts")
    .select("id")
    .eq("id", uid)
    .maybeSingle();
  if (checkError) throw checkError;
  if (existing) return;

  const baseNif = `TMP-${uid.replace(/-/g, "").slice(0, 9).toUpperCase()}`;
  let nif = baseNif;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await supabase
      .from("company_accounts")
      .insert({ id: uid, empresa: displayName || "Empresa sem nome", nif });

    if (!error) return;
    if (error.code !== "23505") throw error;

    nif = `${baseNif}${Math.floor(Math.random() * 9)}`;
  }

  throw new Error("Não foi possível garantir registo de empresa (NIF duplicado).");
}

/** Garante registos de contas específicas quando o tipo é alterado por super-admin. */
export async function adminEnsureAccountTypeArtifacts(uid, type, displayName = "") {
  if (!uid || !type) return { ensured: false, reason: "invalid-input" };

  try {
    if (type === "student") {
      await ensureStudentAccount(uid);
      return { ensured: true };
    }
    if (type === "company") {
      await ensureCompanyAccount(uid, displayName);
      return { ensured: true };
    }
    return { ensured: false, reason: "not-required" };
  } catch (error) {
    // Em ambientes com RLS estrita no client, a criação de artefatos pode ser bloqueada.
    // Não impede a mudança de tipo no perfil; devolvemos estado para logging/telemetria.
    if (error?.code === "42501") {
      return { ensured: false, reason: "rls-blocked" };
    }
    throw error;
  }
}
