import { useEffect, useState, useMemo, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  defaultModerationForAccountType,
  defaultRoleForAccountType,
  getAllowedRolesForType,
} from "../utils/accessControl.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { listTrainingAreas } from "../services/trainingAreaService.js";
import { uploadAvatar } from "../services/profilesService.js";
import {
  adminListUsers,
  adminEnsureAccountTypeArtifacts,
  adminSetUserRole,
  adminSetUserArea,
  adminUpdateUserProfile,
  adminCreatePlatformUser,
  adminDeleteUser,
  adminSendPasswordReset,
  getStudentProcessNumberFromIdentifier,
} from "../services/usersAdminService.js";

// ── helpers ───────────────────────────────────────────────────
const TYPE_LABELS = {
  student:     { label: "Aluno",         color: "#059669" },
  company:     { label: "Empresa",       color: "#7856ff" },
  admin:       { label: "Administrador", color: "#dc2626" },
  coordinator: { label: "Coordenador",   color: "#0f766e" },
  teacher:     { label: "Professor",     color: "#0369a1" },
  external:    { label: "Externo",       color: "#6b7280" },
};

const ROLE_LABELS = {
  SUPER_ADMIN:   { label: "Super Admin",   color: "#c2410c" },
  ADMIN:         { label: "Admin",         color: "#b45309" },
  COORDINATOR:   { label: "Coordenador",   color: "#0f766e" },
  ADMIN_1:       { label: "Coordenador",   color: "#0f766e" },
  TEACHER:       { label: "Professor",     color: "#0369a1" },
  COMPANY:       { label: "Empresa",       color: "#7856ff" },
  STUDENT:       { label: "Aluno",         color: "#059669" },
  authenticated: { label: "Utilizador",   color: "#6b7280" },
};

function normalizeRole(value) {
  return defaultRoleForAccountType("external", value);
}

const MODERATION_LABELS = {
  active:    { label: "Ativo",    color: "#059669" },
  pending:   { label: "Pendente",  color: "#d97706" },
  suspended: { label: "Suspenso",  color: "#dc2626" },
};

// Normaliza valores legados (ex: "approved") para o enum atual
function normModeration(v) {
  if (v === "active" || v === "pending" || v === "suspended") return v;
  if (v === "approved") return "active"; // legado → ativo
  return "active";
}

function Badge({ meta }) {
  if (!meta) return <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "0.2rem 0.55rem",
      borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600,
      background: `${meta.color}22`, color: meta.color,
    }}>
      {meta.label}
    </span>
  );
}

