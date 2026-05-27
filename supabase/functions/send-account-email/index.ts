import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const PURPOSE_ACTIVATION = "activation";
const PURPOSE_PASSWORD_RESET = "password-reset";

function getAllowedOrigins() {
  const raw = Deno.env.get("EMAIL_ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCorsHeaders(origin: string | null) {
  const allowed = getAllowedOrigins();
  const allowOrigin = allowed.length === 0
    ? "*"
    : origin && allowed.includes(origin)
      ? origin
      : allowed[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
    "Content-Type": "application/json",
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
    "ATIVACAO DE CONTA",
    "",
    "A sua conta no GIVA esta quase pronta.",
    "",
    `Ativar conta: ${params.actionLink}`,
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
    : "Ativacao de conta";

  const intro = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Recebemos um pedido para redefinir a sua palavra-passe no GIVA."
    : "A sua conta no GIVA esta quase pronta. Confirme o acesso no botao abaixo.";

  const cta = params.purpose === PURPOSE_PASSWORD_RESET
    ? "Redefinir palavra-passe"
    : "Ativar conta";

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
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);padding:22px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${safeLogo}" alt="IPIZ" width="52" height="52" style="display:block;border-radius:10px;background:#ffffff;padding:6px;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <p style="margin:0;color:#e2e8f0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Instituto Politecnico Industrial de Luanda</p>
                      <p style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700;line-height:1.2;">GIVA IPIZ</p>
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
              <td style="padding:24px;">
                <a href="${safeLink}" style="display:inline-block;background:#0f766e;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 20px;">${cta}</a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 24px;">
                <p style="margin:0 0 12px;font-size:13px;color:#64748b;line-height:1.6;">Se o botao nao funcionar, copie e cole este link no navegador:</p>
                <p style="margin:0;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;word-break:break-all;font-size:12px;line-height:1.5;color:#0f172a;">${safeLink}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 24px;">
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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const appUrlRaw = Deno.env.get("APP_URL") ?? "";
  const appUrl = appUrlRaw.replace(/\/$/, "");
  const logoUrl = Deno.env.get("EMAIL_LOGO_URL") ?? (appUrl ? `${appUrl}/images/logo.png` : "https://www.ipiz-giva.com/images/logo.png");
  const fromAddress = Deno.env.get("EMAIL_FROM") ?? "no-reply@ipiz-giva.com";
  const fromDisplayName = Deno.env.get("EMAIL_FROM_NAME") ?? "IPIZ GIVA";
  const from = fromAddress.includes("<") ? fromAddress : `${fromDisplayName} <${fromAddress}>`;

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return new Response(JSON.stringify({ error: "Missing required environment variables" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  try {
    const payload = await req.json();
    const email = String(payload?.email ?? "").trim().toLowerCase();
    const redirectTo = String(payload?.redirectTo ?? appUrl).trim();
    const purpose = normalizePurpose(payload?.purpose ?? payload?.template);

    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    const actionLink = String(linkData.properties.action_link);
    const subject = purpose === PURPOSE_PASSWORD_RESET
      ? "IPIZ GIVA - Recuperacao de palavra-passe"
      : "IPIZ GIVA - Ativacao de conta";

    const html = buildEmailHtml({ purpose, actionLink, logoUrl, appUrl });
    const text = buildEmailText({ purpose, actionLink });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text,
      }),
    });

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({ ok: true, queued: true }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (_error) {
    return new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 200,
      headers: corsHeaders,
    });
  }
});
