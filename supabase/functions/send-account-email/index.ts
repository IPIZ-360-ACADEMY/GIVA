import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const PURPOSE_ACTIVATION = "activation";
const PURPOSE_PASSWORD_RESET = "password-reset";
const MAX_REQUEST_BYTES = 32 * 1024;

type RateLimitEntry = { count: number; windowStartMs: number };

const rateLimitStore = new Map<string, RateLimitEntry>();
const idempotencyStore = new Map<string, number>();
const IDEMPOTENCY_IN_PROGRESS = -1;

function getEnvInt(name: string, fallback: number, min: number, max: number) {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function cleanupStores(nowMs: number, rateWindowMs: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (nowMs - value.windowStartMs >= rateWindowMs) {
      rateLimitStore.delete(key);
    }
  }

  for (const [key, expiry] of idempotencyStore.entries()) {
    if (expiry !== IDEMPOTENCY_IN_PROGRESS && expiry <= nowMs) {
      idempotencyStore.delete(key);
    }
  }
}

function hitRateLimit(params: { key: string; nowMs: number; maxRequests: number; windowMs: number }) {
  const current = rateLimitStore.get(params.key);
  if (!current || (params.nowMs - current.windowStartMs) >= params.windowMs) {
    rateLimitStore.set(params.key, { count: 1, windowStartMs: params.nowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= params.maxRequests) {
    const retryAfterMs = Math.max(0, params.windowMs - (params.nowMs - current.windowStartMs));
    return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  current.count += 1;
  rateLimitStore.set(params.key, current);
  return { allowed: true, retryAfterSeconds: 0 };
}

function reserveIdempotencyKey(params: { key: string; nowMs: number }) {
  const current = idempotencyStore.get(params.key);
  if (current === IDEMPOTENCY_IN_PROGRESS) {
    return { accepted: false, inProgress: true };
  }

  if (typeof current === "number" && current > params.nowMs) {
    return { accepted: false, inProgress: false };
  }

  idempotencyStore.set(params.key, IDEMPOTENCY_IN_PROGRESS);
  return { accepted: true, inProgress: false };
}

function releaseIdempotencyKey(key: string, success: boolean, nowMs: number, ttlMs: number) {
  if (!key) return;
  if (!success) {
    idempotencyStore.delete(key);
    return;
  }
  idempotencyStore.set(key, nowMs + ttlMs);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function jsonResponse(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalizeBaseUrl(raw: string) {
  const value = String(raw ?? "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return "";
    }
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.origin}${path}`;
  } catch {
    return "";
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAllowedOrigins() {
  const raw = Deno.env.get("EMAIL_ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function resolveCorsOrigin(origin: string | null, allowedOrigins: string[]) {
  if (allowedOrigins.length === 0) {
    return "*";
  }

  if (!origin) {
    return allowedOrigins[0];
  }

  return allowedOrigins.includes(origin) ? origin : null;
}

function getCorsHeaders(allowOrigin: string | null) {
  const resolvedOrigin = allowOrigin ?? "null";

  return {
    "Access-Control-Allow-Origin": resolvedOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

function normalizePurpose(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === PURPOSE_PASSWORD_RESET) {
    return PURPOSE_PASSWORD_RESET;
  }
  return PURPOSE_ACTIVATION;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailText(params: { purpose: string; actionLink: string }) {
  if (params.purpose === PURPOSE_PASSWORD_RESET) {
    return [
      "RECUPERACAO DE PALAVRA-PASSE",
      "",
      "Recebemos um pedido para redefinir a sua palavra-passe no GIVA.",
      "",
      `Redefinir palavra-passe: ${params.actionLink}`,
      "",
      "Se nao pediu esta acao, pode ignorar este email.",
    ].join("\n");
  }

  return [
    "CONTA CRIADA COM SUCESSO",
    "",
    "A sua conta no GIVA foi criada com sucesso.",
    "",
    "Use o link abaixo para concluir a ativacao e aceder ao sistema:",
    "",
    `Confirmar conta: ${params.actionLink}`,
    "",
    "Se nao reconhece este pedido, ignore este email.",
  ].join("\n");
}

function buildEmailHtml(params: { purpose: string; actionLink: string; logoUrl: string; appUrl: string }) {
  const safeLink = escapeHtml(params.actionLink);
  const safeLogo = escapeHtml(params.logoUrl);
  const safeAppUrl = escapeHtml(params.appUrl);

  const title = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Recuperacao de palavra-passe"
    : "Conta criada com sucesso";

  const intro = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Recebemos um pedido para redefinir a sua palavra-passe no GIVA."
    : "A sua conta no GIVA foi criada com sucesso. Confirme o acesso para concluir a ativacao.";

  const cta = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Redefinir palavra-passe"
    : "Confirmar conta";

  const badge = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Seguranca da conta"
    : "Ativacao inicial";

  const helper = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Se nao pediu esta acao, pode ignorar este email."
    : "Se nao reconhece este pedido, ignore este email.";

  return `
<!doctype html>
<html lang="pt">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:radial-gradient(circle at 15% 10%,#dbeafe 0%,#edf2f7 45%,#f8fafc 100%);padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe4ee;border-radius:18px;overflow:hidden;box-shadow:0 12px 34px rgba(15,23,42,.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f766e 0%,#155e75 55%,#1d4ed8 100%);padding:22px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${safeLogo}" alt="IPIZ" width="54" height="54" style="display:block;border-radius:12px;background:#ffffff;padding:6px;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <p style="margin:0;color:#e2e8f0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Instituto Politecnico Industrial do Zango</p>
                      <p style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.2;">GIVA IPIZ</p>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <span style="display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.32);border-radius:999px;padding:7px 12px;color:#f8fafc;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${badge}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f172a;">${title}</h1>
                <p style="margin:0;font-size:15px;line-height:1.65;color:#334155;">${intro}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px 10px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                  <tr>
                    <td>
                      <a href="${safeLink}" style="display:inline-block;background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 20px;">${cta}</a>
                    </td>
                    <td align="right">
                      <span style="display:inline-block;width:40px;height:40px;border-radius:999px;background:#e2e8f0;text-align:center;line-height:40px;font-size:18px;">👤</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 24px;">
                <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.6;">Se o botao nao funcionar, copie e cole este link no navegador:</p>
                <p style="margin:0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;word-break:break-all;font-size:12px;line-height:1.5;color:#0f172a;">${safeLink}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">${helper}</p>
              </td>
            </tr>

            <tr>
              <td style="border-top:1px solid #e2e8f0;padding:18px 24px;background:#f8fafc;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  © ${new Date().getFullYear()} IPIZ - GIVA.
                  ${safeAppUrl ? ` <a href="${safeAppUrl}" style="color:#0f766e;text-decoration:none;">Portal institucional</a>.` : ""}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

async function sendResendEmailWithRetry(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}, apiKey: string, timeoutMs: number) {
  const maxAttempts = 3;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("provider-timeout"), timeoutMs);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (response.ok) {
        clearTimeout(timeoutId);
        return { ok: true, status: response.status, body: await response.text() };
      }

      lastStatus = response.status;
      try {
        lastBody = await response.text();
      } catch {
        lastBody = "";
      }

      clearTimeout(timeoutId);

      if (!isRetryableStatus(lastStatus)) {
        return { ok: false, status: lastStatus, body: lastBody };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      const message = String((error as Error)?.message ?? error ?? "Network error");
      const aborted = message.toLowerCase().includes("abort") || message.toLowerCase().includes("timeout");
      lastStatus = aborted ? 504 : 502;
      lastBody = message;
    }

    if (attempt < maxAttempts) {
      const delayMs = 600 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { ok: false, status: lastStatus, body: lastBody };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = resolveCorsOrigin(origin, allowedOrigins);
  const corsHeaders = getCorsHeaders(allowOrigin);

  if (origin && allowOrigin === null) {
    return jsonResponse({ ok: false, error: "Origin not allowed" }, 403, corsHeaders);
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405, {
      ...corsHeaders,
      "Allow": "POST, OPTIONS",
    });
  }

  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ ok: false, error: "Payload too large" }, 413, corsHeaders);
    }
  }

  const contentType = String(req.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Invalid content type" }, 415, corsHeaders);
  }

  const rateLimitMaxRequests = getEnvInt("EMAIL_RATE_LIMIT_MAX_REQUESTS", 5, 1, 100);
  const rateLimitWindowMs = getEnvInt("EMAIL_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000, 5000, 24 * 60 * 60 * 1000);
  const idempotencyTtlMs = getEnvInt("EMAIL_IDEMPOTENCY_TTL_MS", 10 * 60 * 1000, 1000, 24 * 60 * 60 * 1000);
  const providerTimeoutMs = getEnvInt("EMAIL_PROVIDER_TIMEOUT_MS", 10_000, 1000, 120_000);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const appUrl = normalizeBaseUrl(Deno.env.get("APP_URL") ?? "");
  // Força sempre o logo institucional local
  const logoUrl = appUrl ? `${appUrl}/images/logo.png` : "https://www.ipiz-giva.com/images/logo.png";
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "no-reply@ipiz-giva.com";
  const fromDisplayName = Deno.env.get("EMAIL_FROM_NAME") ?? "IPIZ GIVA";
  const from = fromAddress.includes("<") ? fromAddress : `${fromDisplayName} <${fromAddress}>`;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return jsonResponse({ ok: false, error: "Missing required environment variables" }, 500, corsHeaders);
  }

  let reservedIdempotencyKey = "";
  const nowMs = Date.now();

  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400, corsHeaders);
    }

    if (!isPlainRecord(payload)) {
      return jsonResponse({ ok: false, error: "Invalid request payload" }, 400, corsHeaders);
    }

    const email = String(payload?.email ?? "").trim().toLowerCase();
    const purpose = normalizePurpose(payload?.purpose ?? payload?.template);
    const redirectRaw = String(payload?.redirectTo ?? appUrl).trim();
    const createUserPayload = isPlainRecord(payload?.createUser) ? payload.createUser : null;
    const requestId = String(req.headers.get("x-request-id") ?? crypto.randomUUID());
    const idempotencyKey = String(req.headers.get("x-idempotency-key") ?? "").trim();

    if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
      return jsonResponse({ ok: false, error: "Invalid idempotency key", requestId }, 400, corsHeaders);
    }

    let redirectTo = appUrl;
    if (redirectRaw) {
      try {
        const parsedRedirect = new URL(redirectRaw);
        const isAllowedProtocol = ["https:", "http:"].includes(parsedRedirect.protocol);
        const allowedOriginsSet = new Set<string>([
          ...allowedOrigins,
          ...(appUrl ? [new URL(appUrl).origin] : []),
        ]);
        if (isAllowedProtocol && (allowedOriginsSet.size === 0 || allowedOriginsSet.has(parsedRedirect.origin))) {
          redirectTo = redirectRaw;
        }
      } catch {
        // fallback para appUrl
      }
    }

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: "Invalid email", requestId }, 400, corsHeaders);
    }

    cleanupStores(nowMs, rateLimitWindowMs);

    const clientIp = String(req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const rateLimitKey = `${origin ?? "no-origin"}|${clientIp}|${email}`;
    const rateLimitResult = hitRateLimit({
      key: rateLimitKey,
      nowMs,
      maxRequests: rateLimitMaxRequests,
      windowMs: rateLimitWindowMs,
    });

    if (!rateLimitResult.allowed) {
      return jsonResponse({
        ok: false,
        error: "Too many requests",
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        requestId,
      }, 429, {
        ...corsHeaders,
        "Retry-After": String(rateLimitResult.retryAfterSeconds),
      });
    }

    if (idempotencyKey) {
      const reservation = reserveIdempotencyKey({ key: idempotencyKey, nowMs });
      if (!reservation.accepted) {
        return jsonResponse({
          ok: true,
          duplicate: true,
          inProgress: reservation.inProgress,
          requestId,
        }, 202, corsHeaders);
      }
      reservedIdempotencyKey = idempotencyKey;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (purpose === PURPOSE_ACTIVATION && createUserPayload?.password) {
      const rawPassword = String(createUserPayload.password ?? "");
      if (rawPassword.length < 8) {
        releaseIdempotencyKey(idempotencyKey, false, nowMs, idempotencyTtlMs);
        return jsonResponse({ ok: false, error: "Password must have at least 8 characters", requestId }, 400, corsHeaders);
      }

      const metadata = isPlainRecord(createUserPayload?.metadata) ? createUserPayload.metadata : {};
      const appMetadata = isPlainRecord(createUserPayload?.appMetadata) ? createUserPayload.appMetadata : {};

      const createUserResponse = await admin.auth.admin.createUser({
        email,
        password: rawPassword,
        email_confirm: false,
        user_metadata: metadata,
        app_metadata: appMetadata,
      });

      const createUserErrorMessage = String(createUserResponse.error?.message ?? "").toLowerCase();
      const userAlreadyExists = createUserErrorMessage.includes("already") || createUserErrorMessage.includes("registered");
      if (createUserResponse.error && !userAlreadyExists) {
        releaseIdempotencyKey(idempotencyKey, false, nowMs, idempotencyTtlMs);
        return jsonResponse({
          ok: false,
          error: "Failed to create auth user",
          requestId,
        }, 502, corsHeaders);
      }
    }

    const initialLinkType = purpose === PURPOSE_PASSWORD_RESET ? "recovery" : "magiclink";
    const linkResponse = await admin.auth.admin.generateLink({
      type: initialLinkType,
      email,
      options: {
        redirectTo,
      },
    });

    let linkData = linkResponse.data;
    let linkError = linkResponse.error;

    if (linkError || !linkData?.properties?.action_link) {
      releaseIdempotencyKey(idempotencyKey, false, nowMs, idempotencyTtlMs);
      return jsonResponse({ ok: false, error: "Failed to generate auth link", requestId }, 502, corsHeaders);
    }

    const actionLink = String(linkData.properties.action_link);
    const subject = purpose === PURPOSE_PASSWORD_RESET
      ? "IPIZ GIVA - Recuperacao de palavra-passe"
      : "IPIZ GIVA - Conta criada com sucesso";

    const html = buildEmailHtml({ purpose, actionLink, logoUrl, appUrl });
    const text = buildEmailText({ purpose, actionLink });

    const resendResult = await sendResendEmailWithRetry({
      from,
      to: [email],
      subject,
      html,
      text,
    }, resendApiKey, providerTimeoutMs);

    if (!resendResult.ok) {
      releaseIdempotencyKey(idempotencyKey, false, nowMs, idempotencyTtlMs);
      console.error("[send-account-email] provider dispatch failure", {
        requestId,
        status: resendResult.status,
        bodyPreview: String(resendResult.body ?? "").slice(0, 300),
      });
      return jsonResponse({
        ok: false,
        error: "Failed to dispatch email",
        providerStatus: resendResult.status,
        requestId,
      }, 502, corsHeaders);
    }

    releaseIdempotencyKey(idempotencyKey, true, nowMs, idempotencyTtlMs);

    return jsonResponse({
      ok: true,
      queued: true,
      requestId,
      user: createUserPayload ? { email } : null,
    }, 200, corsHeaders);
  } catch (error) {
    releaseIdempotencyKey(reservedIdempotencyKey, false, nowMs, idempotencyTtlMs);
    console.error("[send-account-email] unexpected error", error);
    return jsonResponse({
      ok: false,
      error: "Unexpected error while sending email",
    }, 500, corsHeaders);
  }
});