function Avatar({ name, size = 34 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "var(--surface-raised)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: "0.85rem", color: "var(--text-muted)",
    }}>
      {initials}
    </div>
  );
}
// ── Delete Confirm Modal ────────────────────────────────────────────
function DeleteConfirmModal({ user, onConfirm, onCancel }) {
  return (
    <div className="admin-modal-overlay" onClick={onCancel}>
      <div className="admin-modal" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3 style={{ color: "var(--danger, #dc2626)" }}>Eliminar utilizador</h3>
          <button type="button" className="btn ghost sm" onClick={onCancel}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>
        <p style={{ margin: "1rem 0" }}>
          Tem a certeza que pretende eliminar permanentemente a conta de{" "}
          <strong>{user.display_name || user.email}</strong>?
        </p>
        <p className="form-hint" style={{ marginBottom: "1.25rem" }}>
          Esta ação remove o utilizador da autenticação e todos os dados associados.
          <strong> Não é reversível.</strong>
        </p>
        <div className="form-actions">
          <button type="button" className="btn danger" onClick={onConfirm}>
            <span className="material-icons-sharp">delete_forever</span>
            Sim, eliminar
          </button>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
// ── Edit Modal ─────────────────────────────────────────────────
function UserEditModal({ user, isSuperAdmin, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    display_name: user.display_name ?? "",
    bio: user.bio ?? "",
    avatar_url: user.avatar_url ?? "",
    type: user.type ?? "external",
    moderation: normModeration(user.moderation),
    role: defaultRoleForAccountType(user.type ?? "external", user.role),
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast("Foto máx. 5 MB", "error"); return; }
    setUploadingAvatar(true);
    try {
      const publicUrl = await uploadAvatar(user.id, file);
      set("avatar_url", publicUrl);
      toast("Foto carregada com sucesso", "success");
    } catch (err) {
      toast("Erro ao carregar foto: " + err.message, "error");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminUpdateUserProfile(user.id, {
        display_name: form.display_name.trim(),
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url || null,
        type: form.type,
        moderation: normModeration(form.moderation),
      });

      if (isSuperAdmin && form.type !== user.type) {
        await adminEnsureAccountTypeArtifacts(user.id, form.type, form.display_name.trim(), {
          email: user.email,
        });
      }

      const currentRole = defaultRoleForAccountType(user.type ?? form.type, user.role);
      const nextRole = isSuperAdmin ? defaultRoleForAccountType(form.type, form.role) : currentRole;
      if (isSuperAdmin && nextRole !== currentRole) {
        await adminSetUserRole(user.id, nextRole);
      }

      toast("Utilizador atualizado com sucesso.");
      onSaved({ ...user, ...form, role: nextRole });
    } catch (err) {
      toast("Erro ao guardar: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Avatar name={user.display_name} size={40} />
            <div>
              <h3 style={{ margin: 0 }}>Editar Utilizador</h3>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-muted)" }}>{user.email}</p>
            </div>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <form onSubmit={handleSave} style={{ marginTop: "1.25rem" }}>
          <div className="form-grid">
            <div className="form-field">
              <label>Nome de apresentação</label>
              <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Foto de perfil</label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="avatar" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span className="material-icons-sharp" style={{ fontSize: 48, color: "var(--text-muted)" }}>account_circle</span>
                )}
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <span className="material-icons-sharp">upload_file</span>
                  {uploadingAvatar ? "A carregar..." : "Carregar foto"}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              </div>
              <p className="form-hint" style={{ marginTop: "0.25rem" }}>JPEG, PNG, WebP. Máx. 5 MB.</p>
            </div>
            <div className="form-field">
              <label>Tipo de conta</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="student">Aluno</option>
                <option value="company">Empresa</option>
                <option value="coordinator">Coordenador</option>
                <option value="teacher">Professor</option>
                <option value="external">Externo</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estado de moderação</label>
              <select value={form.moderation} onChange={(e) => set("moderation", e.target.value)}>
                <option value="active">Ativo</option>
                <option value="pending">Pendente</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>
            {isSuperAdmin && (
              <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                <label>Nível de acesso (JWT role)</label>
                <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                  <option value="authenticated">Utilizador (padrão)</option>
                  <option value="STUDENT">Aluno (STUDENT)</option>
                  <option value="COMPANY">Empresa (COMPANY)</option>
                  <option value="TEACHER">Professor (TEACHER)</option>
                  <option value="COORDINATOR">Coordenador (COORDINATOR)</option>
                  <option value="ADMIN">Administrador (ADMIN)</option>
                  <option value="SUPER_ADMIN">Super Admin (SUPER_ADMIN)</option>
                </select>
                <p className="form-hint">
                  O role é alinhado automaticamente com o tipo ao guardar.
                </p>
              </div>
            )}
          </div>
          <div className="form-field" style={{ marginTop: "0.75rem" }}>
            <label>Biografia</label>
            <textarea rows={2} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? "A guardar…" : "Guardar alterações"}
            </button>
            <button type="button" className="btn secondary" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Register User Form ──────────────────────────────────────────
const BLANK_USER = {
  email: "",
  password: "",
  confirmPassword: "",
  display_name: "",
  type: "student",
  role: "authenticated",
  moderation: "active",
  areaId: "",
};

function normalizeRoleByType(type, role) {
  return defaultRoleForAccountType(type, role);
}

function RegisterUserSection({ toast, onCreated, isSuperAdmin, areas }) {
  const [form, setForm] = useState(BLANK_USER);
  const [step, setStep] = useState(1);
  const [openWizard, setOpenWizard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: "", text: "" });

  function isValidEmail(value) {
    const email = String(value ?? "").trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  function openRegisterWizard() {
    setForm(BLANK_USER);
    setStep(1);
    setSubmitMessage({ type: "", text: "" });
    setOpenWizard(true);
  }

  function closeRegisterWizard() {
    if (submitting) return;
    setOpenWizard(false);
    setStep(1);
    setSubmitMessage({ type: "", text: "" });
  }

  function handleTypeChange(nextType) {
    setForm((prev) => ({
      ...prev,
      type: nextType,
      role: defaultRoleForAccountType(nextType, prev.role),
      areaId: nextType === "admin" ? prev.areaId : "",
      email: "", // Limpar email ao mudar tipo
    }));
    setSubmitMessage({ type: "", text: "" });
  }

  function getDisplayEmail(type, email) {
    if (!email) return "";
    if (type === "student") {
      const normalized = normalizeStudentProcessNumber(email.trim());
      if (normalized) {
        const domain = String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase() || "giva.ao";
        return `aluno.${normalized}@${domain}`;
      }
    }
    return email.trim().toLowerCase();
  }

  function getEmailPlaceholder(type) {
    if (type === "student") {
      return "Ex: 7483 (número de processo) ou aluno@giva.ao";
    }
    if (type === "company") {
      return "Ex: empresa@empresa.ao";
    }
    return "Ex: utilizador@giva.ao";
  }

  function canGoNext() {
    if (step === 1) return Boolean(form.type);
    if (step === 2) {
      if (!form.role) return false;
      if (form.role === "COORDINATOR" || form.role === "ADMIN_1") return Boolean(form.areaId);
      return true;
    }
    if (step === 3) {
      const hasIdentity = form.display_name.trim() && form.email.trim();
      if (!hasIdentity) return false;
      if (form.password.length < 8) return false;
      if (form.password !== form.confirmPassword) return false;
      return true;
    }
    return true;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitMessage({ type: "", text: "" });

    if (!isSuperAdmin) {
      setSubmitMessage({ type: "error", text: "Apenas o Super Admin pode criar utilizadores." });
      toast("Apenas o Super Admin pode criar utilizadores.", "error");
      return;
    }

    if (!form.email.trim()) {
      setSubmitMessage({ type: "error", text: "Email é obrigatório." });
      toast("Email é obrigatório.", "error");
      return;
    }
    if (!form.display_name.trim()) {
      setSubmitMessage({ type: "error", text: "Nome de apresentação é obrigatório." });
      toast("Nome de apresentação é obrigatório.", "error");
      return;
    }
    if (form.password.length < 8) {
      setSubmitMessage({ type: "error", text: "Password deve ter pelo menos 8 caracteres." });
      toast("Password deve ter pelo menos 8 caracteres.", "error");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setSubmitMessage({ type: "error", text: "As passwords não coincidem." });
      toast("As passwords não coincidem.", "error");
      return;
    }
    if ((form.role === "COORDINATOR" || form.role === "ADMIN_1") && !form.areaId) {
      setSubmitMessage({ type: "error", text: "Para coordenador, a área de formação é obrigatória." });
      toast("Para coordenador, a área de formação é obrigatória.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const moderation = defaultModerationForAccountType(form.type);
      const finalEmail = getDisplayEmail(form.type, form.email);

      if (!isValidEmail(finalEmail)) {
        setSubmitMessage({ type: "error", text: "Informe um email válido para login (ex: nome@dominio.ao)." });
        toast("Informe um email válido para login (ex: nome@dominio.ao).", "error");
        return;
      }

      const processNumber = form.type === "student"
        ? getStudentProcessNumberFromIdentifier(form.email)
        : null;

      const uid = await adminCreatePlatformUser({
        email: finalEmail,
        password: form.password,
        display_name: form.display_name.trim(),
        type: form.type,
        role: form.role,
        moderation,
        processNumber,
        areaId: form.areaId,
        requirePasswordChange: true,
      });

      if (form.role === "COORDINATOR" || form.role === "ADMIN_1") {
        await adminSetUserArea(uid, form.areaId);
      }

      setSubmitMessage({
        type: "success",
        text: `Utilizador criado com sucesso. ID: ${uid}`,
      });
      toast(`Utilizador criado — ID: ${uid}`);

      setForm(BLANK_USER);
      setOpenWizard(false);
      setStep(1);
      if (onCreated) onCreated();
    } catch (err) {
      setSubmitMessage({ type: "error", text: err.message || "Erro ao criar utilizador." });
      toast("Erro ao criar utilizador: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="admin-process-empty">
        <span className="material-icons-sharp">lock</span>
        <p>Somente o Super Admin pode criar novos utilizadores e definir níveis de acesso.</p>
      </div>
    );
  }

  const roleOptions = getAllowedRolesForType(form.type);

  return (
    <div style={{ maxWidth: "640px" }}>
      <h3 className="admin-section-h3" style={{ marginBottom: "0.75rem" }}>Registar Novo Utilizador</h3>
      <p className="form-hint" style={{ marginBottom: "1rem" }}>
        Processo guiado em etapas: tipo de conta, nível de acesso, identidade e ativação.
      </p>
      <button className="btn primary" type="button" onClick={openRegisterWizard}>
        <span className="material-icons-sharp">person_add</span>
        Abrir Assistente de Registo
      </button>

      {openWizard && (
        <div className="admin-modal-overlay" onClick={closeRegisterWizard}>
          <div className="admin-modal" style={{ maxWidth: "760px" }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 style={{ margin: 0 }}>Assistente de Registo ({step}/4)</h3>
              <button type="button" className="btn ghost sm" onClick={closeRegisterWizard}>
                <span className="material-icons-sharp">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
              {step === 1 && (
                <div className="form-grid">
                  <div className="form-field" style={{ gridColumn: "1 / -1" }}>
                    <label>1) Tipo de utilizador</label>
                    <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}>
                      <option value="student">Aluno</option>
                      <option value="company">Empresa</option>
                      <option value="coordinator">Coordenador</option>
                      <option value="teacher">Professor</option>
                      <option value="external">Externo</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="form-grid">
                  <div className="form-field">
                    <label>2) Nível de acesso</label>
                    <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                      {roleOptions.includes("authenticated") && <option value="authenticated">Utilizador</option>}
                      {roleOptions.includes("STUDENT") && <option value="STUDENT">Aluno</option>}
                      {roleOptions.includes("COMPANY") && <option value="COMPANY">Empresa</option>}
                      {roleOptions.includes("TEACHER") && <option value="TEACHER">Professor</option>}
                      {roleOptions.includes("COORDINATOR") && <option value="COORDINATOR">Coordenador</option>}
                      {roleOptions.includes("ADMIN_1") && <option value="ADMIN_1">Coordenador legado (ADMIN_1)</option>}
                      {roleOptions.includes("ADMIN") && <option value="ADMIN">Administrador</option>}
                      {roleOptions.includes("SUPER_ADMIN") && <option value="SUPER_ADMIN">Super Admin</option>}
                    </select>
                  </div>
                  {(form.role === "COORDINATOR" || form.role === "ADMIN_1") && (
                    <div className="form-field">
                      <label>Área de formação do coordenador *</label>
                      <select value={form.areaId} onChange={(e) => set("areaId", e.target.value)} required>
                        <option value="">Selecionar área...</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>{area.nome ?? area.name ?? area.code ?? area.id}</option>
                        ))}
                      </select>
                      <p className="form-hint">Obrigatório para limitar acesso do coordenador aos recursos da sua área.</p>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="form-grid">
                  <div className="form-field">
                    <label>3) Nome de apresentação *</label>
                    <input required value={form.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="Ex: João Silva" />
                  </div>
                  <div className="form-field">
                    <label>Email ou Número de Processo *</label>
                    <input
                      required
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder={getEmailPlaceholder(form.type)}
                      title={form.type === "student" ? "Para alunos: insira o número de processo (ex: 7483) ou um email (ex: aluno@giva.ao)" : "Insira um email válido"}
                    />
                    {form.email && (
                      <p className="form-hint">
                        Email que será usado para login: <strong>{getDisplayEmail(form.type, form.email)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="form-field">
                    <label>Password inicial * (mín. 8 caracteres)</label>
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <p className="form-hint">O utilizador terá de mudar a password no primeiro acesso.</p>
                  </div>
                  <div className="form-field">
                    <label>Confirmar password *</label>
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={form.confirmPassword}
                      onChange={(e) => set("confirmPassword", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="admin-process-empty" style={{ margin: 0 }}>
                  <span className="material-icons-sharp">fact_check</span>
                  <p>
                    Confirmar registo: <strong>{form.display_name || "—"}</strong><br />
                    Email de login: <strong>{getDisplayEmail(form.type, form.email) || "—"}</strong><br />
                    Nível de acesso: <strong>{form.role}</strong>
                    {(form.role === "COORDINATOR" || form.role === "ADMIN_1") ? ` (Área: ${areas.find((a) => a.id === form.areaId)?.nome ?? areas.find((a) => a.id === form.areaId)?.name ?? form.areaId})` : ""}
                  </p>
                  <p className="form-hint" style={{ marginTop: "0.75rem" }}>
                    A password inicial definida será exigida na primeira autenticação.
                  </p>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: "1rem" }}>
                <button type="button" className="btn secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || submitting}>
                  Anterior
                </button>
                {step < 4 ? (
                  <button type="button" className="btn primary" onClick={() => setStep((s) => Math.min(4, s + 1))} disabled={!canGoNext() || submitting}>
                    Próximo
                  </button>
                ) : (
                  <button className="btn primary" type="submit" disabled={submitting}>
                    <span className="material-icons-sharp">person_add</span>
                    {submitting ? "A criar…" : "Criar Utilizador"}
                  </button>
                )}
              </div>

              {submitMessage.text ? (
                <p
                  style={{
                    marginTop: "0.75rem",
                    marginBottom: 0,
                    fontSize: "0.85rem",
                    color: submitMessage.type === "error" ? "var(--danger, #dc2626)" : "var(--success, #059669)",
                  }}
                >
                  {submitMessage.text}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      )}

      <div className="admin-process-empty" style={{ marginTop: "1.5rem", fontSize: "0.82rem" }}>
        <span className="material-icons-sharp">info</span>
        <p>
          Para coordenadores, a área de formação é obrigatória e aplicada no metadata JWT (area_id).
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function UsersManagementPage({ embedded = false, showToast: showToastProp }) {
  const ctx = useOutletContext?.() ?? {};
  const showToast = showToastProp ?? ctx?.showToast;
  const { authProfile } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [areas, setAreas] = useState([]);
  const [resettingEmail, setResettingEmail] = useState(null);

  const isSuperAdmin = String(authProfile?.role ?? "").toUpperCase() === "SUPER_ADMIN";

  function toast(msg, type = "success") {
    if (showToast) showToast(msg, type);
    else console.info("[toast]", msg);
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminListUsers();
      setUsers(
        (data ?? []).map((user) => ({
          ...user,
          role: normalizeRole(user?.role),
        }))
      );
    } catch (err) {
      toast("Erro ao carregar utilizadores: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function quickSetModeration(id, status) {
    const { error } = await (await import("../lib/supabase.js")).supabase
      .from("user_profiles").update({ moderation: status }).eq("id", id);
    if (error) { toast("Erro: " + error.message, "error"); return; }
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, moderation: status } : u));
    toast(status === "active" ? "Conta ativada." : status === "suspended" ? "Conta suspensa." : "Estado atualizado.");
  }

  async function handleDeleteUser() {
    if (!deletingUser) return;
    const uid = deletingUser.id;
    setDeletingUser(null);
    try {
      await adminDeleteUser(uid);
      setUsers((prev) => prev.filter((u) => u.id !== uid));
      toast("Utilizador eliminado.");
    } catch (err) {
      toast("Erro ao eliminar: " + err.message, "error");
    }
  }

  async function handleSendReset(email) {
    if (resettingEmail) return;
    setResettingEmail(email);
    try {
      await adminSendPasswordReset(email);
      toast(`Email de reset enviado para ${email}.`);
    } catch (err) {
      toast("Erro ao enviar reset: " + err.message, "error");
    } finally {
      setResettingEmail(null);
    }
  }

  useEffect(() => {
    if (activeTab === "list") loadUsers();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSuperAdmin) {
      setAreas([]);
      if (activeTab !== "list") {
        setActiveTab("list");
      }
      return;
    }
    listTrainingAreas().then((data) => setAreas(data ?? [])).catch(() => setAreas([]));
  }, [isSuperAdmin, activeTab]);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const byType = users.reduce((acc, u) => {
      acc[u.type] = (acc[u.type] ?? 0) + 1;
      return acc;
    }, {});
    const byRole = users.reduce((acc, u) => {
      const r = normalizeRole(u.role);
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});
    const pending = users.filter((u) => u.moderation === "pending").length;
    const suspended = users.filter((u) => u.moderation === "suspended").length;
    return { total, byType, byRole, pending, suspended };
  }, [users]);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q
        || (u.display_name ?? "").toLowerCase().includes(q)
        || (u.email ?? "").toLowerCase().includes(q);
      const matchType = !filterType || u.type === filterType;
      const matchRole = !filterRole || normalizeRole(u.role) === filterRole;
      return matchSearch && matchType && matchRole;
    });
  }, [users, search, filterType, filterRole]);

  const TABS = [
    { id: "list", icon: "group", label: `Utilizadores${stats.total ? ` (${stats.total})` : ""}` },
    ...(isSuperAdmin ? [{ id: "register", icon: "person_add", label: "Registar" }] : []),
  ];

  return (
    <div className={embedded ? "" : "admin-page"}>
      {!embedded && (
        <PageHeader
          title="Gestão de Utilizadores"
          subtitle="Administração global de contas e permissões"
          icon="manage_accounts"
        />
      )}

      {/* Modais globais */}
      {deletingUser && (
        <DeleteConfirmModal
          user={deletingUser}
          onConfirm={handleDeleteUser}
          onCancel={() => setDeletingUser(null)}
        />
      )}

      {/* Stats Row */}
      {users.length > 0 && (
        <div className="admin-stats-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-stat-card">
            <span className="material-icons-sharp admin-stat-icon" style={{ color: "var(--primary)" }}>group</span>
            <div>
              <div className="admin-stat-value">{stats.total}</div>
              <div className="admin-stat-label">Total</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <span className="material-icons-sharp admin-stat-icon" style={{ color: "#059669" }}>school</span>
            <div>
              <div className="admin-stat-value">{stats.byType.student ?? 0}</div>
              <div className="admin-stat-label">Alunos</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <span className="material-icons-sharp admin-stat-icon" style={{ color: "#7856ff" }}>apartment</span>
            <div>
              <div className="admin-stat-value">{stats.byType.company ?? 0}</div>
              <div className="admin-stat-label">Empresas</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <span className="material-icons-sharp admin-stat-icon" style={{ color: "#dc2626" }}>admin_panel_settings</span>
            <div>
              <div className="admin-stat-value">{stats.byType.admin ?? 0}</div>
              <div className="admin-stat-label">Admins</div>
            </div>
          </div>
          {stats.pending > 0 && (
            <div className="admin-stat-card">
              <span className="material-icons-sharp admin-stat-icon" style={{ color: "#d97706" }}>hourglass_top</span>
              <div>
                <div className="admin-stat-value">{stats.pending}</div>
                <div className="admin-stat-label">Pendentes</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="material-icons-sharp">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: List */}
      {activeTab === "list" && (
        <PanelSection title="Todos os Utilizadores" icon="group">
          {/* Edit modal */}
          {editingUser && (
            <UserEditModal
              user={editingUser}
              isSuperAdmin={isSuperAdmin}
              toast={toast}
              onClose={() => setEditingUser(null)}
              onSaved={(updated) => {
                setUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
                setEditingUser(null);
              }}
            />
          )}

          {/* Filters */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <span className="material-icons-sharp" style={{
                position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)",
                fontSize: "1rem", color: "var(--text-muted)", pointerEvents: "none",
              }}>search</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome ou email…"
                style={{ paddingLeft: "2rem", width: "100%" }}
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ flex: "0 0 160px" }}
            >
              <option value="">Todos os tipos</option>
              <option value="student">Aluno</option>
              <option value="company">Empresa</option>
              <option value="admin">Administrador</option>
              <option value="external">Externo</option>
            </select>
            {isSuperAdmin && (
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                style={{ flex: "0 0 180px" }}
              >
                <option value="">Todos os níveis</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="COORDINATOR">Coordenador</option>
                <option value="ADMIN_1">Coordenador legado (ADMIN_1)</option>
                <option value="COMPANY">Empresa</option>
                <option value="authenticated">Utilizador</option>
              </select>
            )}
            <button
              className="btn ghost sm"
              onClick={() => { setSearch(""); setFilterType(""); setFilterRole(""); loadUsers(); }}
            >
              <span className="material-icons-sharp">refresh</span>
              Atualizar
            </button>
          </div>

          {loading ? (
            <p className="admin-loading">A carregar utilizadores…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-empty">Nenhum utilizador encontrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Utilizador</th>
                    <th>Tipo</th>
                    {isSuperAdmin && <th>Nível (role)</th>}
                    <th>Estado</th>
                    <th>Registado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id} className="admin-table-row">
                      <td data-label="Utilizador">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <Avatar name={u.display_name} />
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{u.display_name || "—"}</div>
                            <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Tipo"><Badge meta={TYPE_LABELS[u.type]} /></td>
                      {isSuperAdmin && (
                        <td data-label="Nível"><Badge meta={ROLE_LABELS[normalizeRole(u.role)]} /></td>
                      )}
                      <td data-label="Estado"><Badge meta={MODERATION_LABELS[normModeration(u.moderation)]} /></td>
                      <td data-label="Registado em" style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("pt-PT") : "—"}
                      </td>
                      <td data-label="Ações">
                        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                          {u.moderation === "pending" && (
                            <button type="button" className="btn primary sm" onClick={() => quickSetModeration(u.id, "active")}>
                              <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>check_circle</span>
                              Ativar
                            </button>
                          )}
                          {u.moderation === "active" && (
                            <button type="button" className="btn danger sm" onClick={() => quickSetModeration(u.id, "suspended")}>
                              <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>block</span>
                              Suspender
                            </button>
                          )}
                          {u.moderation === "suspended" && (
                            <button type="button" className="btn primary sm" onClick={() => quickSetModeration(u.id, "active")}>
                              <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>check_circle</span>
                              Reativar
                            </button>
                          )}
                          <button type="button" className="btn ghost sm" onClick={() => setEditingUser(u)}>
                            <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>edit</span>
                            Editar
                          </button>
                          {isSuperAdmin && (
                            <button type="button" className="btn danger sm" onClick={() => setDeletingUser(u)} title="Eliminar conta">
                              <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>delete</span>
                            </button>
                          )}
                          {isSuperAdmin && u.email && (
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => handleSendReset(u.email)}
                              disabled={resettingEmail === u.email}
                              title="Reenviar email de reset de password"
                            >
                              <span className="material-icons-sharp" style={{ fontSize: "0.85rem" }}>
                                {resettingEmail === u.email ? "hourglass_top" : "key"}
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem", textAlign: "right" }}>
                {filtered.length} de {users.length} utilizadores
              </p>
            </div>
          )}
        </PanelSection>
      )}

      {/* Tab: Register */}
      {activeTab === "register" && (
        <PanelSection title="Novo Utilizador" icon="person_add">
          <RegisterUserSection
            toast={toast}
            isSuperAdmin={isSuperAdmin}
            areas={areas}
            onCreated={() => {
              setActiveTab("list");
              setUsers([]); // force reload
              loadUsers();
            }}
          />
        </PanelSection>
      )}
    </div>
  );
}
