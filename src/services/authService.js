import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";

const DEFAULT_EMAIL_DOMAIN = "giva.ao";
export const PENDING_STUDENT_OAUTH_STORAGE = "giva.pendingStudentOAuth";

function isUuid(value) {
  const normalized = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function normalizeAreaId(areaId) {
  const normalized = String(areaId ?? "").trim();
  if (!normalized) {
    return null;
  }

  return isUuid(normalized) ? normalized : null;
}

function normalizeUuidList(value) {
  if (!value) return [];

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [value];

  const unique = new Set();
  for (const item of source) {
    const normalized = String(item ?? "").trim();
    if (isUuid(normalized)) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

function normalizeCourseCodes(value) {
  if (!value) return [];

  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [value];

  const unique = new Set();
  for (const item of source) {
    const normalized = String(item ?? "").trim().toUpperCase();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

export function isAuthEnabled() {
  return isSupabaseConfigured && Boolean(supabase);
}

export function getAuthProfile(user) {
  if (!user) {
    return {
      displayName: null,
      role: null,
      areaId: null,
      courseIds: [],
      courseCodes: [],
      email: null,
      mustChangePassword: false,
    };
  }

  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};
  const areaId = normalizeAreaId(appMetadata.area_id ?? metadata.area_id);
  const courseIds = normalizeUuidList(
    appMetadata.course_ids
    ?? appMetadata.assigned_course_ids
    ?? metadata.course_ids
    ?? metadata.assigned_course_ids
    ?? appMetadata.course_id
    ?? metadata.course_id
  );
  const courseCodes = normalizeCourseCodes(
    appMetadata.course_codes
    ?? appMetadata.assigned_course_codes
    ?? metadata.course_codes
    ?? metadata.assigned_course_codes
    ?? metadata.course_code
    ?? appMetadata.course_code
  );

  // Normalizar ADMIN_1 legado para COORDINATOR (tipo único de coordenador)
  const rawRole = appMetadata.role ?? metadata.role ?? "authenticated";
  const role = rawRole === "ADMIN_1" ? "COORDINATOR" : rawRole;

  return {
    displayName: metadata.display_name ?? metadata.name ?? user.email ?? null,
    role,
    areaId,
    courseIds,
    courseCodes,
    email: user.email ?? null,
    mustChangePassword: Boolean(metadata.must_change_password),
  };
}

export async function getCurrentSession() {
  if (!isAuthEnabled()) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithPassword(credentials) {
  if (!isAuthEnabled()) {
    return {
      data: { session: null, user: null },
      error: new Error("Supabase Auth is not configured"),
    };
  }

  return supabase.auth.signInWithPassword(credentials);
}

export function normalizeAuthIdentifier(identifier) {
  const raw = String(identifier ?? "").trim();
  if (!raw) {
    return "";
  }

  if (raw.includes("@")) {
    return raw.toLowerCase();
  }

  // Número de processo: prefixar "aluno." para a parte local não ser só dígitos
  // (validadores de e-mail rejeitam partes locais compostas inteiramente por dígitos)
  const configuredDomain = String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
  const domain = configuredDomain || DEFAULT_EMAIL_DOMAIN;
  const localPart = normalizeStudentProcessNumber(raw).toLowerCase();
  return `aluno.${localPart}@${domain}`;
}

function isMissingRelationError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("relation") || message.includes("auth_login_aliases");
}

function normalizeAlias(value) {
  return String(value ?? "").trim().toLowerCase();
}

async function upsertLoginAliases(rows) {
  if (!isAuthEnabled() || !Array.isArray(rows) || rows.length === 0) {
    return { error: null };
  }

  const payload = rows
    .map((row) => ({
      user_id: row.user_id,
      alias: normalizeAlias(row.alias),
      login_email: normalizeAlias(row.login_email),
      account_type: normalizeAlias(row.account_type || "external"),
    }))
    .filter((row) => row.user_id && row.alias && row.login_email);

  if (payload.length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from("auth_login_aliases")
    .upsert(payload, { onConflict: "alias" });

  // Se a migração ainda não foi aplicada, não bloquear registo/login.
  if (error && isMissingRelationError(error)) {
    return { error: null };
  }

  return { error };
}

export async function resolveAuthLoginEmail(identifier) {
  const raw = String(identifier ?? "").trim();
  if (!raw) return "";

  if (!isAuthEnabled()) {
    return normalizeAuthIdentifier(raw);
  }

  const { data, error } = await supabase.rpc("resolve_login_email", {
    p_identifier: raw,
  });

  if (!error && data) {
    const resolved = String(data).trim().toLowerCase();
    if (resolved) return resolved;
  }

  // Fallback para comportamento antigo quando RPC/migração ainda não existir.
  return normalizeAuthIdentifier(raw);
}

export async function getRequiredSession() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    throw new Error("Authentication required");
  }

  return session;
}

export async function signInWithOAuth(provider) {
  if (!isAuthEnabled()) return;
  // Em dev, forca origem local para evitar redirecionar para URL de producao.
  const appUrl = String(import.meta.env.VITE_APP_URL ?? "").trim().replace(/\/$/, "");
  const redirectTo = import.meta.env.DEV ? window.location.origin : (appUrl || window.location.origin);
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
}

export async function getRequiredScope() {
  const session = await getRequiredSession();
  const profile = getAuthProfile(session.user);

  if (!profile.areaId) {
    throw new Error("Missing area_id in user metadata. Update auth.users raw_app_meta_data for this account.");
  }

  return {
    session,
    profile,
  };
}

export async function signOut() {
  if (!isAuthEnabled()) {
    return { error: null };
  }

  return supabase.auth.signOut();
}

export async function updateUserProfile({ displayName, phone }) {
  if (!isAuthEnabled()) {
    return { error: new Error("Supabase Auth is not configured") };
  }

  const updates = {};
  if (displayName !== undefined) updates.display_name = displayName;
  if (phone !== undefined) updates.phone_number = phone;

  return supabase.auth.updateUser({ data: updates });
}

export async function updateUserPassword(newPassword) {
  if (!isAuthEnabled()) {
    return { error: new Error("Supabase Auth is not configured") };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentMetadata = user?.user_metadata ?? {};
  return supabase.auth.updateUser({
    password: newPassword,
    data: {
      ...currentMetadata,
      must_change_password: false,
    },
  });
}

export async function sendAccountActivationEmail(email) {
  if (!isAuthEnabled()) {
    return { error: new Error("Supabase Auth is not configured") };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: new Error("Email is required") };
  }

  const appUrl = String(import.meta.env.VITE_APP_URL ?? "").trim().replace(/\/$/, "");
  const redirectBase = import.meta.env.DEV ? window.location.origin : (appUrl || window.location.origin);
  const redirectTo = `${redirectBase}/login`;

  return supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });
}

export function onAuthStateChange(listener) {
  if (!isAuthEnabled()) {
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    };
  }

  return supabase.auth.onAuthStateChange(listener);
}

