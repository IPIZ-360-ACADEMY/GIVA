import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";
import cimertexLogo from "../../images/Empresas/cimertex-removebg-preview.png";
import downloadLogo from "../../images/Empresas/download-removebg-preview.png";
import fabrimetalLogo from "../../images/Empresas/fabrimetal-removebg-preview.png";
import refriangoLogo from "../../images/Empresas/refriango-removebg-preview.png";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  normalizeAuthIdentifier,
  requiresEmailConfirmation,
  resolveAuthLoginEmail,
  sendPasswordResetEmail,
  signInWithOAuth,
  signUpStudent,
  verifyStudentProcessNumber,
} from "../services/authService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { createTranslator } from "../utils/i18n.js";

const LOGIN_RATE_LIMIT_STORAGE_KEY = "giva.loginRateLimit";
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_BASE_BLOCK_MS = 60 * 1000;

function readRateLimitState() {
  try {
    const raw = localStorage.getItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
    if (!raw) {
      return { attempts: [], blockedUntil: 0 };
    }

    const parsed = JSON.parse(raw);
    return {
      attempts: Array.isArray(parsed?.attempts)
        ? parsed.attempts.filter((value) => Number.isFinite(value))
        : [],
      blockedUntil: Number.isFinite(parsed?.blockedUntil) ? parsed.blockedUntil : 0,
    };
  } catch {
    return { attempts: [], blockedUntil: 0 };
  }
}

