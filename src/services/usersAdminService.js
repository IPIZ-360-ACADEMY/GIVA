import { supabase } from "../lib/supabase.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { getAuthProfile, getCurrentSession, sendAccountActivationEmail, sendPasswordResetEmail } from "./authService.js";
import {
  defaultModerationForAccountType,
  defaultRoleForAccountType,
  normalizeAccountType,
} from "../utils/accessControl.js";

const ROLE_SUPER_ADMIN = "SUPER_ADMIN";
const ROLE_ADMIN = "ADMIN";
const ROLE_COORDINATOR = "COORDINATOR";

async function requireAdminRole(allowedRoles, actionLabel) {
  const session = await getCurrentSession();
  const role = String(getAuthProfile(session?.user)?.role ?? "").toUpperCase();

  if (!allowedRoles.includes(role)) {
    throw new Error(`Permissão insuficiente para ${actionLabel}.`);
  }
}

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
  const areaId = role === "COORDINATOR" ? String(payload.areaId ?? "").trim() || null : null;

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

function parsePaginationOptions(options) {
  const page = Number(options?.page);
  const limit = Number(options?.limit);
  if (!Number.isFinite(page) || !Number.isFinite(limit) || page < 1 || limit < 1) {
    return null;
  }

  return {
    page,
    limit,
    from: (page - 1) * limit,
    to: page * limit,
  };
}

/** Lista utilizadores com email, bio e role JWT. Requer perfil administrativo. */
export async function adminListUsers(options = undefined) {
  await requireAdminRole([ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_COORDINATOR], "listar utilizadores");
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;

  const rows = data ?? [];
  const pagination = parsePaginationOptions(options);
  if (!pagination) {
    return rows;
  }

  const items = rows.slice(pagination.from, pagination.to);
  return {
    items,
    total: rows.length,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.max(1, Math.ceil(rows.length / pagination.limit)),
  };
}

/** Muda o JWT role (app_metadata.role). Requer SUPER_ADMIN. */
export async function adminSetUserRole(targetUid, newRole) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "alterar role de utilizador");
  const { error } = await supabase.rpc("admin_set_user_role", {
    p_target_uid: targetUid,
    p_new_role: newRole,
  });
  if (error) throw error;
}

/** Atribui area_id no app metadata (escopo de coordenador). Requer SUPER_ADMIN. */
export async function adminSetUserArea(targetUid, areaId) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "atribuir area de utilizador");
  const { error } = await supabase.rpc("admin_set_user_area", {
    p_target_uid: targetUid,
    p_area_id: areaId,
  });
  if (error) throw error;
}

/** Actualiza campos do perfil (type, moderation, display_name, bio, avatar_url). */
export async function adminUpdateUserProfile(uid, updates) {
  await requireAdminRole([ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_COORDINATOR], "atualizar perfil de utilizador");
  const { error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", uid);
  if (error) throw error;
}

/** Elimina utilizador da auth + perfil. Requer SUPER_ADMIN. */
export async function adminDeleteUser(uid) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "eliminar utilizador");
  const { error } = await supabase.rpc("admin_delete_user", { p_uid: uid });
  if (error) throw error;
}

/**
 * Envia email de reset de password para uma conta criada pelo admin.
 * Útil para reenviar credenciais quando o utilizador não recebeu o email inicial.
 */
export async function adminSendPasswordReset(email) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "reenviar ativação de conta");
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) throw new Error("Email é obrigatório");
  const { error } = await sendPasswordResetEmail(normalized);
  if (error) throw error;
}

/** Reenvia email de ativação/convite para contas pendentes. Requer SUPER_ADMIN. */
export async function adminSendAccountActivation(email) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "reenviar ativação de conta");
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) throw new Error("Email é obrigatório");
  const { error } = await sendAccountActivationEmail(normalized);
  if (error) throw error;
}

/** Cria utilizador na plataforma via RPC. Requer SUPER_ADMIN. */
export async function adminCreatePlatformUser(payload) {
  await requireAdminRole([ROLE_SUPER_ADMIN], "criar utilizador");
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
  await requireAdminRole([ROLE_SUPER_ADMIN], "sincronizar artefactos de tipo de conta");
  if (!uid || !type) return { ensured: false, reason: "invalid-input" };

  const normalizedType = normalizeAccountType(type);
  if (!["student", "company", "external", "admin"].includes(normalizedType)) {
    return { ensured: false, skipped: true, reason: "no-artifacts-required", account_type: normalizedType };
  }

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
