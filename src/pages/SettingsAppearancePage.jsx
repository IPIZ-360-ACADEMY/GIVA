import { useOutletContext } from "react-router-dom";

export default function SettingsAppearancePage() {
  const { theme, setThemeMode, showToast, t } = useOutletContext();

  function changeTheme(nextTheme) {
    setThemeMode(nextTheme);
    showToast(nextTheme === "dark" ? t("settings.appearance.appliedDark") : t("settings.appearance.appliedLight"));
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
    </section>
  );
}