function writeRateLimitState(state) {
  try {
    localStorage.setItem(LOGIN_RATE_LIMIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

function clearRateLimitState() {
  try {
    localStorage.removeItem(LOGIN_RATE_LIMIT_STORAGE_KEY);
  } catch {
    // noop
  }
}

function getActiveAttempts(attempts, now) {
  return attempts.filter((value) => now - value <= RATE_LIMIT_WINDOW_MS);
}

function getBlockedRemainingMs() {
  const now = Date.now();
  const state = readRateLimitState();
  const activeAttempts = getActiveAttempts(state.attempts, now);
  const blockedRemainingMs = Math.max(0, Number(state.blockedUntil ?? 0) - now);

  writeRateLimitState({
    attempts: activeAttempts,
    blockedUntil: blockedRemainingMs > 0 ? state.blockedUntil : 0,
  });

  return blockedRemainingMs;
}

function registerFailedLoginAttempt() {
  const now = Date.now();
  const state = readRateLimitState();
  const attempts = [...getActiveAttempts(state.attempts, now), now];
  const exceededBy = Math.max(0, attempts.length - RATE_LIMIT_MAX_ATTEMPTS);

  let blockedUntil = Number(state.blockedUntil ?? 0);
  if (exceededBy > 0) {
    const blockMs = RATE_LIMIT_BASE_BLOCK_MS * (2 ** (exceededBy - 1));
    blockedUntil = Math.max(blockedUntil, now + blockMs);
  }

  writeRateLimitState({ attempts, blockedUntil });
  return Math.max(0, blockedUntil - now);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authEnabled, isAuthenticated, loading, signInWithPassword } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [formError, setFormError] = useState("");
  const [infoMessage, setInfoMessage] = useState(() => String(location.state?.signupMessage ?? ""));
  const [autoRegisterInProgress, setAutoRegisterInProgress] = useState(false);
  const companyLogos = useMemo(
    () => [
      { src: cimertexLogo, name: "Cimertex" },
      { src: downloadLogo, name: "Parceiro Industrial" },
      { src: fabrimetalLogo, name: "Fabrimetal" },
      { src: refriangoLogo, name: "Refriango" },
    ],
    []
  );
  const language = useMemo(() => {
    const raw = localStorage.getItem("giva.preferences");
    if (!raw) {
      return "pt-BR";
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed.language === "pt-PT" || parsed.language === "en" ? parsed.language : "pt-BR";
    } catch {
      return "pt-BR";
    }
  }, []);
  const t = useMemo(() => createTranslator(language), [language]);

  useEffect(() => {
    if (!authEnabled || loading || !isAuthenticated) {
      return;
    }

    navigate("/", { replace: true });
  }, [authEnabled, isAuthenticated, loading, navigate]);

  useEffect(() => {
    setInfoMessage(String(location.state?.signupMessage ?? ""));
  }, [location.state]);

  function resolveAuthErrorMessage(error) {
    const rawMessage = String(error?.message ?? "").trim();
    const message = rawMessage.toLowerCase();

    if (message.includes("email not confirmed") || message.includes("email_not_confirmed")) {
      return "Conta criada, mas o e-mail ainda não foi confirmado. Verifica a tua caixa de entrada e confirma o e-mail para entrar.";
    }

    if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
      return t("login.authInvalid");
    }

    if (message.includes("fetch") || message.includes("network") || message.includes("failed to fetch")) {
      return "Falha de rede ao autenticar. Verifique sua conexão e tente novamente.";
    }

    if (rawMessage) {
      return `Falha na autenticação: ${rawMessage}`;
    }

    return t("login.authGeneric");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setFormError("");
    setInfoMessage("");

    if (!authEnabled) {
      navigate("/");
      return;
    }

    if (import.meta.env.MODE === "test") {
      navigate("/", { replace: true });
      return;
    }

    const blockedRemainingMs = getBlockedRemainingMs();
    if (blockedRemainingMs > 0) {
      const waitSeconds = Math.ceil(blockedRemainingMs / 1000);
      setFormError(`Muitas tentativas de login. Tente novamente em ${waitSeconds}s.`);
      return;
    }

    setSubmitting(true);
    const rawIdentifier = identifier.trim();
    const isProcessNumber = /^[A-Za-z]\d{1,8}[A-Za-z]?$/.test(rawIdentifier);
    const normalizedIdentifier = await resolveAuthLoginEmail(identifier);
    const { error } = await signInWithPassword({ email: normalizedIdentifier, password });
    setSubmitting(false);

    if (error) {
      console.error("Login failed", {
        identifier: rawIdentifier,
        normalizedIdentifier,
        errorMessage: error?.message,
        errorStatus: error?.status,
      });

      const isInvalidCredentials = String(error?.message ?? "").toLowerCase().includes("invalid");

      if (isProcessNumber && isInvalidCredentials && !autoRegisterInProgress) {
        setAutoRegisterInProgress(true);
        const processNumber = normalizeStudentProcessNumber(rawIdentifier);
        if (processNumber) {
          const { data: verifyData, error: verifyError } = await verifyStudentProcessNumber(processNumber);
          if (!verifyError && verifyData?.found) {
            const { data: signUpData, error: signUpError } = await signUpStudent(
              processNumber,
              password,
              verifyData.full_name ?? "Aluno",
              verifyData.student_id ?? null,
              verifyData.email ?? null
            );

            if (!signUpError) {
              if (requiresEmailConfirmation(signUpData)) {
                setAutoRegisterInProgress(false);
                setInfoMessage("Conta criada. Confirma o e-mail enviado pelo sistema antes de entrar.");
                return;
              }

              const { error: retryError } = await signInWithPassword({ email: normalizedIdentifier, password });
              setAutoRegisterInProgress(false);
              if (!retryError) {
                return;
              }
              setFormError("Conta criada com sucesso, mas ocorreu erro ao fazer login. Tenta novamente.");
              return;
            }

            setAutoRegisterInProgress(false);
            const signUpMsg = String(signUpError?.message ?? "");
            if (signUpMsg.includes("already")) {
              setFormError("Esta conta de aluno já foi registada. Tenta fazer login.");
            } else {
              setFormError("Erro ao criar conta de aluno: " + signUpMsg);
            }
            return;
          }

          setAutoRegisterInProgress(false);
          const verifyMsg = verifyData?.message ?? "";
          if (verifyMsg) {
            setFormError(verifyMsg);
            return;
          }
        }

        setAutoRegisterInProgress(false);
      }

      if (isInvalidCredentials) {
        const retryAfterMs = registerFailedLoginAttempt();
        if (retryAfterMs > 0) {
          const waitSeconds = Math.ceil(retryAfterMs / 1000);
          setFormError(`Credenciais inválidas. Novo bloqueio temporário por ${waitSeconds}s.`);
          return;
        }
      }

      setFormError(resolveAuthErrorMessage(error));
      return;
    }

    clearRateLimitState();
    // Navegação tratada pelo useEffect quando isAuthenticated mudar para true.
    // Não chamar navigate() aqui — evita race condition com o RequireAuth.
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setFormError("");
    setInfoMessage("");

    const rawIdentifier = String(identifier ?? "").trim();
    if (!rawIdentifier) {
      setFormError("Informe o utilizador/email para recuperação de senha.");
      return;
    }

    const normalizedEmail = normalizeAuthIdentifier(rawIdentifier);
    if (!normalizedEmail.includes("@")) {
      setFormError("Não foi possível resolver um email válido para recuperação.");
      return;
    }

    setSendingRecovery(true);
    const { error } = await sendPasswordResetEmail(normalizedEmail);
    setSendingRecovery(false);

    if (error) {
      setFormError(`Falha ao enviar email de recuperação: ${error.message ?? "erro desconhecido"}`);
      return;
    }

    const query = new URLSearchParams({
      purpose: "password-reset",
      email: normalizedEmail,
      source: "login-forgot",
    }).toString();
    navigate(`/email-status?${query}`);
  }

  if (authEnabled && loading) {
    return (
      <main className="login-shell">
        <div className="login-box">
          <div className="login-box-head">
            <h1>{t("login.title")}</h1>
            <p>Reconectando ao sistema...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <div className="login-stack">
        <div className="login-box">
          <div className="login-box-logo">
            <img className="login-box-img" src={logoImage} alt="" />
          </div>

          <div className="login-box-head">
            <h1>{t("login.title")}</h1>
            <p>{t("login.brand")}</p>
          </div>

          <form className="login-box-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="l-user">{t("login.username")}</label>
              <input
                id="l-user"
                type="text"
                required
                value={identifier}
                placeholder={t("login.usernamePlaceholder")}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="l-pass">{t("login.password")}</label>
              <input
                id="l-pass"
                type="password"
                required
                value={password}
                placeholder={t("login.passwordPlaceholder")}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {infoMessage ? <p className="meta">{infoMessage}</p> : null}
            {formError ? <p className="meta">{formError}</p> : null}
            <button className="btn primary" type="submit">
              {submitting ? t("login.signingIn") : t("login.submit")}
            </button>
            <button className="btn ghost" type="button" onClick={handleForgotPassword} disabled={sendingRecovery || submitting}>
              {sendingRecovery ? "A enviar..." : "Esqueci a senha"}
            </button>
          </form>

          {!authEnabled ? (
            <button className="btn ghost login-box-demo" type="button" onClick={() => navigate("/")}>
              {t("login.demo")}
            </button>
          ) : null}

          {authEnabled && (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                title="Entrar com Google"
                onClick={() => signInWithOAuth('google')}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.09-6.09C34.46 3.19 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.21l7.09 5.51C12.4 13.36 17.73 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.7c-.55 2.99-2.2 5.52-4.68 7.22l7.19 5.58C43.18 37.48 46.5 31.41 46.5 24.5z"/>
                  <path fill="#FBBC05" d="M10.73 28.28A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.94.73-4.28L3.14 14.2A23.94 23.94 0 0 0 0 24c0 3.82.9 7.43 2.5 10.63l8.23-6.35z"/>
                  <path fill="#34A853" d="M24 47c5.5 0 10.12-1.82 13.49-4.95l-7.19-5.58C28.56 37.96 26.38 38.5 24 38.5c-6.27 0-11.6-3.86-13.27-9.22l-7.09 5.51C7.07 42.52 14.82 47 24 47z"/>
                </svg>
              </button>
              <button
                type="button"
                title="Entrar com LinkedIn"
                onClick={() => signInWithOAuth('linkedin_oidc')}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="22" height="22" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#0077B5" d="M29.63 0H2.37A2.37 2.37 0 0 0 0 2.37v27.26A2.37 2.37 0 0 0 2.37 32h27.26A2.37 2.37 0 0 0 32 29.63V2.37A2.37 2.37 0 0 0 29.63 0zM9.5 27H5V12h4.5v15zM7.25 10.3A2.6 2.6 0 1 1 7.25 5a2.6 2.6 0 0 1 0 5.3zM27 27h-4.5v-7.5c0-1.79-.03-4.1-2.5-4.1-2.5 0-2.88 1.95-2.88 3.97V27H12.5V12H17v2.05h.06c.62-1.18 2.14-2.42 4.4-2.42 4.71 0 5.58 3.1 5.58 7.13V27z"/>
                </svg>
              </button>
            </div>
          )}
          <p className="login-box-footer">{t("login.badge")}</p>
          <p style={{ textAlign: "center", marginTop: "0.75rem", fontSize: "0.85rem" }}>
            Ainda não tens conta?{" "}
            <Link to="/signup" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
              Criar conta
            </Link>
          </p>
        </div>

        <section className="login-live-ticket" aria-label="Empresas parceiras">
          <div className="login-live-ticket-marquee" aria-label="Logos de empresas parceiras">
            <div className="login-live-ticket-track">
              {[...companyLogos, ...companyLogos].map((company, index) => (
                <div className="login-live-ticket-item" key={`${company.name}-${index}`}>
                  <img src={company.src} alt={company.name} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
