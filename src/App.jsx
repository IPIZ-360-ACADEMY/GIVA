import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const InternshipsPage = lazy(() => import("./pages/InternshipsPage.jsx"));
const ClassesPage = lazy(() => import("./pages/ClassesPage.jsx"));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage.jsx"));
const PartnersPage = lazy(() => import("./pages/PartnersPage.jsx"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const SettingsLayout = lazy(() => import("./pages/SettingsLayout.jsx"));
const SettingsProfilePage = lazy(() => import("./pages/SettingsProfilePage.jsx"));
const SettingsAppearancePage = lazy(() => import("./pages/SettingsAppearancePage.jsx"));
const SettingsSecurityPage = lazy(() => import("./pages/SettingsSecurityPage.jsx"));
const SettingsPreferencesPage = lazy(() => import("./pages/SettingsPreferencesPage.jsx"));
const SettingsAccountsPage = lazy(() => import("./pages/SettingsAccountsPage.jsx"));
const StudentPage = lazy(() => import("./pages/StudentPage.jsx"));
const StudentProfilePage = lazy(() => import("./pages/StudentProfilePage.jsx"));
const StudentProgressPage = lazy(() => import("./pages/StudentProgressPage.jsx"));
const TrainingAreasPage = lazy(() => import("./pages/TrainingAreasPage.jsx"));
const EvaluationsPageEnhanced = lazy(() => import("./pages/EvaluationsPageEnhanced.jsx"));
const CompanyDashboardPage = lazy(() => import("./pages/CompanyDashboardPage.jsx"));
const RbacStudentJobsPage = lazy(() => import("./pages/RbacStudentJobsPage.jsx"));
const RbacCompanyApplicationsPage = lazy(() => import("./pages/RbacCompanyApplicationsPage.jsx"));
const SignupPage =  lazy(() => import("./pages/SignupPage.jsx"));
const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const ChatPage = lazy(() => import("./pages/ChatPage.jsx"));
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage.jsx"));
const PublicPostPage = lazy(() => import("./pages/PublicPostPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const ToolsPage = lazy(() => import("./pages/ToolsPage.jsx"));

function PageLoader() {
  const location = useLocation();
  const isCompanyRoute = location.pathname === "/empresa";

  return (
    <div className="page-loader" aria-busy="true" aria-label="A carregar">
      {isCompanyRoute ? "Painel da empresa" : null}
    </div>
  );
}

// Pré-carrega os chunks das páginas mais visitadas quando o browser está sem actividade.
// Não afecta o tempo de carregamento inicial — só melhora navegações subsequentes.
function PrefetchOnIdle() {
  useEffect(() => {
    const PREFETCH = [
      () => import("./pages/DashboardPage.jsx"),
      () => import("./pages/InternshipsPage.jsx"),
      () => import("./pages/DocumentsPage.jsx"),
      () => import("./pages/NotificationsPage.jsx"),
      () => import("./pages/ChatPage.jsx"),
    ];
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => { PREFETCH.forEach((fn) => fn()); }, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    // Fallback para browsers sem requestIdleCallback (Safari < 16)
    const t = setTimeout(() => { PREFETCH.forEach((fn) => fn()); }, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}

const APP_ROUTES = [
  { path: "/", element: <DashboardPage /> },
  { path: "/home", element: <HomePage /> },
  { path: "/estagios", element: <InternshipsPage /> },
  { path: "/turmas", element: <ClassesPage /> },
  { path: "/turmas/detalhe", element: <ClassDetailPage /> },
  { path: "/areas-formacao", element: <TrainingAreasPage /> },
  { path: "/avaliacoes", element: <EvaluationsPageEnhanced /> },
  { path: "/parceiros", element: <PartnersPage /> },
  { path: "/documentos", element: <DocumentsPage /> },
  { path: "/notificacoes", element: <NotificationsPage /> },
  { path: "/aluno", element: <StudentPage /> },
  { path: "/perfil/:studentId", element: <StudentProfilePage /> },
  { path: "/progresso/:studentId", element: <StudentProgressPage /> },
  { path: "/empresa", element: <CompanyDashboardPage /> },
  { path: "/rbac/vagas", element: <RbacStudentJobsPage /> },
  { path: "/rbac/candidaturas", element: <RbacCompanyApplicationsPage /> },
  { path: "/admin", element: <AdminPage /> },
  { path: "/ferramentas", element: <ToolsPage /> },
  { path: "/utilizadores", element: <LegacyRedirect to="/ferramentas?tab=utilizadores" /> },
  { path: "/chat", element: <ChatPage /> },
];

const LEGACY_PATH_REDIRECTS = [
  { from: "/index.html", to: "/" },
  { from: "/est", to: "/estagios" },
  { from: "/est.html", to: "/estagios" },
  { from: "/turmas.html", to: "/turmas" },
  { from: "/parc", to: "/parceiros" },
  { from: "/parc.html", to: "/parceiros" },
  { from: "/estatisticas", to: "/" },
  { from: "/statis", to: "/" },
  { from: "/statis.html", to: "/" },
  { from: "/docs", to: "/documentos" },
  { from: "/docs.html", to: "/documentos" },
  { from: "/notif", to: "/notificacoes" },
  { from: "/notif.html", to: "/notificacoes" },
  { from: "/alumno", to: "/aluno" },
  { from: "/alumno.html", to: "/aluno" },
  { from: "/avaliacoes.html", to: "/avaliacoes" },
  { from: "/config.html", to: "/config" },
];

function LegacyRedirect({ to }) {
  return <Navigate to={to} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <PrefetchOnIdle />
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            {APP_ROUTES.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}

            <Route path="/config" element={<SettingsLayout />}>
              <Route index element={<LegacyRedirect to="/config/perfil" />} />
              <Route path="perfil" element={<SettingsProfilePage />} />
              <Route path="conta" element={<SettingsAccountsPage />} />
              <Route path="preferencias" element={<SettingsPreferencesPage />} />
              <Route path="aparencia" element={<SettingsAppearancePage />} />
              <Route path="seguranca" element={<SettingsSecurityPage />} />
            </Route>

            {LEGACY_PATH_REDIRECTS.map((route) => (
              <Route key={route.from} path={route.from} element={<LegacyRedirect to={route.to} />} />
            ))}
          </Route>
        </Route>

        <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
        <Route path="/signup" element={<Suspense fallback={<PageLoader />}><SignupPage /></Suspense>} />
        <Route path="/perfil-publico/:userId" element={<Suspense fallback={<PageLoader />}><PublicProfilePage /></Suspense>} />
        <Route path="/post/:postId" element={<Suspense fallback={<PageLoader />}><PublicPostPage /></Suspense>} />
        <Route path="/login.html" element={<LegacyRedirect to="/login" />} />
        <Route path="*" element={<LegacyRedirect to="/" />} />
      </Routes>
    </AuthProvider>
  );
}
