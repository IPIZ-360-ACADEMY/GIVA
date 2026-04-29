import { useOutletContext } from "react-router-dom";

export default function SettingsPreferencesPage() {
  const { preferences, updatePreferences, showToast, t } = useOutletContext();

  function savePreferences(event) {
    event.preventDefault();
    showToast(t("settings.preferences.saved"));
  }

  return (
    <section className="form-card">
      <h3>{t("settings.preferences.title")}</h3>
      <form onSubmit={savePreferences}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="cfg-language">{t("settings.preferences.language")}</label>
            <select
              id="cfg-language"
              value={preferences.language}
              onChange={(event) => updatePreferences({ language: event.target.value })}
            >
              <option value="pt-BR">{t("settings.preferences.lang.ptBR")}</option>
              <option value="pt-PT">{t("settings.preferences.lang.ptPT")}</option>
              <option value="en">{t("settings.preferences.lang.en")}</option>
            </select>
            <p className="meta">{t("settings.preferences.languageHelp")}</p>
          </div>

          <div className="form-field">
            <label htmlFor="cfg-density">{t("settings.preferences.density")}</label>
            <select
              id="cfg-density"
              value={preferences.density}
              onChange={(event) => updatePreferences({ density: event.target.value })}
            >
              <option value="comfortable">{t("settings.preferences.density.comfortable")}</option>
              <option value="compact">{t("settings.preferences.density.compact")}</option>
            </select>
            <p className="meta">{t("settings.preferences.densityHelp")}</p>
          </div>
        </div>

        <div className="settings-toggle-row">
          <div>
            <strong>{t("settings.preferences.notificationsTitle")}</strong>
            <p className="meta">{t("settings.preferences.notificationsDesc")}</p>
          </div>
          <button
            type="button"
            className={`settings-switch ${preferences.uiNotifications ? "active" : ""}`}
            aria-pressed={preferences.uiNotifications}
            onClick={() => updatePreferences({ uiNotifications: !preferences.uiNotifications })}
          >
            <span>{preferences.uiNotifications ? t("settings.preferences.enabled") : t("settings.preferences.disabled")}</span>
          </button>
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit">
            {t("settings.preferences.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
