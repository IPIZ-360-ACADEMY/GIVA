import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAuthEnabled, signInWithOAuth } from "../services/authService.js";
import { supabase } from "../lib/supabase.js";

const PROVIDERS = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "linkedin_oidc",
    label: "LinkedIn",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
];

function ProviderCard({ provider, identity, onConnect, onDisconnect, canDisconnect, loading }) {
  const connected = Boolean(identity);

  return (
    <div className={`account-provider-card${connected ? " connected" : ""}`}>
      <div className="account-provider-icon">{provider.icon}</div>
      <div className="account-provider-info">
        <span className="account-provider-name">{provider.label}</span>
        {connected && (
          <span className="account-provider-meta">
            {identity.identity_data?.email || identity.identity_data?.name || "Conta vinculada"}
          </span>
        )}
      </div>
      <div className="account-provider-action">
        {connected ? (
          <button
            className="btn secondary small danger-outline"
            disabled={!canDisconnect || loading}
            title={!canDisconnect ? "Precisa de pelo menos um método de login activo" : undefined}
            onClick={() => onDisconnect(identity)}
          >
            {loading ? "…" : "Desconectar"}
          </button>
        ) : (
          <button
            className="btn secondary small"
            disabled={loading}
            onClick={() => onConnect(provider.id)}
          >
            {loading ? "…" : "Conectar"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsAccountsPage() {
  const { showToast } = useOutletContext();
  const { user } = useAuth();
  const [identities, setIdentities] = useState([]);
  const [loadingProvider, setLoadingProvider] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const authEnabled = isAuthEnabled();

  useEffect(() => {
    if (!authEnabled || !user) return;
    supabase.auth.getUserIdentities().then(({ data, error }) => {
      if (!error && data?.identities) setIdentities(data.identities);
    });
  }, [authEnabled, user]);

  async function handleConnect(providerId) {
    setLoadingProvider(providerId);
    await signInWithOAuth(providerId);
    // OAuth redirect — page reloads after return; no need to reset loading
  }

  async function handleDisconnect(identity) {
    setLoadingProvider(identity.provider);
    const { error } = await supabase.auth.unlinkIdentity(identity);
    setLoadingProvider(null);
    if (error) {
      showToast("Erro ao desconectar conta: " + error.message, "error");
      return;
    }
    setIdentities((prev) => prev.filter((i) => i.id !== identity.id));
    showToast(`Conta ${identity.provider} desconectada.`);
  }

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    // Call Supabase Admin API via RPC or Edge Function — show guidance if not available
    const { error } = await supabase.rpc("delete_own_account").catch(() => ({ error: { message: "RPC não disponível" } }));
    setDeleting(false);
    if (error) {
      showToast("Para eliminar a conta contacte o administrador IPIZ.", "error");
      setDeleteConfirm(false);
      return;
    }
    showToast("Conta eliminada.");
  }

  if (!authEnabled || !user) {
    return (
      <section className="form-card">
        <p className="meta">Ligação ao Supabase necessária para gerir contas vinculadas.</p>
      </section>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Conta principal */}
      <section className="form-card">
        <h3>Conta Principal</h3>
        <div className="account-main-row">
          <span className="material-icons-sharp" style={{ fontSize: "1.5rem", opacity: 0.6 }}>
            alternate_email
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{user.email}</p>
            <p className="meta" style={{ margin: 0, fontSize: "0.8rem" }}>
              Email principal · gerido pelo Supabase Auth
            </p>
          </div>
        </div>
      </section>

      {/* Contas vinculadas */}
      <section className="form-card">
        <h3>Contas Vinculadas</h3>
        <p className="meta" style={{ marginBottom: "1.25rem", fontSize: "0.85rem" }}>
          Vincule contas Google ou LinkedIn para entrar rapidamente sem password.
        </p>

        <div className="account-providers-list">
          {PROVIDERS.map((provider) => {
            const identity = identities.find((i) => i.provider === provider.id);
            // Can disconnect only if there are at least 2 identities
            const canDisconnect = identities.length > 1;
            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                identity={identity}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                canDisconnect={canDisconnect}
                loading={loadingProvider === provider.id}
              />
            );
          })}
        </div>
      </section>

      {/* Zona de perigo */}
      <section className="form-card danger-zone">
        <h3>
          <span className="material-icons-sharp" style={{ fontSize: "1.1rem", verticalAlign: "middle", marginRight: "0.4rem", color: "var(--color-danger)" }}>
            warning
          </span>
          Zona de Perigo
        </h3>

        <div className="danger-zone-row">
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Eliminar conta</p>
            <p className="meta" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
              Remove permanentemente todos os seus dados. Esta acção é irreversível.
            </p>
          </div>
          {deleteConfirm ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--color-danger)" }}>Tem a certeza?</span>
              <button className="btn danger small" disabled={deleting} onClick={handleDeleteAccount}>
                {deleting ? "…" : "Confirmar"}
              </button>
              <button className="btn secondary small" onClick={() => setDeleteConfirm(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button className="btn danger small" onClick={() => setDeleteConfirm(true)}>
              Eliminar conta
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
