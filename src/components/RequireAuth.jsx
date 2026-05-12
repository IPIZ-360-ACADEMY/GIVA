import { Navigate, Outlet, matchPath, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getMfaAuthenticatorAssuranceLevel, listMfaFactors, signOut, verifyMfaTotpCode } from "../services/authService.js";
import { canAccessRoute, getRouteAccessRules, resolveAccessProfile } from "../utils/accessControl.js";
import { useEffect, useState } from "react";

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

function MfaChallengeScreen({ onVerified }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const { data: factorsData, error: listError } = await listMfaFactors();
    if (listError) {
      setSubmitting(false);
      setError(listError.message || "Não foi possível obter os fatores MFA.");
      return;
    }

    const totpFactors = Array.isArray(factorsData?.totp) ? factorsData.totp : [];
    const factor = totpFactors.find((item) => item?.status === "verified") || totpFactors[0] || null;
    if (!factor?.id) {
      setSubmitting(false);
      setError("Nenhum autenticador TOTP ativo foi encontrado para esta conta.");
      return;
    }

    const { error: verifyError } = await verifyMfaTotpCode({ factorId: factor.id, code });
    setSubmitting(false);

    if (verifyError) {
      setError(verifyError.message || "Código inválido. Tenta novamente.");
      return;
    }

    setCode("");
    onVerified();
  }

  return (
    <main className="login-shell">
      <div className="login-box" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
        <span className="material-icons-sharp pending-icon" style={{ fontSize: "3rem", color: "var(--primary)", display: "block", marginBottom: "0.75rem" }}>
          verified_user
        </span>
        <h2 style={{ marginBottom: "0.5rem" }}>Verificação de dois fatores</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Introduz o código gerado na tua aplicação autenticadora para concluir o acesso.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código de 6 dígitos"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
            style={{ textAlign: "center", letterSpacing: "0.2rem" }}
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button className="btn primary" type="submit" disabled={submitting || code.trim().length < 6}>
            {submitting ? "A verificar..." : "Confirmar código"}
          </button>
          <button className="btn ghost" type="button" onClick={() => signOut()}>
            Terminar sessão
          </button>
        </form>
      </div>
    </main>
  );
}

export default function RequireAuth({ children }) {
  const { authEnabled, isAuthenticated, loading, loadingPhase, userProfile, authProfile, user } = useAuth();
  const location = useLocation();
  const [mfaState, setMfaState] = useState({ loading: true, required: false });

  useEffect(() => {
    let active = true;

    async function loadMfaState() {
      if (!authEnabled || !isAuthenticated) {
        if (active) {
          setMfaState({ loading: false, required: false });
        }
        return;
      }

      setMfaState((prev) => ({ ...prev, loading: true }));
      const { data, error } = await getMfaAuthenticatorAssuranceLevel();

      if (!active) return;

      if (error) {
        setMfaState({ loading: false, required: false });
        return;
      }

      const required = data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
      setMfaState({ loading: false, required });
    }

    void loadMfaState();

    return () => {
      active = false;
    };
  }, [authEnabled, isAuthenticated, user?.id]);

  if (!authEnabled) {
    return children ?? <Outlet />;
  }

  if (loading) {
    const loadingLabel = loadingPhase === "profile"
      ? "A carregar perfil e permissoes..."
      : "A validar sessao...";

    return (
      <main className="page" aria-busy="true">
        <section className="panel">
          <p>{loadingLabel}</p>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (mfaState.loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="panel">
          <p>A validar segundo fator...</p>
        </section>
      </main>
    );
  }

  if (mfaState.required) {
    return <MfaChallengeScreen onVerified={() => setMfaState({ loading: false, required: false })} />;
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
  const routeAccess = getRouteAccessRules({
    isSuperAdmin,
    isAdmin,
    isCoordinatorUser,
    isCompanyUser,
    isExternalUser,
    isStudentUser,
    isTeacherUser,
  });

  // SUPER_ADMIN: acesso total a todas as páginas e funcionalidades
  if (isSuperAdmin) {
    return children ?? <Outlet />;
  }

  // Coordenador (inclui legado ADMIN_1): apenas escopo académico/operacional
  if (isCoordinatorUser) {
    if (!canAccessRoute(location.pathname, routeAccess.allowedRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    if (canAccessRoute(location.pathname, routeAccess.forbiddenRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }

    return children ?? <Outlet />;
  }

  // Empresa: só pode aceder às rotas de empresa
  if (isCompanyUser) {
    if (!canAccessRoute(location.pathname, routeAccess.allowedRoutes)) {
      return <Navigate to="/empresa" replace state={{ from: location.pathname }} />;
    }
  }

  // Externo: apenas feed/comunidade e configurações
  if (isExternalUser && !isAdmin) {
    if (!canAccessRoute(location.pathname, routeAccess.allowedRoutes)) {
      return <Navigate to="/home" replace state={{ from: location.pathname }} />;
    }
  }

  // Estudante: somente recursos relacionados ao próprio percurso
  if (isStudentUser && !isAdmin) {
    if (!canAccessRoute(location.pathname, routeAccess.allowedRoutes)) {
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
    if (!canAccessRoute(location.pathname, routeAccess.allowedRoutes)) {
      return <Navigate to="/" replace state={{ from: location.pathname }} />;
    }
  }

  // Qualquer outro perfil admin (ADMIN/isAdminCore) sem role explícita:
  // bloquear rotas altamente restritas
  if (isAdmin && !isCoordinatorUser) {
    // Ferramentas e painel de admin apenas para coordenação/super-admin
    if (canAccessRoute(location.pathname, routeAccess.forbiddenRoutes)) {
      return <Navigate to="/" replace />;
    }
  }

  return children ?? <Outlet />;
}