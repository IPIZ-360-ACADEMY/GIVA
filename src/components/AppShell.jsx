import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";
import profileImage from "../../images/perfil-1.jpg";
import { createTranslator, resolveDateLocale } from "../utils/i18n.js";

function navClass({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

export default function AppShell() {
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [preferences, setPreferences] = useState({
    language: "pt-BR",
    uiNotifications: true,
    density: "comfortable"
  });
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);

  const navItems = useMemo(
    () => [
      { to: "/", icon: "dashboard", label: t("nav.dashboard") },
      { to: "/estagios", icon: "work_history", label: t("nav.internships") },
      { to: "/turmas", icon: "school", label: t("nav.classes") },
      { to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") },
      { to: "/parceiros", icon: "apartment", label: t("nav.partners") },
      { to: "/estatisticas", icon: "insights", label: t("nav.statistics") },
      { to: "/documentos", icon: "description", label: t("nav.documents") },
      { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: "12" },
      { to: "/config", icon: "settings", label: t("nav.settings") }
    ],
    [t]
  );

  useEffect(() => {
    const saved = localStorage.getItem("giva.theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
      return;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = prefersDark ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);

  useEffect(() => {
    const savedRaw = localStorage.getItem("giva.preferences");
    if (!savedRaw) {
      document.documentElement.setAttribute("lang", "pt-BR");
      document.documentElement.setAttribute("data-density", "comfortable");
      return;
    }

    try {
      const saved = JSON.parse(savedRaw);
      const next = {
        language: saved.language === "pt-PT" || saved.language === "en" ? saved.language : "pt-BR",
        uiNotifications: saved.uiNotifications !== false,
        density: saved.density === "compact" ? "compact" : "comfortable"
      };
      setPreferences(next);
      document.documentElement.setAttribute("lang", next.language);
      document.documentElement.setAttribute("data-density", next.density);
    } catch {
      document.documentElement.setAttribute("lang", "pt-BR");
      document.documentElement.setAttribute("data-density", "comfortable");
    }
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const currentDate = useMemo(
    () =>
      new Intl.DateTimeFormat(resolveDateLocale(preferences.language), {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(new Date()),
    [preferences.language]
  );

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setThemeMode(next);
  }

  function setThemeMode(nextTheme) {
    if (nextTheme !== "light" && nextTheme !== "dark") {
      return;
    }
    setTheme(nextTheme);
    localStorage.setItem("giva.theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  function updatePreferences(partial) {
    setPreferences((current) => {
      const next = { ...current, ...partial };
      localStorage.setItem("giva.preferences", JSON.stringify(next));
      document.documentElement.setAttribute("lang", next.language);
      document.documentElement.setAttribute("data-density", next.density);
      return next;
    });
  }

  function showToast(message, type = "success") {
    if (!preferences.uiNotifications) {
      return;
    }
    setToast({ message, type, id: Date.now() });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`} id="sidebar">
        <div className="sidebar-top">
          <Link className="brand" to="/">
            <span className="brand-mark" aria-hidden="true">
              <img className="brand-logo" src={logoImage} alt="" />
            </span>
            <div className="brand-copy">
              <h1>GIVA IPIZ</h1>
              <small>{t("brand.subtitle")}</small>
            </div>
          </Link>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label={t("actions.closeMenu")}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label={t("nav.mainMenu")}>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClass}>
              <span className="material-icons-sharp">{item.icon}</span>
              {item.label}
              {item.pill ? <span className="pill">{item.pill}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="nav-footer">
          <button className="nav-link" onClick={() => navigate("/login")} type="button">
            <span className="material-icons-sharp">logout</span>
            {t("actions.logout")}
          </button>
        </div>
      </aside>

      <div className={`backdrop ${isSidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="app-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label={t("actions.openMenu")}>
            <span className="material-icons-sharp">menu</span>
          </button>

          <Link className="topbar-brand" to="/" aria-label={t("actions.goHome")}>
            <img className="topbar-brand-logo" src={logoImage} alt="" />
            <span>GIVA</span>
          </Link>

          <label className="search" htmlFor="global-search">
            <span className="material-icons-sharp">search</span>
            <input
              id="global-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search.placeholder")}
            />
          </label>

          <div className="profile-chip">
            <img src={profileImage} alt="Foto do utilizador" />
            <div>
              <strong>{t("profile.name")}</strong>
              <small>{t("profile.role")}</small>
            </div>
          </div>
        </header>

        <Outlet
          context={{
            query,
            currentDate,
            showToast,
            theme,
            toggleTheme,
            setThemeMode,
            preferences,
            updatePreferences,
            t
          }}
        />

        {toast ? (
          <div className={`toast ${toast.type === "error" ? "danger" : "success"}`} role="status">
            <strong>{toast.type === "error" ? t("toast.error") : t("toast.success")}</strong>
            <div>{toast.message}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
