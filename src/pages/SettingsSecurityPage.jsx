import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  enrollMfaTotp,
  getMfaAuthenticatorAssuranceLevel,
  isAuthEnabled,
  listMfaFactors,
  unenrollMfaFactor,
  updateUserPassword,
  verifyMfaTotpCode,
} from "../services/authService.js";

function normalizeTimeout(value) {
  if (value === "15" || value === "15 minutos") {
    return "15";
  }
  if (value === "60" || value === "60 minutos") {
    return "60";
  }
  return "30";
}

function readStoredSecurity() {
  const fallback = {
    sessionTimeout: "30"
  };

  const raw = localStorage.getItem("giva.settings.security");
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      sessionTimeout: normalizeTimeout(parsed.sessionTimeout)
    };
  } catch {
    return fallback;
  }
}

function toQrDataUrl(value) {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (raw.startsWith("data:image")) return raw;
  return `data:image/svg+xml;utf8,${encodeURIComponent(raw)}`;
}

export default function SettingsSecurityPage() {
  const { showToast, t } = useOutletContext();
  const { user, authProfile } = useAuth();
  const [security, setSecurity] = useState(readStoredSecurity);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [submittingSecurity, setSubmittingSecurity] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaState, setMfaState] = useState({ currentLevel: null, nextLevel: null, totpFactors: [] });
  const [enrollment, setEnrollment] = useState(null);

  const primaryTotpFactor = useMemo(() => {
    const factors = Array.isArray(mfaState.totpFactors) ? mfaState.totpFactors : [];
    return factors.find((factor) => factor?.status === "verified") || factors[0] || null;
  }, [mfaState.totpFactors]);

  const hasMfaEnabled = Boolean(primaryTotpFactor);
  const mfaNeedsChallenge = mfaState.currentLevel === "aal1" && mfaState.nextLevel === "aal2";

  const loadMfaState = useCallback(async () => {
    if (!isAuthEnabled() || !user) {
      setMfaState({ currentLevel: null, nextLevel: null, totpFactors: [] });
      return;
    }

    setMfaLoading(true);
    setMfaError("");

    const [{ data: aalData, error: aalError }, { data: factorsData, error: factorsError }] = await Promise.all([
      getMfaAuthenticatorAssuranceLevel(),
      listMfaFactors(),
    ]);

    setMfaLoading(false);

    if (aalError || factorsError) {
      setMfaError(aalError?.message || factorsError?.message || "Não foi possível carregar o estado do MFA.");
      return;
    }

    setMfaState({
      currentLevel: aalData?.currentLevel ?? null,
      nextLevel: aalData?.nextLevel ?? null,
      totpFactors: Array.isArray(factorsData?.totp) ? factorsData.totp : [],
    });
  }, [user]);

  useEffect(() => {
    void loadMfaState();
  }, [loadMfaState]);

  function submitSecurity(event) {
    event.preventDefault();
    setSubmittingSecurity(true);
    localStorage.setItem("giva.settings.security", JSON.stringify(security));
    setSubmittingSecurity(false);
    showToast(t("settings.security.saved"));
  }

  async function handleStartMfaEnrollment() {
    setMfaBusy(true);
    setMfaError("");
    const { data, error } = await enrollMfaTotp("GIVA Authenticator");
    setMfaBusy(false);

    if (error) {
      setMfaError(error.message || "Não foi possível iniciar o MFA.");
      return;
    }

    setEnrollment({
      factorId: data.id,
      qrCode: toQrDataUrl(data?.totp?.qr_code),
      secret: data?.totp?.secret ?? "",
      uri: data?.totp?.uri ?? "",
    });
    setMfaCode("");
  }

  async function handleVerifyEnrollment(event) {
    event.preventDefault();
    if (!enrollment?.factorId) return;

    setMfaBusy(true);
    setMfaError("");
    const { error } = await verifyMfaTotpCode({ factorId: enrollment.factorId, code: mfaCode });
    setMfaBusy(false);

    if (error) {
      setMfaError(error.message || "Não foi possível validar o código MFA.");
      return;
    }

    showToast("Autenticação de dois fatores ativada com sucesso.");
    setEnrollment(null);
    setMfaCode("");
    await loadMfaState();
  }

  async function handleDisableMfa() {
    if (!primaryTotpFactor?.id) return;

    setMfaBusy(true);
    setMfaError("");
    const { error } = await unenrollMfaFactor(primaryTotpFactor.id);
    setMfaBusy(false);

    if (error) {
      setMfaError(error.message || "Não foi possível desativar o MFA.");
      return;
    }

    showToast("Autenticação de dois fatores desativada.");
    setEnrollment(null);
    setMfaCode("");
    await loadMfaState();
  }

  async function submitPasswordChange(event) {
    event.preventDefault();

    if (passwords.newPassword.length < 8) {
      showToast(t("settings.security.passwordMinLength") || "A password deve ter pelo menos 8 caracteres.", "error");
      return;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      showToast(t("settings.security.passwordMismatch") || "As passwords não coincidem.", "error");
      return;
    }

    if (!isAuthEnabled() || !user) {
      showToast(t("settings.security.notAvailable") || "Alteração de password requer ligação ao Supabase.", "error");
      return;
    }

    setSubmittingPassword(true);
    const { error } = await updateUserPassword(passwords.newPassword);
    setSubmittingPassword(false);

    if (error) {
      showToast(t("settings.security.passwordError") || "Erro ao alterar password.", "error");
      return;
    }

    showToast(t("settings.security.passwordSaved") || "Password alterada com sucesso.");
    setPasswords({ newPassword: "", confirmPassword: "" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {authProfile?.mustChangePassword && (
        <div
          className="panel-notice warning"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            background: "var(--color-warning-bg, #fffbeb)",
            border: "1px solid var(--color-warning, #f59e0b)",
            borderRadius: "0.5rem",
            padding: "0.85rem 1rem",
            color: "var(--color-warning-text, #92400e)",
            fontSize: "0.9rem",
          }}
        >
          <span className="material-icons-sharp" style={{ color: "var(--color-warning, #f59e0b)", flexShrink: 0 }}>
            warning
          </span>
          <p style={{ margin: 0 }}>
            <strong>Acção necessária:</strong> A sua conta requer uma nova password antes de poder aceder ao sistema.
            Por favor defina uma nova password no formulário abaixo.
          </p>
        </div>
      )}
      <section className="form-card">
        <h3>{t("settings.security.title")}</h3>
        <form onSubmit={submitSecurity}>
          <div className="form-grid">
            <div className="form-field">
              <label>{t("settings.security.twoFactor")}</label>
              <div className="panel-notice" style={{ marginTop: "0.4rem" }}>
                <strong>{hasMfaEnabled ? "Ativada" : "Desativada"}</strong>
                <div style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>
                  {hasMfaEnabled
                    ? "A conta exige o código da aplicação autenticadora nos novos logins."
                    : "Ativa um autenticador TOTP para reforçar a segurança da conta."}
                </div>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="cfg-timeout">{t("settings.security.timeout")}</label>
              <select
                id="cfg-timeout"
                value={security.sessionTimeout}
                onChange={(event) => setSecurity((prev) => ({ ...prev, sessionTimeout: event.target.value }))}
              >
                <option value="15">{t("settings.security.min15")}</option>
                <option value="30">{t("settings.security.min30")}</option>
                <option value="60">{t("settings.security.min60")}</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={submittingSecurity}>
              {t("settings.security.save")}
            </button>
          </div>
        </form>
      </section>

      {isAuthEnabled() && user && (
        <section className="form-card">
          <h3>{t("settings.security.twoFactor")}</h3>
          {mfaNeedsChallenge ? (
            <div className="panel-notice warning" style={{ marginBottom: "1rem" }}>
              Existe um fator MFA ativo, mas esta sessão ainda não foi elevada para o segundo fator. Termina a sessão e volta a entrar para validar o código TOTP.
            </div>
          ) : null}
          {mfaError ? <p className="form-error">{mfaError}</p> : null}

          {mfaLoading ? (
            <p>A carregar configuração MFA...</p>
          ) : null}

          {!mfaLoading && !hasMfaEnabled && !enrollment ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Ainda não tens um autenticador associado. Ao ativar, vais digitalizar um QR code e confirmar um código de 6 dígitos.
              </p>
              <button className="btn primary" type="button" onClick={handleStartMfaEnrollment} disabled={mfaBusy}>
                {mfaBusy ? "A preparar..." : "Ativar autenticação de dois fatores"}
              </button>
            </div>
          ) : null}

          {enrollment ? (
            <form onSubmit={handleVerifyEnrollment} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Digitaliza o QR code na tua app autenticadora e confirma o código gerado.
              </p>
              {enrollment.qrCode ? (
                <img src={enrollment.qrCode} alt="QR code MFA" style={{ maxWidth: "220px", borderRadius: "0.75rem", background: "#fff", padding: "0.75rem" }} />
              ) : null}
              {enrollment.secret ? (
                <div className="panel-notice" style={{ overflowWrap: "anywhere" }}>
                  <strong>Chave manual:</strong> {enrollment.secret}
                </div>
              ) : null}
              <div className="form-field">
                <label htmlFor="mfa-code">Código da aplicação</label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value.replace(/\s+/g, ""))}
                  placeholder="000000"
                />
              </div>
              <div className="form-actions">
                <button className="btn primary" type="submit" disabled={mfaBusy || mfaCode.trim().length < 6}>
                  {mfaBusy ? "A validar..." : "Confirmar e ativar"}
                </button>
                <button className="btn ghost" type="button" onClick={() => setEnrollment(null)} disabled={mfaBusy}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          {!mfaLoading && hasMfaEnabled ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                Fator ativo: {primaryTotpFactor?.friendly_name || "Authenticator"}
              </p>
              <div className="form-actions">
                <button className="btn ghost" type="button" onClick={() => void loadMfaState()} disabled={mfaBusy}>
                  Atualizar estado
                </button>
                <button className="btn primary" type="button" onClick={handleDisableMfa} disabled={mfaBusy}>
                  {mfaBusy ? "A desativar..." : "Desativar MFA"}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {isAuthEnabled() && user && (
        <section className="form-card">
          <h3>{t("settings.security.changePassword") || "Alterar Password"}</h3>
          <form onSubmit={submitPasswordChange}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="cfg-new-pwd">{t("settings.security.newPassword") || "Nova password"}</label>
                <input
                  id="cfg-new-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
              </div>

              <div className="form-field">
                <label htmlFor="cfg-confirm-pwd">{t("settings.security.confirmPassword") || "Confirmar password"}</label>
                <input
                  id="cfg-confirm-pwd"
                  type="password"
                  autoComplete="new-password"
                  value={passwords.confirmPassword}
                  onChange={(event) => setPasswords((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={submittingPassword || !passwords.newPassword}>
                {submittingPassword ? "..." : (t("settings.security.savePassword") || "Alterar password")}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
