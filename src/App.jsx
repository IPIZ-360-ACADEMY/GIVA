import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import InternshipsPage from "./pages/InternshipsPage.jsx";
import ClassesPage from "./pages/ClassesPage.jsx";
import ClassDetailPage from "./pages/ClassDetailPage.jsx";
import PartnersPage from "./pages/PartnersPage.jsx";
import StatisticsPage from "./pages/StatisticsPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SettingsLayout from "./pages/SettingsLayout.jsx";
import SettingsProfilePage from "./pages/SettingsProfilePage.jsx";
import SettingsAppearancePage from "./pages/SettingsAppearancePage.jsx";
import SettingsSecurityPage from "./pages/SettingsSecurityPage.jsx";
import SettingsPreferencesPage from "./pages/SettingsPreferencesPage.jsx";
import StudentPage from "./pages/StudentPage.jsx";
import EvaluationsPage from "./pages/EvaluationsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

const APP_ROUTES = [
  { path: "/", element: <DashboardPage /> },
  { path: "/estagios", element: <InternshipsPage /> },
  { path: "/turmas", element: <ClassesPage /> },
  { path: "/turmas/detalhe", element: <ClassDetailPage /> },
  { path: "/avaliacoes", element: <EvaluationsPage /> },
  { path: "/parceiros", element: <PartnersPage /> },
  { path: "/estatisticas", element: <StatisticsPage /> },
  { path: "/documentos", element: <DocumentsPage /> },
  { path: "/notificacoes", element: <NotificationsPage /> },
  { path: "/aluno", element: <StudentPage /> },
];

const LEGACY_PATH_REDIRECTS = [
  { from: "/index.html", to: "/" },
  { from: "/est", to: "/estagios" },
  { from: "/est.html", to: "/estagios" },
  { from: "/turmas.html", to: "/turmas" },
  { from: "/parc", to: "/parceiros" },
  { from: "/parc.html", to: "/parceiros" },
  { from: "/statis", to: "/estatisticas" },
  { from: "/statis.html", to: "/estatisticas" },
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
    <Routes>
      <Route element={<AppShell />}>
        {APP_ROUTES.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}

        <Route path="/config" element={<SettingsLayout />}>
          <Route index element={<LegacyRedirect to="/config/perfil" />} />
          <Route path="perfil" element={<SettingsProfilePage />} />
          <Route path="preferencias" element={<SettingsPreferencesPage />} />
          <Route path="aparencia" element={<SettingsAppearancePage />} />
          <Route path="seguranca" element={<SettingsSecurityPage />} />
        </Route>

        {LEGACY_PATH_REDIRECTS.map((route) => (
          <Route key={route.from} path={route.from} element={<LegacyRedirect to={route.to} />} />
        ))}
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/login.html" element={<LegacyRedirect to="/login" />} />
      <Route path="*" element={<LegacyRedirect to="/" />} />
    </Routes>
  );
}
