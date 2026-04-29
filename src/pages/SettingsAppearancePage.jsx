import { useOutletContext } from "react-router-dom";

export default function SettingsAppearancePage() {
  const { theme, setThemeMode, preferences, updatePreferences, showToast, t } = useOutletContext();

  function changeTheme(nextTheme) {
    setThemeMode(nextTheme);
    showToast(nextTheme === "dark" ? t("settings.appearance.appliedDark") : t("settings.appearance.appliedLight"));
  }

  function changeUiStyle(nextStyle) {
    updatePreferences({ uiStyle: nextStyle });
    showToast(nextStyle === "neo" ? "Estilo visual elevado ativado." : "Estilo visual clássico ativado.");
  }

  return (
    <section className="form-card">
      <h3>{t("settings.appearance.title")}</h3>
      <p className="meta">{t("settings.appearance.description")}</p>

      <div className="settings-choice-group" role="radiogroup" aria-label={t("settings.appearance.chooseTheme")}>
        <button
          type="button"
          className={`settings-choice ${theme === "light" ? "active" : ""}`}
          onClick={() => changeTheme("light")}
          aria-pressed={theme === "light"}
        >
          <span className="material-icons-sharp" aria-hidden="true">light_mode</span>
          <strong>{t("settings.appearance.lightTitle")}</strong>
          <small>{t("settings.appearance.lightDesc")}</small>
        </button>

        <button
          type="button"
          className={`settings-choice ${theme === "dark" ? "active" : ""}`}
          onClick={() => changeTheme("dark")}
          aria-pressed={theme === "dark"}
        >
          <span className="material-icons-sharp" aria-hidden="true">dark_mode</span>
          <strong>{t("settings.appearance.darkTitle")}</strong>
          <small>{t("settings.appearance.darkDesc")}</small>
        </button>
      </div>

      <h3 style={{ marginTop: "1rem" }}>Estilo da interface</h3>
      <p className="meta">Escolha entre visual clássico e versão elevada.</p>

      <div className="settings-choice-group" role="radiogroup" aria-label="Escolha o estilo da interface">
        <button
          type="button"
          className={`settings-choice ${(preferences.uiStyle ?? "neo") === "neo" ? "active" : ""}`}
          onClick={() => changeUiStyle("neo")}
          aria-pressed={(preferences.uiStyle ?? "neo") === "neo"}
        >
          <span className="material-icons-sharp" aria-hidden="true">auto_awesome</span>
          <strong>Elevado (recomendado)</strong>
          <small>Cards e superfícies com visual mais moderno e limpo.</small>
        </button>

        <button
          type="button"
          className={`settings-choice ${(preferences.uiStyle ?? "neo") === "classic" ? "active" : ""}`}
          onClick={() => changeUiStyle("classic")}
          aria-pressed={(preferences.uiStyle ?? "neo") === "classic"}
        >
          <span className="material-icons-sharp" aria-hidden="true">layers</span>
          <strong>Clássico</strong>
          <small>Mantém aparência base sem reforço visual.</small>
        </button>
      </div>
    </section>
  );
}
