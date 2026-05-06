const KNOWN_ACCOUNT_TYPES = new Set(["student", "company", "admin", "external", "coordinator", "teacher"]);
const KNOWN_PLATFORM_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ADMIN_1",
  "COORDINATOR",
  "TEACHER",
  "COMPANY",
  "STUDENT",
  "EXTERNAL",
  "authenticated",
]);

export function normalizeAccountType(value, fallback = "external") {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (KNOWN_ACCOUNT_TYPES.has(normalized)) {
    return normalized;
  }

  const fallbackType = String(fallback ?? "").trim().toLowerCase();
  return KNOWN_ACCOUNT_TYPES.has(fallbackType) ? fallbackType : "external";
}

export function normalizePlatformRole(value, fallback = "authenticated") {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  if (raw === "authenticated") {
    return "authenticated";
  }

  const normalized = raw.toUpperCase();
  return KNOWN_PLATFORM_ROLES.has(normalized) ? normalized : fallback;
}

export function getAllowedRolesForType(type) {
  const normalizedType = normalizeAccountType(type);

  if (normalizedType === "company") return ["COMPANY"];
  if (normalizedType === "coordinator") return ["COORDINATOR", "SUPER_ADMIN"];
  if (normalizedType === "teacher") return ["TEACHER", "COORDINATOR", "SUPER_ADMIN"];
  if (normalizedType === "admin") return ["COORDINATOR", "ADMIN", "SUPER_ADMIN"];
  if (normalizedType === "student") return ["authenticated", "STUDENT"];
  return ["authenticated", "EXTERNAL"];
}

export function isCoordinatorRole(role) {
  const normalized = normalizePlatformRole(role);
  return normalized === "COORDINATOR";
}

/**
 * Deriva o account type a partir de um JWT role quando não existe user_profiles.
 * Usado como fallback em resolveAccessProfile e no bootstrap do AuthContext.
 */
export function typeFromRole(role) {
  const normalized = normalizePlatformRole(role ?? "");
  const canonical = normalized === "ADMIN_1" ? "COORDINATOR" : normalized;
  if (canonical === "SUPER_ADMIN" || canonical === "ADMIN") return "admin";
  if (canonical === "COORDINATOR") return "coordinator";
  if (canonical === "TEACHER") return "teacher";
  if (canonical === "COMPANY") return "company";
  if (canonical === "STUDENT") return "student";
  if (canonical === "EXTERNAL") return "external";
  return "external";
}

export function defaultRoleForAccountType(type, fallback = "authenticated") {
  const allowedRoles = getAllowedRolesForType(type);
  // Normalizar ADMIN_1 legado para COORDINATOR
  const raw = normalizePlatformRole(fallback);
  const normalizedFallback = raw === "ADMIN_1" ? "COORDINATOR" : raw;
  return allowedRoles.includes(normalizedFallback) ? normalizedFallback : allowedRoles[0];
}

export function defaultModerationForAccountType(type) {
  return normalizeAccountType(type) === "company" ? "pending" : "active";
}

export function resolveAccessProfile({ role, type }) {
  // Utilizador não autenticado (sem role nem type) — visitante, não externo
  if (role == null && type == null) {
    return {
      normalizedType: null,
      normalizedRole: null,
      isSuperAdmin: false,
      isAdmin1: false,
      isAdmin: false,
      isCompanyUser: false,
      isStudentUser: false,
      isExternalUser: false,
    };
  }

  // Quando não existe linha em user_profiles, derivar o tipo a partir do JWT role
  // para que utilizadores provisionados por admin tenham os acessos corretos.
  const effectiveType = (type != null && String(type).trim() !== "")
    ? type
    : typeFromRole(role);

  const normalizedType = normalizeAccountType(effectiveType);
  const normalizedRole = defaultRoleForAccountType(normalizedType, role);
  const isSuperAdmin = normalizedRole === "SUPER_ADMIN";
  const isAdminCore = normalizedRole === "ADMIN";
  const isAdmin1 = normalizedRole === "ADMIN_1";
  const isCoordinatorUser = isCoordinatorRole(normalizedRole) || normalizedType === "coordinator";
  const isTeacherUser = normalizedRole === "TEACHER" || normalizedType === "teacher";
  const isAdmin = isSuperAdmin || isAdminCore || normalizedType === "admin";
  const isCompanyUser = normalizedType === "company" || normalizedRole === "COMPANY";
  const isStudentUser = normalizedType === "student" || normalizedRole === "STUDENT";
  const isExternalUser = normalizedType === "external" || normalizedRole === "EXTERNAL";

  return {
    normalizedType,
    normalizedRole,
    isSuperAdmin,
    isAdminCore,
    isAdmin1,
    isAdmin,
    isCoordinatorUser,
    isTeacherUser,
    isCompanyUser,
    isStudentUser,
    isExternalUser,
  };
}