/**
 * Registo de aluno via número de processo.
 * O email é sintetizado do número de processo para uso interno do Supabase Auth.
 * O aluno faz login com processo/senha thereafter via normalizeAuthIdentifier.
 * @param {string} processNumber - Número de processo do aluno
 * @param {string} password - Senha escolhida pelo aluno
 * @param {string} displayName - Nome completo (obtido da verificação)
 * @param {string} studentDbId  - UUID do registo em public.students
 */
export async function signUpStudent(processNumber, password, displayName, studentDbId) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const normalizedProcessNumber = normalizeStudentProcessNumber(processNumber);
  if (!normalizedProcessNumber) {
    return { data: null, error: new Error("Número de processo inválido") };
  }

  // Sintetizar email interno idêntico ao que normalizeAuthIdentifier gera no login
  const configuredDomain = String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
  const domain = configuredDomain || DEFAULT_EMAIL_DOMAIN;
  const localPart = normalizedProcessNumber.toLowerCase();
  const syntheticEmail = `aluno.${localPart}@${domain}`;

  // Guardar sessão do admin ANTES do signUp, pois supabase.auth.signUp()
  // faz auto-login com o novo utilizador e destrói a sessão activa
  const { data: sessionData } = await supabase.auth.getSession();
  const adminSession = sessionData?.session ?? null;

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
    // Passar full_name E display_name para que o trigger handle_new_user_oauth
    // use o nome correcto (em vez de fazer fallback para o email/processo)
    options: { data: { display_name: displayName, full_name: displayName } },
  });

  // Restaurar sessão do admin imediatamente após o signUp
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }

  if (error) return { data: null, error };
  if (!data.user) return { data: null, error: new Error("Utilizador não criado") };

  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, type: "student", display_name: displayName }, { onConflict: "id" });

  if (profileError) return { data, error: profileError };

  // Nota: student_id é opcional — depends on student_accounts schema
  const studentPayload = { id: userId, process_number: normalizedProcessNumber };
  if (studentDbId) studentPayload.student_id = studentDbId;

  const { error: studentError } = await supabase
    .from("student_accounts")
    .insert(studentPayload);

  // Ignorar erros de coluna desconhecida (student_id pode não existir no schema)
  const isMissingColumn = studentError?.message?.includes("column") && studentError?.message?.includes("student_id");
  if (studentError && !isMissingColumn) return { data, error: studentError };

  // Tentar de novo sem student_id se a coluna não existir
  if (isMissingColumn) {
    const { error: retryError } = await supabase
      .from("student_accounts")
      .insert({ id: userId, process_number: normalizedProcessNumber });
    if (retryError) return { data, error: retryError };
  }

  const { error: aliasError } = await upsertLoginAliases([
    {
      user_id: userId,
      alias: normalizedProcessNumber,
      login_email: syntheticEmail,
      account_type: "student",
    },
    {
      user_id: userId,
      alias: syntheticEmail,
      login_email: syntheticEmail,
      account_type: "student",
    },
  ]);
  if (aliasError) return { data, error: aliasError };

  return { data, error: null };
}

