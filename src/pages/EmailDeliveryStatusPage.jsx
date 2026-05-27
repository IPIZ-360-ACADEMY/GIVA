import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  sendAccountActivationEmail,
  sendPasswordResetEmail,
} from "../services/authService.js";
import "../styles/auth-email-status.css";

const PURPOSE_ACTIVATION = "activation";
const PURPOSE_PASSWORD_RESET = "password-reset";
const RESEND_COOLDOWN_SECONDS = 30;

function normalizePurpose(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === PURPOSE_PASSWORD_RESET) {
    return PURPOSE_PASSWORD_RESET;
  }
  return PURPOSE_ACTIVATION;
}

function maskEmail(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) {
    return "";
  }

  const [localPart, domain] = normalized.split("@");
  if (!localPart || !domain) {
    return "";
  }

  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.length > 4 ? localPart.slice(-1) : "";
  const stars = "*".repeat(Math.max(2, localPart.length - (visibleStart.length + visibleEnd.length)));
  return `${visibleStart}${stars}${visibleEnd}@${domain}`;
}

export default function EmailDeliveryStatusPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [resendAllowedAt, setResendAllowedAt] = useState(0);

  const purpose = useMemo(
    () => normalizePurpose(searchParams.get("purpose")),
    [searchParams]
  );
  const rawEmail = useMemo(() => String(searchParams.get("email") ?? "").trim().toLowerCase(), [searchParams]);
  const source = useMemo(() => String(searchParams.get("source") ?? "").trim(), [searchParams]);
  const maskedEmail = useMemo(() => maskEmail(rawEmail), [rawEmail]);

  const now = Date.now();
  const remainingSeconds = Math.max(0, Math.ceil((resendAllowedAt - now) / 1000));
  const canResend = Boolean(rawEmail) && remainingSeconds === 0 && !submitting;

  const heroTitle = purpose === PURPOSE_PASSWORD_RESET
    ? "Email de recuperação enviado"
    : "Confirmação de conta enviada";

  const heroText = purpose === PURPOSE_PASSWORD_RESET
    ? "Enviámos um link para redefinires a tua senha com segurança."
    : "Enviámos um link para ativares a tua conta e concluir o acesso.";

  const stepTwo = purpose === PURPOSE_PASSWORD_RESET
    ? "Abre o email e clica no botão para criar uma nova senha."
    : "Abre o email e confirma a tua conta no botão de ativação.";

  async function handleResend() {
    if (!canResend) {
      return;
    }

    setError("");
    setFeedback("");
    setSubmitting(true);

    const sendFn = purpose === PURPOSE_PASSWORD_RESET
      ? sendPasswordResetEmail
      : sendAccountActivationEmail;

    const { error: sendError } = await sendFn(rawEmail);
    setSubmitting(false);

    if (sendError) {
      setError(`Não foi possível reenviar o email: ${sendError.message ?? "erro desconhecido"}`);
      return;
    }

    setResendAllowedAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    setFeedback("Reenvio concluído. Verifica caixa de entrada e spam.");
  }

  return (
    <main className="email-status-shell">
      <section className="email-status-card" aria-live="polite">
        <header className="email-status-head">
          <span className="material-icons-sharp email-status-icon">mark_email_read</span>
          <h1>{heroTitle}</h1>
          <p>{heroText}</p>
        </header>

        <div className="email-status-highlight">
          <strong>Destino</strong>
          <span>{maskedEmail || "Email não informado"}</span>
          {source ? <small>Origem: {source}</small> : null}
        </div>

        <ol className="email-status-steps">
          <li>Verifica a caixa de entrada e também a pasta de spam.</li>
          <li>{stepTwo}</li>
          <li>Depois, regressa ao login para entrar no sistema.</li>
        </ol>

        {feedback ? <p className="email-status-feedback success">{feedback}</p> : null}
        {error ? <p className="email-status-feedback error">{error}</p> : null}

        <div className="email-status-actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => navigate("/login")}
          >
            Ir para login
          </button>

          <button
            type="button"
            className="btn ghost"
            onClick={handleResend}
            disabled={!canResend}
          >
            {submitting
              ? "A reenviar..."
              : remainingSeconds > 0
                ? `Reenviar em ${remainingSeconds}s`
                : "Reenviar email"}
          </button>
        </div>

        <p className="email-status-help">
          O link pode expirar. Se isso acontecer, pede um novo envio nesta página.
        </p>

        <p className="email-status-footer">
          Precisas de ajuda? <Link to="/signup">Voltar ao registo</Link>
        </p>
      </section>
    </main>
  );
}
