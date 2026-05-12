import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";
import fallbackAvatar from "../../images/perfil-1.jpg";
import { useAuth } from "../contexts/AuthContext.jsx";
import { createTranslator, resolveDateLocale } from "../utils/i18n.js";
import { resolveAccessProfile } from "../utils/accessControl.js";
import { getUnreadCount, subscribeToConversations } from "../services/chatService.js";
import NotifToastContainer from "./NotifToast.jsx";
import TopProgressBar from "./TopProgressBar.jsx";

function navClass({ isActive }) {
  return isActive ? "nav-link active" : "nav-link";
}

export default function AppShell() {
  const [query] = useState("");
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [preferences, setPreferences] = useState({
    language: "pt-BR",
    uiNotifications: true,
    density: "comfortable",
    uiStyle: "neo"
  });
  const [toast, setToast] = useState(null);
  const [chatUnread, setChatUnread] = useState(0);
  const { authEnabled, authProfile, userProfile, user, signOut, notifCount } = useAuth();
  const chatUnsubRef = useRef(null);
  const notifUnsubRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const t = useMemo(() => createTranslator(preferences.language), [preferences.language]);
  const profileName = userProfile?.display_name || (authEnabled && authProfile.displayName ? authProfile.displayName : t("profile.name"));
  const avatarUrl = userProfile?.avatar_url || null;
  const profileRole = authEnabled && authProfile.role
    ? String(authProfile.role).replaceAll("_", " ")
    : t("profile.role");
  const {
    normalizedRole,
    isCompanyUser,
    isStudentUser,
    isExternalUser,
    isCoordinatorUser,
    isTeacherUser,
    isSuperAdmin,
  } = useMemo(
    () => resolveAccessProfile({ role: authProfile?.role, type: userProfile?.type }),
    [authProfile?.role, userProfile?.type]
  );

  const navItems = useMemo(
    () => {
      // SUPER_ADMIN: acesso total
      if (isSuperAdmin) {
        return [
          { to: "/home", icon: "public", label: "Comunidade" },
          { to: "/", icon: "dashboard", label: t("nav.dashboard") },
          { to: "/estagios", icon: "work_history", label: t("nav.internships") },
          { to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") },
          { to: "/parceiros", icon: "apartment", label: t("nav.partners") },
          { to: "/documentos", icon: "description", label: t("nav.documents") },
          { to: "/empresa", icon: "business_center", label: t("nav.companyDashboard") },
          { to: "/admin", icon: "admin_panel_settings", label: "Administração" },
          { to: "/ferramentas", icon: "build", label: "Ferramentas" },
          { to: "/chat", icon: "chat", label: "Chat", pill: chatUnread > 0 ? String(chatUnread) : null },
          { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: notifCount > 0 ? String(notifCount > 99 ? "99+" : notifCount) : null },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      // Coordenador: operação académica escopada à sua coordenação atribuída
      if (isCoordinatorUser) {
        return [
          { to: "/home", icon: "public", label: "Comunidade" },
          { to: "/", icon: "dashboard", label: t("nav.dashboard") },
          { to: "/estagios", icon: "work_history", label: t("nav.internships") },
          { to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") },
          { to: "/parceiros", icon: "apartment", label: t("nav.partners") },
          { to: "/turmas", icon: "school", label: "Turmas" },
          { to: "/documentos", icon: "description", label: t("nav.documents") },
          { to: "/ferramentas", icon: "build", label: "Ferramentas" },
          { to: "/chat", icon: "chat", label: "Chat", pill: chatUnread > 0 ? String(chatUnread) : null },
          { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: notifCount > 0 ? String(notifCount > 99 ? "99+" : notifCount) : null },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      // Empresa: apenas recursos da empresa
      if (isCompanyUser) {
        return [
          { to: "/empresa", icon: "business_center", label: t("nav.companyDashboard") },
          { to: "/rbac/candidaturas", icon: "fact_check", label: "Candidaturas RBAC" },
          { to: "/chat", icon: "chat", label: "Chat", pill: chatUnread > 0 ? String(chatUnread) : null },
          { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: notifCount > 0 ? String(notifCount > 99 ? "99+" : notifCount) : null },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      // Estudante: apenas funcionalidades próprias
      if (isStudentUser) {
        return [
          { to: "/home", icon: "public", label: "Comunidade" },
          { to: "/", icon: "dashboard", label: t("nav.dashboard") },
          { to: "/rbac/vagas", icon: "work", label: "Vagas RBAC" },
          { to: "/estagios", icon: "work_history", label: t("nav.internships") },
          { to: "/avaliacoes", icon: "grading", label: t("nav.evaluations") },
          { to: "/documentos", icon: "description", label: t("nav.documents") },
          { to: "/pedidos", icon: "assignment", label: t("nav.pedidos") || "Pedidos" },
          { to: "/chat", icon: "chat", label: "Chat", pill: chatUnread > 0 ? String(chatUnread) : null },
          { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: notifCount > 0 ? String(notifCount > 99 ? "99+" : notifCount) : null },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      if (isTeacherUser) {
        return [
          { to: "/home", icon: "public", label: "Comunidade" },
          { to: "/", icon: "dashboard", label: t("nav.dashboard") },
          { to: "/rbac/vagas", icon: "work", label: "Vagas RBAC" },
          { to: "/turmas", icon: "school", label: "Turmas" },
          { to: "/documentos", icon: "description", label: t("nav.documents") },
          { to: "/chat", icon: "chat", label: "Chat", pill: chatUnread > 0 ? String(chatUnread) : null },
          { to: "/notificacoes", icon: "notifications", label: t("nav.notifications"), pill: notifCount > 0 ? String(notifCount > 99 ? "99+" : notifCount) : null },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      // Externo: acesso resumido apenas a feed e configurações
      if (isExternalUser) {
        return [
          { to: "/home", icon: "public", label: "Comunidade" },
          { to: "/config", icon: "settings", label: t("nav.settings") },
        ];
      }

      // Visitante ou papel desconhecido: menu mínimo
      return [
        { to: "/home", icon: "public", label: "Comunidade" },
        { to: "/", icon: "dashboard", label: t("nav.dashboard") },
        { to: "/config", icon: "settings", label: t("nav.settings") },
      ];
    },
    [t, notifCount, chatUnread, isCompanyUser, isStudentUser, isExternalUser, isCoordinatorUser, isTeacherUser, isSuperAdmin]
  );

  const navSections = useMemo(() => {
    const baseRoutes = new Set(["/home", "/", "/rbac/vagas", "/rbac/candidaturas", "/estagios", "/avaliacoes", "/documentos", "/parceiros", "/empresa", "/turmas", "/pedidos"]);
    const collaborationRoutes = new Set(["/chat", "/notificacoes"]);
    const adminRoutes = new Set(["/admin", "/ferramentas", "/ferramentas?tab=utilizadores", "/config"]);

    const primary = navItems.filter((item) => baseRoutes.has(item.to));
    const collaboration = navItems.filter((item) => collaborationRoutes.has(item.to));
    const system = navItems.filter((item) => adminRoutes.has(item.to));

    return [
      { id: "primary", label: "Navegação", items: primary },
      { id: "collaboration", label: "Comunicação", items: collaboration },
      { id: "system", label: "Sistema", items: system },
    ].filter((section) => section.items.length > 0);
  }, [navItems]);

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
      document.documentElement.setAttribute("data-ui", "neo");
      return;
    }

    try {
      const saved = JSON.parse(savedRaw);
      const next = {
        language: saved.language === "pt-PT" || saved.language === "en" ? saved.language : "pt-BR",
        uiNotifications: saved.uiNotifications !== false,
        density: saved.density === "compact" ? "compact" : "comfortable",
        uiStyle: saved.uiStyle === "classic" ? "classic" : "neo"
      };
      setPreferences(next);
      document.documentElement.setAttribute("lang", next.language);
      document.documentElement.setAttribute("data-density", next.density);
      document.documentElement.setAttribute("data-ui", next.uiStyle);
    } catch {
      document.documentElement.setAttribute("lang", "pt-BR");
      document.documentElement.setAttribute("data-density", "comfortable");
      document.documentElement.setAttribute("data-ui", "neo");
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    function onOutside(e) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [isMobileOpen]);

  // Realtime — badge de chat não lidas
  useEffect(() => {
    if (!user || !authEnabled) return;

    getUnreadCount().then(setChatUnread).catch(() => {});

    const unsub = subscribeToConversations(user.id, () => {
      getUnreadCount().then(setChatUnread).catch(() => {});
    });
    chatUnsubRef.current = unsub;
    return () => chatUnsubRef.current?.();
  }, [user, authEnabled]);

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
      document.documentElement.setAttribute("data-ui", next.uiStyle === "classic" ? "classic" : "neo");
      return next;
    });
  }

  const showToast = useCallback(
    (message, type = "success") => {
      if (!preferences.uiNotifications) {
        return;
      }
      setToast({ message, type, id: Date.now() });
    },
    [preferences.uiNotifications]
  );

  async function handleLogout() {
    if (authEnabled) {
      await signOut();
    }
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <TopProgressBar />

      {/* Topbar — apenas visível em mobile */}
      <header className="mobile-topbar">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label={t("actions.openMenu")}
          aria-expanded={isMobileOpen}
          aria-controls="sidebar"
        >
          <span className="material-icons-sharp" aria-hidden="true">menu</span>
        </button>

        <Link className="mobile-brand" to="/" aria-label="GIVA IPIZ">
          <img src={logoImage} alt="IPIZ" />
          <span className="mobile-brand-name">GIVA</span>
        </Link>

        <div className="mobile-topbar-actions">
          <Link
            to="/notificacoes"
            className="mobile-action-btn"
            aria-label="Notificações"
            style={{ position: "relative" }}
          >
            <span className="material-icons-sharp">notifications</span>
            {notifCount > 0 && (
              <span className="mobile-notif-pill">{notifCount > 99 ? "99+" : notifCount}</span>
            )}
          </Link>
          <button
            type="button"
            className="mobile-action-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            <span className="material-icons-sharp">{theme === "dark" ? "light_mode" : "dark_mode"}</span>
          </button>
          <Link to="/config" className="mobile-avatar-btn" aria-label="Perfil">
            <img src={avatarUrl || fallbackAvatar} alt="Perfil" />
          </Link>
        </div>
      </header>

      {/* Backdrop para mobile */}
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar"
        ref={sidebarRef}
        className={`sidebar${isMobileOpen ? " mobile-open" : ""}`}
      >
        <div className="sidebar-inner">

          <Link className="sidebar-brand" to="/">
            <img className="brand-logo" src={logoImage} alt="IPIZ logo" />
            <span className="sidebar-brand-name">
              <strong>GIVA IPIZ</strong>
              <small>{t("brand.subtitle")}</small>
            </span>
          </Link>

          <div className="sidebar-divider" aria-hidden="true" />

          <nav className="sidebar-nav" aria-label={t("nav.mainMenu")}>
            {navSections.map((section) => (
              <div key={section.id} className="sidebar-nav-group">
                <span className="sidebar-section-label">{section.label}</span>
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={navClass}
                  >
                    <span className="material-icons-sharp" aria-hidden="true">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                    {item.pill ? <span className="pill">{item.pill}</span> : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="nav-link"
              type="button"
              onClick={handleLogout}
              aria-label={t("actions.logout")}
            >
              <span className="material-icons-sharp" aria-hidden="true">logout</span>
              <span className="nav-label">{t("actions.logout")}</span>
            </button>
            <div className="sidebar-profile">
              <img src={avatarUrl || fallbackAvatar} alt="Foto do utilizador" />
              <div className="sidebar-profile-info">
                <strong>{profileName}</strong>
                <small>{profileRole}</small>
              </div>
            </div>
          </div>

        </div>
      </aside>

      <div className="app-content">
        <Suspense fallback={<div className="page-loader" aria-busy="true" aria-label="A carregar" />}>
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
        </Suspense>

        {toast ? (
          <div className={`toast ${toast.type === "error" ? "danger" : "success"}`} role="status">
            <strong>{toast.type === "error" ? t("toast.error") : t("toast.success")}</strong>
            <div>{toast.message}</div>
          </div>
        ) : null}
      </div>

      {/* Popups de notificação em tempo real */}
      <NotifToastContainer soundEnabled={preferences.uiNotifications} />
    </div>
  );
}