/**
 * Verificar número de processo na base de dados administrativa do IPIZ.
 * Chama a RPC `verify_student_process_number` (acessível a anon).
 * Retorna { found, full_name, date_of_birth, phone_number, course_name, ... } ou { found: false, message }
 */
export async function verifyStudentProcessNumber(processNumber) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const normalizedProcessNumber = normalizeStudentProcessNumber(processNumber);
  if (!normalizedProcessNumber) {
    return {
      data: { found: false, message: "Número de processo inválido." },
      error: null,
    };
  }

  const { data, error } = await supabase.rpc("verify_student_process_number", {
    p_number: normalizedProcessNumber,
  });

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Registo de empresa ou utilizador externo.
 * Empresas ficam com moderation='pending' até aprovação de admin.
 * typeData para company: { empresa, nif, localizacao, responsible_name, responsible_contact }
 * typeData para external: {}
 */
export async function signUpWithType(email, password, displayName, type, typeData = {}) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  // Guardar sessão activa (admin) antes do signUp para restaurar depois
  const { data: sessionData } = await supabase.auth.getSession();
  const prevSession = sessionData?.session ?? null;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { display_name: displayName } },
  });

  // Restaurar sessão anterior imediatamente
  if (prevSession) {
    await supabase.auth.setSession({
      access_token: prevSession.access_token,
      refresh_token: prevSession.refresh_token,
    });
  }

  if (error) return { data: null, error };
  if (!data.user) return { data: null, error: new Error("Utilizador não criado") };

  const userId = data.user.id;
  const moderation = type === "company" ? "pending" : "active";

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, type, display_name: displayName, moderation }, { onConflict: "id" });

  if (profileError) return { data, error: profileError };

  if (type === "company") {
    const { error: companyError } = await supabase
      .from("company_accounts")
      .insert({ id: userId, ...typeData });
    if (companyError) return { data, error: companyError };

    const aliases = [
      {
        user_id: userId,
        alias: normalizedEmail,
        login_email: normalizedEmail,
        account_type: "company",
      },
    ];

    const nif = String(typeData?.nif ?? "").trim();
    if (nif) {
      aliases.push({
        user_id: userId,
        alias: nif,
        login_email: normalizedEmail,
        account_type: "company",
      });
    }

    const { error: aliasError } = await upsertLoginAliases(aliases);
    if (aliasError) return { data, error: aliasError };
  } else {
    const { error: aliasError } = await upsertLoginAliases([
      {
        user_id: userId,
        alias: normalizedEmail,
        login_email: normalizedEmail,
        account_type: type,
      },
    ]);
    if (aliasError) return { data, error: aliasError };
  }

  return { data, error: null };
}