import { Navigate, Outlet, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { signOut } from "../services/authService.js";
import { resolveAccessProfile } from "../utils/accessControl.js";
import { useState } from "react";

function PendingApprovalScreen() {
  const { refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  async function handleCheckApproval() {
    setChecking(true);
    setChecked(false);
    await refreshProfile();
    setChecking(false);
    setChecked(true);
  }

  return (
    <main className="login-shell">
      <div className="login-box" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
        <span className="material-icons-sharp pending-icon" style={{ fontSize: "3rem", color: "var(--accent)", display: "block", marginBottom: "0.75rem" }}>
          hourglass_top
        </span>
        <h2 style={{ marginBottom: "0.5rem" }}>Conta em análise</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          O teu registo de empresa está a aguardar aprovação por um administrador IPIZ.
          Receberás uma notificação por e-mail assim que for aprovado.
        </p>
        {checked && (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            O estado foi verificado. Ainda não foi aprovado — tenta novamente mais tarde.
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            className="btn primary"
            onClick={handleCheckApproval}
            disabled={checking}
          >
            {checking
              ? <><span className="material-icons-sharp spinning" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.4rem" }}>sync</span>A verificar...</>
              : <><span className="material-icons-sharp" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.4rem" }}>refresh</span>Verificar aprovação</>}
          </button>
          <button
            className="btn ghost"
            onClick={() => signOut()}
          >
            Terminar sessão
          </button>
        </div>
      </div>
    </main>
  );
}

export default function RequireAuth({ children }) {
  const { authEnabled, isAuthenticated, loading, userProfile, authProfile, user } = useAuth();
  const location = useLocation();

  if (!authEnabled) {
    return children ?? <Outlet />;
  }

  if (loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="panel">
          <p>A validar sessao...</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (authProfile?.mustChangePassword) {
    const isSecurityRoute = location.pathname === "/config/seguranca";
    if (!isSecurityRoute) {
      return <Navigate to="/config/seguranca" replace state={{ from: location.pathname }} />;
    }
  }

  // Apenas empresas aguardam aprovação antes de aceder ao produto.
  if (userProfile?.type === "company" && userProfile?.moderation === "pending") {
    return <PendingApprovalScreen />;
  }

  const {
    isCompanyUser,
    isStudentUser,
    isExternalUser,
    isCoordinatorUser,
    isTeacherUser,
    isSuperAdmin,
    isAdmin,
  } = resolveAccessProfile({
    role: authProfile?.role,
    type: userProfile?.type,
  });

  // SUPER_ADMIN: acesso total a todas as páginas e funcionalidades
  if (isSuperAdmin) {
    return children ?? <Outlet />;
  }

  // ── Auxiliar: verifica se o pathname actual está numa allowlist ──────────
  function canAccess(allowedRoutes) {
    return allowedRoutes.some(
      (base) => location.pathname === base || location.pathname.startsWith(`${base}/`)
    );
  }

  // Coordenador (inclui legado ADMIN_1): apenas escopo académico/operacional
  if (isCoordinatorUser) {
    const coordinatorAllowedRoutes = [
      "/",
      "/home",
      "/ferramentas",
      "/estagios",
      "/avaliacoes",
      "/turmas",
      "/areas-formacao",
      "/parceiros",
      "/documentos",
      "/rbac/vagas",
      "/rbac/candidaturas",
      "/perfil",
      "/progresso",
      "/aluno",
      "/chat",
      "/notificacoes",
      "/config",
    ];
    if (!canAccess(coordinatorAllowedRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    const forbiddenCoordinatorRoutes = ["/admin", "/utilizadores"];
    if (canAccess(forbiddenCoordinatorRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    return children ?? <Outlet />;
  }

  // Empresa: só pode aceder às rotas de empresa
  if (isCompanyUser) {
    const companyAllowedRoutes = ["/empresa", "/rbac/candidaturas", "/notificacoes", "/chat", "/config"];
    if (!canAccess(companyAllowedRoutes)) {
      return <Navigate to="/empresa" replace state={{ from: location.pathname }} />;
    }
  }

  // Externo: apenas feed/comunidade e configurações
  if (isExternalUser && !isAdmin) {
    const externalAllowedRoutes = ["/home", "/config"];
    if (!canAccess(externalAllowedRoutes)) {
      return <Navigate to="/home" replace state={{ from: location.pathname }} />;
    }
  }

  // Estudante: somente recursos relacionados ao próprio percurso
  if (isStudentUser && !isAdmin) {
    const studentAllowedRoutes = [
      "/",
      "/home",
      "/rbac/vagas",
      "/estagios",
      "/avaliacoes",
      "/documentos",
      "/pedidos",
      "/chat",
      "/notificacoes",
      "/config",
      "/aluno",
      "/perfil",
      "/progresso",
      "/perfil-publico",
    ];
    if (!canAccess(studentAllowedRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    const profileMatch = matchPath("/perfil/:studentId", location.pathname);
    const progressMatch = matchPath("/progresso/:studentId", location.pathname);
    const targetStudentId = profileMatch?.params?.studentId ?? progressMatch?.params?.studentId;

    // Alunos só podem aceder ao próprio perfil e progresso.
    if (targetStudentId && user?.id && targetStudentId !== user.id) {
      return <Navigate to={`/perfil/${user.id}`} replace state={{ from: location.pathname }} />;
    }
  }

  // Professor: escopo académico próprio + vistas RBAC
  if (isTeacherUser && !isAdmin) {
    const academicAllowedRoutes = [
      "/",
      "/home",
      "/rbac/vagas",
      "/estagios",
      "/avaliacoes",
      "/documentos",
      "/chat",
      "/notificacoes",
      "/config",
      "/turmas",
      "/areas-formacao",
      "/perfil",
      "/progresso",
    ];
    if (!canAccess(academicAllowedRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }
  }

  // Qualquer outro perfil admin (ADMIN/isAdminCore) sem role explícita:
  // bloquear rotas altamente restritas
  if (isAdmin && !isCoordinatorUser) {
    // Ferramentas e painel de admin apenas para coordenação/super-admin
    const restrictedRoutes = ["/admin", "/ferramentas", "/utilizadores", "/parceiros"];
    if (canAccess(restrictedRoutes)) {
      return <Navigate to="/" replace />;
    }
  }

  return children ?? <Outlet />;
}