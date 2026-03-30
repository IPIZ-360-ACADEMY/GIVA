import { useState } from "react";
import { useOutletContext } from "react-router-dom";

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
  const [security, setSecurity] = useState(readStoredSecurity);

  function submitSecurity(event) {
    event.preventDefault();
    localStorage.setItem("giva.settings.security", JSON.stringify(security));
    showToast(t("settings.security.saved"));
  }

  return (
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
          <button className="btn primary" type="submit">
            {t("settings.security.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
