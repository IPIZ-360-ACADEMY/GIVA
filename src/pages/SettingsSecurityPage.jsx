import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAuthEnabled, updateUserPassword } from "../services/authService.js";

function normalizeTwoFactor(value) {
  if (value === "Ativada" || value === "on" || value === true) {
    return "on";
  }
  if (value === "Desativada" || value === "off" || value === false) {
    return "off";
  }
  return "on";
}

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
    twoFactor: "on",
    sessionTimeout: "30"
  };

  const raw = localStorage.getItem("giva.settings.security");
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      twoFactor: normalizeTwoFactor(parsed.twoFactor),
      sessionTimeout: normalizeTimeout(parsed.sessionTimeout)
    };
  } catch {
    return fallback;
  }
}

export default function SettingsSecurityPage() {
  const { showToast, t } = useOutletContext();
  const { user, authProfile } = useAuth();
  const [security, setSecurity] = useState(readStoredSecurity);
  const [passwords, setPasswords] = useState({ newPassword: "", confirmPassword: "" });
  const [submittingSecurity, setSubmittingSecurity] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  function submitSecurity(event) {
    event.preventDefault();
    localStorage.setItem("giva.settings.security", JSON.stringify(security));
    showToast(t("settings.security.saved"));
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
              <label htmlFor="cfg-2fa">{t("settings.security.twoFactor")}</label>
              <select
                id="cfg-2fa"
                value={security.twoFactor}
                onChange={(event) => setSecurity((prev) => ({ ...prev, twoFactor: event.target.value }))}
              >
                <option value="on">{t("settings.security.on")}</option>
                <option value="off">{t("settings.security.off")}</option>
              </select>
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
