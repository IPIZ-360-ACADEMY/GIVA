import { NavLink, Outlet, useOutletContext } from "react-router-dom";

function tabClass({ isActive }) {
  return isActive ? "settings-tab active" : "settings-tab";
}

export default function SettingsLayout() {
  const appContext = useOutletContext();
  const { t } = appContext;

  return (
    <main className="page settings-layout">
      <section className="page-header">
        <h2>{t("settings.title")}</h2>
        <p>{t("settings.description")}</p>
      </section>

      <nav className="settings-tabs" aria-label={t("settings.title")}>
        <NavLink end to="/config/perfil" className={tabClass}>
          <span className="material-icons-sharp">badge</span>
          {t("settings.tabs.profile")}
        </NavLink>
        <NavLink to="/config/preferencias" className={tabClass}>
          <span className="material-icons-sharp">tune</span>
          {t("settings.tabs.preferences")}
        </NavLink>
        <NavLink to="/config/aparencia" className={tabClass}>
          <span className="material-icons-sharp">palette</span>
          {t("settings.tabs.appearance")}
        </NavLink>
        <NavLink to="/config/seguranca" className={tabClass}>
          <span className="material-icons-sharp">shield</span>
          {t("settings.tabs.security")}
        </NavLink>
      </nav>

      <Outlet context={appContext} />
    </main>
  );
}
