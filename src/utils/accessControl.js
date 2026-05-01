const KNOWN_ACCOUNT_TYPES = new Set(["student", "company", "admin", "external"]);
const KNOWN_PLATFORM_ROLES = new Set(["SUPER_ADMIN", "ADMIN_1", "COMPANY", "STUDENT", "EXTERNAL", "authenticated"]);

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
  if (normalizedType === "admin") return ["ADMIN_1", "SUPER_ADMIN"];
  if (normalizedType === "student") return ["authenticated", "STUDENT"];
  return ["authenticated", "EXTERNAL"];
}

export function defaultRoleForAccountType(type, fallback = "authenticated") {
  const allowedRoles = getAllowedRolesForType(type);
  const normalizedFallback = normalizePlatformRole(fallback);
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
  const normalizedType = normalizeAccountType(type);
  const normalizedRole = defaultRoleForAccountType(normalizedType, role);
  const isSuperAdmin = normalizedRole === "SUPER_ADMIN";
  const isAdmin1 = normalizedRole === "ADMIN_1";
  const isAdmin = isSuperAdmin || isAdmin1 || normalizedType === "admin";
  const isCompanyUser = normalizedType === "company" || normalizedRole === "COMPANY";
  const isStudentUser = normalizedType === "student" || normalizedRole === "STUDENT";
  const isExternalUser = normalizedType === "external" || normalizedRole === "EXTERNAL";

  return {
    normalizedType,
    normalizedRole,
    isSuperAdmin,
    isAdmin1,
    isAdmin,
    isCompanyUser,
    isStudentUser,
    isExternalUser,
  };
}