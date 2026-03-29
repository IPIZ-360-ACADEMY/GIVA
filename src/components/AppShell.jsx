import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";
import profileImage from "../../images/perfil-1.jpg";

const navItems = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/est", icon: "work_history", label: "Estagios" },
  { to: "/parc", icon: "apartment", label: "Parceiros" },
  { to: "/statis", icon: "insights", label: "Estatisticas" },
  { to: "/documentos", icon: "description", label: "Documentos" },
  { to: "/notif", icon: "notifications", label: "Notificacoes", pill: "12" },
  { to: "/config", icon: "settings", label: "Configuracoes" }
];

function navClass({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

export default function AppShell() {
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [toast, setToast] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

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
      new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(new Date()),
    []
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
    setTheme(next);
    localStorage.setItem("giva.theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function showToast(message, type = "success") {
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
              <small>Gestao institucional de estagios e avaliacoes</small>
            </div>
          </Link>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu">
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Menu principal">
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
            Terminar sessao
          </button>
        </div>
      </aside>

      <div className={`backdrop ${isSidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />

      <div className="app-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <span className="material-icons-sharp">menu</span>
          </button>

          <Link className="topbar-brand" to="/" aria-label="Ir para o inicio da plataforma">
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
              placeholder="Pesquisar conteudo da pagina"
            />
          </label>

          <button className="theme-btn" onClick={toggleTheme} aria-label="Alternar tema">
            <span className="material-icons-sharp">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>

          <div className="profile-chip">
            <img src={profileImage} alt="Foto do utilizador" />
            <div>
              <strong>Coordenacao IPIZ</strong>
              <small>Operacao central GIVA</small>
            </div>
          </div>
        </header>

        <Outlet context={{ query, currentDate, showToast }} />

        {toast ? (
          <div className={`toast ${toast.type === "error" ? "danger" : "success"}`} role="status">
            <strong>{toast.type === "error" ? "Erro" : "Sucesso"}</strong>
            <div>{toast.message}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
