import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import InternshipsPage from "./pages/InternshipsPage.jsx";
import PartnersPage from "./pages/PartnersPage.jsx";
import StatisticsPage from "./pages/StatisticsPage.jsx";
import DocumentsPage from "./pages/DocumentsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import StudentPage from "./pages/StudentPage.jsx";
import EvaluationsPage from "./pages/EvaluationsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";

const APP_ROUTES = [
  { path: "/", element: <DashboardPage /> },
  { path: "/est", element: <InternshipsPage /> },
  { path: "/parc", element: <PartnersPage /> },
  { path: "/statis", element: <StatisticsPage /> },
  { path: "/documentos", element: <DocumentsPage /> },
  { path: "/notif", element: <NotificationsPage /> },
  { path: "/config", element: <SettingsPage /> },
  { path: "/alumno", element: <StudentPage /> },
  { path: "/avaliacoes", element: <EvaluationsPage /> },
];

const LEGACY_PATH_REDIRECTS = [
  { from: "/index.html", to: "/" },
  { from: "/est.html", to: "/est" },
  { from: "/parc.html", to: "/parc" },
  { from: "/statis.html", to: "/statis" },
  { from: "/docs", to: "/documentos" },
  { from: "/docs.html", to: "/documentos" },
  { from: "/notif.html", to: "/notif" },
  { from: "/config.html", to: "/config" },
  { from: "/alumno.html", to: "/alumno" },
  { from: "/avaliacoes.html", to: "/avaliacoes" },
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
