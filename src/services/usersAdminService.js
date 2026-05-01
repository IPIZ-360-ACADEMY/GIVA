import { supabase } from "../lib/supabase.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import {
  defaultModerationForAccountType,
  defaultRoleForAccountType,
  normalizeAccountType,
} from "../utils/accessControl.js";

export function getStudentProcessNumberFromIdentifier(identifier) {
  const raw = String(identifier ?? "").trim();
  if (!raw) {
    return null;
  }

  if (!raw.includes("@")) {
    return normalizeStudentProcessNumber(raw) || null;
  }

  const [localPart = ""] = raw.toLowerCase().split("@");
  if (!localPart.startsWith("aluno.")) {
    return null;
  }

  return normalizeStudentProcessNumber(localPart.slice("aluno.".length)) || null;
}

function normalizeUserPayload(payload = {}) {
  const type = normalizeAccountType(payload.type, "external");
  const role = defaultRoleForAccountType(type, payload.role);
  const moderation = payload.moderation ?? defaultModerationForAccountType(type);
  const processNumber = type === "student"
    ? normalizeStudentProcessNumber(payload.processNumber ?? getStudentProcessNumberFromIdentifier(payload.email)) || null
    : null;
  const areaId = role === "ADMIN_1" ? String(payload.areaId ?? "").trim() || null : null;

  return {
    email: String(payload.email ?? "").trim().toLowerCase(),
    password: payload.password,
    display_name: String(payload.display_name ?? "").trim(),
    type,
    role,
    moderation,
    processNumber,
    areaId,
    requirePasswordChange: payload.requirePasswordChange ?? true,
  };
}

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
  const normalized = normalizeUserPayload(payload);
  const { data, error } = await supabase.rpc("admin_create_platform_user", {
    p_email: normalized.email,
    p_password: normalized.password,
    p_display_name: normalized.display_name,
    p_type: normalized.type,
    p_role: normalized.role,
    p_moderation: normalized.moderation,
    p_require_password_change: normalized.requirePasswordChange,
    p_process_number: normalized.processNumber,
    p_area_id: normalized.areaId,
  });
  if (error) throw error;
  return data;
}

/** Garante registos de contas específicas quando o tipo é alterado por super-admin. */
export async function adminEnsureAccountTypeArtifacts(uid, type, displayName = "", options = {}) {
  if (!uid || !type) return { ensured: false, reason: "invalid-input" };

  const normalizedType = normalizeAccountType(type);
  const processNumber = normalizedType === "student"
    ? normalizeStudentProcessNumber(options.processNumber ?? getStudentProcessNumberFromIdentifier(options.email)) || null
    : null;

  const { data, error } = await supabase.rpc("admin_ensure_account_artifacts", {
    p_target_uid: uid,
    p_type: normalizedType,
    p_display_name: String(displayName ?? "").trim() || null,
    p_process_number: processNumber,
  });

  if (error) throw error;
  return data ?? { ensured: true, account_type: normalizedType };
}
