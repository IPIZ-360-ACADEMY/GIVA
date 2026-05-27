import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
/**
 * Faz upload de um ficheiro de imagem para o bucket `avatars` e devolve a URL pública.
 * Funciona sem sessão autenticada (bucket com insert público).
 * @param {File} file - Ficheiro de imagem
 * @param {string} [prefix] - Prefixo da pasta (ex: userId ou "pending")
 * @returns {Promise<{url: string|null, error: any}>}
 */
export async function uploadAvatar(file, prefix = "pending") {
  if (!isSupabaseConfigured || !supabase || !file) return { url: null, error: null };
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${Date.now()}.${ext}`;
  const { error: upError } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type,
  });
  if (upError) return { url: null, error: upError };
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: data?.publicUrl ?? null, error: null };
}

/**
 * Valida se um email tem formato válido com domínio real
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  
  // Regex básica RFC 5322 simplificada para domínios reais
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  
  if (!emailRegex.test(trimmed)) return false;
  
  // Validações adicionais
  const [localPart, domain] = trimmed.split('@');
  
  // Email deve ter entre 5 e 254 caracteres
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  
  // Local part deve ter entre 1 e 64 caracteres
  if (localPart.length < 1 || localPart.length > 64) return false;
  
  // Domain deve ter pelo menos um ponto (ex: example.com)
  if (!domain.includes('.')) return false;
  
  // Domain deve ter TLD com 2-6 caracteres
  const tld = domain.split('.').pop();
  if (tld.length < 2 || tld.length > 6) return false;
  
  // TLD não pode ser só números
  if (/^\d+$/.test(tld)) return false;
  
  return true;
}

import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { normalizeAliasAccountType, normalizePlatformRole } from "../utils/accessControl.js";

const DEFAULT_EMAIL_DOMAIN = "giva.ao";
export const PENDING_STUDENT_OAUTH_STORAGE = "giva.pendingStudentOAuth";
const DEFAULT_EMAIL_EDGE_FUNCTION = "send-account-email";
const EMAIL_PURPOSE_ACTIVATION = "activation";
const EMAIL_PURPOSE_PASSWORD_RESET = "password-reset";

export function getPendingStudentOauthTtlMs() {
  const rawMinutes = Number.parseInt(String(import.meta.env.VITE_PENDING_OAUTH_TTL_MINUTES ?? "30"), 10);
  const safeMinutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 30;
  return safeMinutes * 60 * 1000;
}

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

function getAuthRedirectBase() {
  const appUrl = String(import.meta.env.VITE_APP_URL ?? "").trim().replace(/\/$/, "");
  return import.meta.env.DEV ? window.location.origin : (appUrl || window.location.origin);
}

function getAuthEmailRedirectTo() {
  return `${getAuthRedirectBase()}/login`;
}

function getEmailEdgeFunctionName() {
  return String(import.meta.env.VITE_SUPABASE_EMAIL_EDGE_FUNCTION ?? DEFAULT_EMAIL_EDGE_FUNCTION).trim();
}

function getEmailProviderPreference() {
  const raw = String(import.meta.env.VITE_EMAIL_PROVIDER ?? "edge-first").trim().toLowerCase();
  if (["edge-first", "auth-first", "edge-only", "auth-only"].includes(raw)) {
    return raw;
  }
  return "edge-first";
}

function normalizeEmailPurpose(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === EMAIL_PURPOSE_PASSWORD_RESET) {
    return EMAIL_PURPOSE_PASSWORD_RESET;
  }
  return EMAIL_PURPOSE_ACTIVATION;
}

function normalizeEmailAddress(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized.includes("@") ? normalized : "";
}

export function requiresEmailConfirmation(signUpData) {
  return Boolean(signUpData?.user) && !signUpData?.session;
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

  const rawRole = appMetadata.role ?? metadata.role ?? "authenticated";
  const role = normalizePlatformRole(rawRole);

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
      account_type: normalizeAliasAccountType(row.account_type || "external"),
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
  const redirectTo = getAuthRedirectBase();
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

export async function updateUserAccountSettings({
  email,
  displayName,
  phone,
  website,
  location,
  jobTitle,
  instagramUrl,
  facebookUrl,
  linkedinUrl,
  githubUrl,
  twitterUrl,
}) {
  if (!isAuthEnabled()) {
    return { error: new Error("Supabase Auth is not configured") };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { error: userError };
  }

  const currentMetadata = user?.user_metadata ?? {};
  const nextMetadata = {
    ...currentMetadata,
  };

  if (displayName !== undefined) nextMetadata.display_name = displayName || null;
  if (phone !== undefined) nextMetadata.phone_number = phone || null;
  if (website !== undefined) nextMetadata.website = website || null;
  if (location !== undefined) nextMetadata.location = location || null;
  if (jobTitle !== undefined) nextMetadata.job_title = jobTitle || null;
  if (instagramUrl !== undefined) nextMetadata.instagram_url = instagramUrl || null;
  if (facebookUrl !== undefined) nextMetadata.facebook_url = facebookUrl || null;
  if (linkedinUrl !== undefined) nextMetadata.linkedin_url = linkedinUrl || null;
  if (githubUrl !== undefined) nextMetadata.github_url = githubUrl || null;
  if (twitterUrl !== undefined) nextMetadata.twitter_url = twitterUrl || null;

  const payload = { data: nextMetadata };
  if (email !== undefined) payload.email = email || undefined;
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const currentEmail = String(user?.email ?? "").trim().toLowerCase();
  const emailChanged = Boolean(normalizedEmail) && normalizedEmail !== currentEmail;

  const response = await supabase.auth.updateUser(payload);
  if (response?.error || !emailChanged) {
    return response;
  }

  // Reforça o envio pelo canal central (edge/auth fallback) para padronizar notificações.
  const activationDispatch = await sendAuthEmailByPurpose(normalizedEmail, EMAIL_PURPOSE_ACTIVATION);
  if (activationDispatch?.error) {
    return {
      ...response,
      warning: {
        code: "EMAIL_DISPATCH_FAILED",
        message: activationDispatch.error?.message ?? "Falha ao enviar email de confirmação",
      },
    };
  }

  return response;
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

async function sendAuthEmailByPurpose(email, purpose) {
  if (!isAuthEnabled()) {
    return { error: new Error("Supabase Auth is not configured") };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: new Error("Email is required") };
  }

  if (!isValidEmail(normalizedEmail)) {
    return { error: new Error("Email inválido") };
  }

  const redirectTo = getAuthEmailRedirectTo();
  const normalizedPurpose = normalizeEmailPurpose(purpose);

  const authStrategy = async () => {
    return supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });
  };

  const edgeStrategy = async () => {
    const functionName = getEmailEdgeFunctionName();
    if (!functionName || !supabase.functions?.invoke) {
      return { data: null, error: new Error("Supabase Edge Functions indisponível") };
    }

    const { data, error } = await supabase.functions.invoke(functionName, {
      body: {
        template: normalizedPurpose,
        purpose: normalizedPurpose,
        email: normalizedEmail,
        redirectTo,
      },
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  };

  const strategyByProvider = getEmailProviderPreference();
  const strategyOrder = strategyByProvider === "auth-first"
    ? [authStrategy, edgeStrategy]
    : strategyByProvider === "auth-only"
      ? [authStrategy]
      : strategyByProvider === "edge-only"
        ? [edgeStrategy]
        : [edgeStrategy, authStrategy];

  let lastError = null;
  for (const strategy of strategyOrder) {
    try {
      const response = await strategy();
      if (!response?.error) {
        return response;
      }
      lastError = response.error;
    } catch (error) {
      lastError = error;
    }
  }

  return { data: null, error: lastError ?? new Error("Falha ao enviar email") };
}

export async function sendAccountActivationEmail(email) {
  return sendAuthEmailByPurpose(email, EMAIL_PURPOSE_ACTIVATION);
}

export async function sendPasswordResetEmail(email) {
  return sendAuthEmailByPurpose(email, EMAIL_PURPOSE_PASSWORD_RESET);
}

function isConfirmationEmailDispatchError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("error sending confirmation email")
    || message.includes("sending confirmation email");
}

function isEmailNotConfirmedError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("email not confirmed") || message.includes("email_not_confirmed");
}

async function recoverSignupAfterConfirmationEmailError(email, password) {
  if (!isAuthEnabled()) {
    return { recovered: false, data: null, error: null };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { recovered: false, data: null, error: null };
  }

  try {
    const signInAttempt = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    const accountLikelyCreated = !signInAttempt?.error || isEmailNotConfirmedError(signInAttempt.error);
    if (!accountLikelyCreated) {
      return { recovered: false, data: null, error: signInAttempt?.error ?? null };
    }

    const dispatchResponse = await sendAuthEmailByPurpose(normalizedEmail, EMAIL_PURPOSE_ACTIVATION);
    if (dispatchResponse?.error) {
      return { recovered: false, data: null, error: dispatchResponse.error };
    }

    await supabase.auth.signOut().catch(() => null);

    return {
      recovered: true,
      data: {
        user: signInAttempt?.data?.user ?? { email: normalizedEmail },
        session: null,
      },
      error: null,
    };
  } catch (error) {
    return { recovered: false, data: null, error };
  }
}

export async function getMfaAuthenticatorAssuranceLevel() {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  return supabase.auth.mfa.getAuthenticatorAssuranceLevel();
}

export async function listMfaFactors() {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  return supabase.auth.mfa.listFactors();
}

export async function enrollMfaTotp(friendlyName = "Authenticator") {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  return supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
}

export async function verifyMfaTotpCode({ factorId, code }) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    return { data: null, error: challengeError };
  }

  return supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: String(code ?? "").trim(),
  });
}

export async function unenrollMfaFactor(factorId) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  return supabase.auth.mfa.unenroll({ factorId });
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
export async function signUpStudent(processNumber, password, displayName, studentDbId, emailAddress = null) {
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
  const authEmail = normalizeEmailAddress(emailAddress) || syntheticEmail;

  // Guardar sessão do admin ANTES do signUp, pois supabase.auth.signUp()
  // faz auto-login com o novo utilizador e destrói a sessão activa
  const { data: sessionData } = await supabase.auth.getSession();
  const adminSession = sessionData?.session ?? null;
  const restoreAdminSession = async () => {
    if (!adminSession) return;
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  };

  const { data, error } = await supabase.auth.signUp({
    email: authEmail,
    password,
    options: {
      emailRedirectTo: getAuthEmailRedirectTo(),
      data: {
        display_name: displayName,
        full_name: displayName,
        user_type: "student",
        process_number: normalizedProcessNumber,
        student_id: studentDbId ?? undefined,
      },
    },
  });

  if (error) {
    if (isConfirmationEmailDispatchError(error)) {
      const recovered = await recoverSignupAfterConfirmationEmailError(authEmail, password);
      if (recovered.recovered) {
        await restoreAdminSession();
        return { data: recovered.data, error: null };
      }
      const fallbackError = recovered.error ?? error;
      await restoreAdminSession();
      return { data: null, error: fallbackError };
    }
    await restoreAdminSession();
    return { data: null, error };
  }
  if (!data.user) {
    await restoreAdminSession();
    return { data: null, error: new Error("Utilizador não criado") };
  }

  const hasSession = Boolean(data.session);
  if (!hasSession) {
    const activationDispatch = await sendAuthEmailByPurpose(authEmail, EMAIL_PURPOSE_ACTIVATION);
    if (activationDispatch?.error) {
      await restoreAdminSession();
      return { data: null, error: activationDispatch.error };
    }
    await restoreAdminSession();
    return { data, error: null };
  }

  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert({ id: userId, type: "student", display_name: displayName }, { onConflict: "id" });

  if (profileError) {
    await restoreAdminSession();
    return { data, error: profileError };
  }

  // Nota: student_id é opcional — depends on student_accounts schema
  const studentPayload = { id: userId, process_number: normalizedProcessNumber };
  if (studentDbId) studentPayload.student_id = studentDbId;

  const { error: studentError } = await supabase
    .from("student_accounts")
    .insert(studentPayload);

  // Ignorar erros de coluna desconhecida (student_id pode não existir no schema)
  const isMissingColumn = studentError?.message?.includes("column") && studentError?.message?.includes("student_id");
  if (studentError && !isMissingColumn) {
    await restoreAdminSession();
    return { data, error: studentError };
  }

  // Tentar de novo sem student_id se a coluna não existir
  if (isMissingColumn) {
    const { error: retryError } = await supabase
      .from("student_accounts")
      .insert({ id: userId, process_number: normalizedProcessNumber });
    if (retryError) {
      await restoreAdminSession();
      return { data, error: retryError };
    }
  }

  const { error: aliasError } = await upsertLoginAliases([
    {
      user_id: userId,
      alias: normalizedProcessNumber,
      login_email: authEmail,
      account_type: "student",
    },
    {
      user_id: userId,
      alias: authEmail,
      login_email: authEmail,
      account_type: "student",
    },
  ]);
  if (aliasError) {
    await restoreAdminSession();
    return { data, error: aliasError };
  }

  await restoreAdminSession();
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
 *
 * Estratégia de resiliência:
 * 1. Passa user_type nos metadados para o trigger handle_new_user_oauth criar o perfil correto
 *    mesmo quando confirmação de email está ativada (sem sessão disponível pós-signUp).
 * 2. Se sessão disponível (confirmação de email desativada), faz upsert manual para garantir.
 * 3. Se sem sessão, chama RPC register_company_profile (SECURITY DEFINER) como fallback.
 * 4. alias_login_aliases: upsert após obter sessão; graciosamente opcional para empresa.
 */
export async function signUpWithType(email, password, displayName, type, typeData = {}) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  // Guardar sessão activa (ex: admin a criar conta) antes do signUp para restaurar depois
  const { data: sessionData } = await supabase.auth.getSession();
  const prevSession = sessionData?.session ?? null;
  const restorePrevSession = async () => {
    if (!prevSession) return;
    await supabase.auth.setSession({
      access_token: prevSession.access_token,
      refresh_token: prevSession.refresh_token,
    });
  };

  // Metadados passados ao signUp: o trigger handle_new_user_oauth lê user_type
  // para criar user_profiles com o tipo e moderation correctos, mesmo sem sessão.
  const signUpMetadata = {
    display_name: displayName,
    user_type: type,
    ...(type === "company" ? {
      empresa:             String(typeData?.empresa ?? displayName).trim(),
      nif:                 String(typeData?.nif ?? "").trim(),
      localizacao:         String(typeData?.localizacao ?? "").trim() || undefined,
      responsible_name:    String(typeData?.responsible_name ?? "").trim() || undefined,
      responsible_contact: String(typeData?.responsible_contact ?? "").trim() || undefined,
    } : {}),
  };

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: getAuthEmailRedirectTo(),
      data: signUpMetadata,
    },
  });

  if (error) {
    if (isConfirmationEmailDispatchError(error)) {
      const recovered = await recoverSignupAfterConfirmationEmailError(normalizedEmail, password);
      if (recovered.recovered) {
        await restorePrevSession();
        return { data: recovered.data, error: null };
      }
      const fallbackError = recovered.error ?? error;
      await restorePrevSession();
      return { data: null, error: fallbackError };
    }
    await restorePrevSession();
    return { data: null, error };
  }
  if (!data.user) {
    await restorePrevSession();
    return { data: null, error: new Error("Utilizador não criado") };
  }

  const userId = data.user.id;
  const moderation = type === "company" ? "pending" : "active";

  // Verificar se temos sessão (confirmação de email desativada → sessão imediata).
  // Sem sessão, o fluxo depende exclusivamente do trigger handle_new_user_oauth
  // para manter backend como fonte única de verdade.
  const hasSession = Boolean(data.session);

  if (!hasSession) {
    const activationDispatch = await sendAuthEmailByPurpose(normalizedEmail, EMAIL_PURPOSE_ACTIVATION);
    if (activationDispatch?.error) {
      await restorePrevSession();
      return { data: null, error: activationDispatch.error };
    }
  }

  if (hasSession) {
    // Com sessão: upsert direto — garante dados correctos mesmo que trigger tenha corrido
    const { error: profileError } = await supabase
      .from("user_profiles")
      .upsert({ id: userId, type, display_name: displayName, moderation }, { onConflict: "id" });

    if (profileError) {
      // Falha crítica: trigger não criou o perfil e upsert direto também falhou
      await restorePrevSession();
      return { data, error: profileError };
    }

    if (type === "company") {
      const { error: companyError } = await supabase
        .from("company_accounts")
        .upsert({ id: userId, ...typeData }, { onConflict: "id" });

      // Ignorar conflito de NIF de registo duplicado — o row já existe
      const isNifConflict = companyError?.message?.includes("company_nif_unique");
      const isDuplicateKey = companyError?.code === "23505"; // unique_violation
      if (companyError && !isNifConflict && !isDuplicateKey) {
        await restorePrevSession();
        return { data, error: companyError };
      }
    }
  }

  // Aliases de login: graciosamente opcionais (empresa usa email diretamente)
  if (type === "company") {
    const aliases = [
      { user_id: userId, alias: normalizedEmail, login_email: normalizedEmail, account_type: "company" },
    ];
    const nif = String(typeData?.nif ?? "").trim();
    if (nif) {
      aliases.push({ user_id: userId, alias: nif, login_email: normalizedEmail, account_type: "company" });
    }
    // Alias creation may fail if no session; silently continue — email login works without alias
    await upsertLoginAliases(aliases).catch(() => null);
  } else {
    await upsertLoginAliases([
      { user_id: userId, alias: normalizedEmail, login_email: normalizedEmail, account_type: type },
    ]).catch(() => null);
  }

  await restorePrevSession();
  return { data, error: null };
}

/**
 * Obter os dados de empresa do utilizador autenticado em company_accounts.
 * Usado para pré-popular o dashboard após aprovação.
 */
export async function getMyCompanyAccount() {
  if (!isAuthEnabled()) return null;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("company_accounts")
    .select("id, empresa, nif, nif_is_provisional, localizacao, responsible_name, responsible_contact, setor, website, endereco, cidade")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function updateMyCompanyAccount(updates) {
  if (!isAuthEnabled()) {
    return { data: null, error: new Error("Supabase Auth is not configured") };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    return { data: null, error: new Error("Authentication required") };
  }

  const payload = {};
  if (updates?.empresa !== undefined) payload.empresa = String(updates.empresa ?? "").trim();
  if (updates?.nif !== undefined) payload.nif = String(updates.nif ?? "").trim();
  if (updates?.localizacao !== undefined) payload.localizacao = String(updates.localizacao ?? "").trim() || null;
  if (updates?.responsible_name !== undefined) payload.responsible_name = String(updates.responsible_name ?? "").trim() || null;
  if (updates?.responsible_contact !== undefined) payload.responsible_contact = String(updates.responsible_contact ?? "").trim() || null;
  if (updates?.setor !== undefined) payload.setor = String(updates.setor ?? "").trim() || null;
  if (updates?.website !== undefined) payload.website = String(updates.website ?? "").trim() || null;
  if (updates?.endereco !== undefined) payload.endereco = String(updates.endereco ?? "").trim() || null;
  if (updates?.cidade !== undefined) payload.cidade = String(updates.cidade ?? "").trim() || null;

  const { data, error } = await supabase
    .from("company_accounts")
    .update(payload)
    .eq("id", userId)
    .select("id, empresa, nif, nif_is_provisional, localizacao, responsible_name, responsible_contact, setor, website, endereco, cidade")
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}