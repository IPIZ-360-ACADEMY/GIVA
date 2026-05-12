import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import "../styles/admin.css";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { getPendingPosts, moderatePost } from "../services/postsService.js";
import { broadcastAnnouncement, sendNotification } from "../services/notificationsService.js";
import { listManualClasses, createManualClass } from "../services/classesService.js";
import { registerStudentUnified } from "../services/studentRegistryService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { isCoordinatorRole } from "../utils/accessControl.js";

export function canAccessAdminPanel(role) {
  return String(role ?? "").toUpperCase() === "SUPER_ADMIN";
}

export function canRunAdminSensitiveAction(role) {
  return canAccessAdminPanel(role);
}

// ── helpers ────────────────────────────────────────────────────
function Badge({ label, variant = "neutral" }) {
  const colors = {
    neutral: "#6b7280",
    warning: "#d97706",
    success: "#059669",
    danger:  "#dc2626",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.2rem 0.55rem",
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: 600,
        background: `${colors[variant]}22`,
        color: colors[variant],
      }}
    >
      {label}
    </span>
  );
}

function Avatar({ url, name, size = 36 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  if (url) return <img src={url} alt={name} className="admin-avatar" style={{ width: size, height: size }} />;
  return (
    <div className="admin-avatar admin-avatar-fallback" style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}

function toLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseSchoolYear(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  if (endYear !== startYear + 1) return null;
  return { startYear, endYear };
}

function isPastSchoolYear(value) {
  const parsed = parseSchoolYear(value);
  if (!parsed) return false;
  return parsed.startYear < new Date().getFullYear();
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color = "var(--primary)" }) {
  return (
    <div className="admin-stat-card">
      <span className="material-icons-sharp admin-stat-icon" style={{ color }}>{icon}</span>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Pending Company Row ───────────────────────────────────────
function CompanyRow({ profile, onApprove, onReject }) {
  return (
    <tr className="admin-table-row">
      <td data-label="Empresa">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Avatar url={profile.avatar_url} name={profile.display_name} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{profile.display_name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{profile.email}</div>
          </div>
        </div>
      </td>
      <td data-label="Registado em">{profile.created_at ? new Date(profile.created_at).toLocaleDateString("pt-PT") : "—"}</td>
      <td data-label="Estado">
        <Badge label="Pendente" variant="warning" />
      </td>
      <td data-label="Ações">
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn primary sm" onClick={() => onApprove(profile.id)}>
            <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>check</span>
            Aprovar
          </button>
          <button type="button" className="btn danger sm" onClick={() => onReject(profile.id)}>
            <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>close</span>
            Rejeitar
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Pending Post Row ──────────────────────────────────────────
function PostRow({ post, onApprove, onReject }) {
  return (
    <tr className="admin-table-row">
      <td data-label="Publicação">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Avatar url={post.author?.avatar_url} name={post.author?.display_name} />
          <div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{post.author?.display_name ?? "Sem autor"}</div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                maxWidth: "24rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {post.content}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Data">{post.created_at ? new Date(post.created_at).toLocaleDateString("pt-PT") : "—"}</td>
      <td data-label="Estado">
        <Badge label="Pendente" variant="warning" />
      </td>
      <td data-label="Ações">
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="btn primary sm" onClick={() => onApprove(post.id)}>
            <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>check</span>
            Aprovar
          </button>
          <button type="button" className="btn danger sm" onClick={() => onReject(post.id)}>
            <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>close</span>
            Rejeitar
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── StudentRegisterSection ─────────────────────────────────────
const BLANK_STUDENT = {
  full_name: "", process_number: "", email: "", phone_number: "", date_of_birth: "",
  training_area_id: "", turma: "", course: "",
  password: "", confirmPassword: "",
  guardian_name: "", guardian_phone: "", guardian_relation: "",
};

function StudentRegisterSection({ toast, authProfile }) {
  const [form, setForm] = useState(BLANK_STUDENT);
  const [areas, setAreas] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const maxDob = toLocalIsoDate();

  useEffect(() => {
    let query = supabase.from("training_area").select("id,code,name").eq("is_active", true).order("display_order");
    // Se for coordenador, filtra apenas a área atribuída
    if (isCoordinatorRole(authProfile?.role) && authProfile?.areaId) {
      query = query.eq("id", authProfile.areaId);
    }
    query.then(({ data }) => setAreas(data ?? []))
      .catch(() => {});
  }, []);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  const loginEmailPreview = form.process_number.trim()
    ? `aluno.${normalizeStudentProcessNumber(form.process_number).toLowerCase()}@${String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase() || "giva.ao"}`
    : "aluno.processo@giva.ao";

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast("Nome completo é obrigatório.", "error"); return; }
    if (!form.process_number.trim()) { toast("Número de processo é obrigatório.", "error"); return; }
    if (form.password.length < 8) { toast("A palavra-passe deve ter pelo menos 8 caracteres.", "error"); return; }
    if (form.password !== form.confirmPassword) { toast("As palavras-passe não coincidem.", "error"); return; }
    if (form.date_of_birth && form.date_of_birth > maxDob) {
      toast("Data de nascimento não pode ser no futuro.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const processNumber = normalizeStudentProcessNumber(form.process_number);
      const registered = await registerStudentUnified({
        fullName: form.full_name,
        processNumber,
        email: form.email,
        phoneNumber: form.phone_number,
        dateOfBirth: form.date_of_birth,
        trainingAreaId: form.training_area_id || null,
        className: form.turma,
        courseCode: form.course,
        loginPassword: form.password,
        guardianName: form.guardian_name,
        guardianPhone: form.guardian_phone,
        guardianRelation: form.guardian_relation,
      });

      setResult({
        processNumber: registered.processNumber,
        name: registered.fullName,
        turma: form.turma,
        loginEmail: registered.loginEmail,
        authAlreadyExists: registered.authAlreadyExists,
      });
      setForm(BLANK_STUDENT);
      toast(`Aluno registado — Nº ${registered.processNumber}`);
    } catch (err) {
      toast("Erro inesperado: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  function copyProcess() {
    if (!result) return;
    navigator.clipboard.writeText(result.processNumber).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="admin-academic-split">
      <div className="admin-academic-form">
        <h3 className="admin-section-h3">Registar Aluno</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="as-name">Nome completo *</label>
              <input id="as-name" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-process">Número de processo *</label>
              <input
                id="as-process"
                required
                placeholder="Ex: IPIZ-2026-0001"
                value={form.process_number}
                onChange={(e) => set("process_number", normalizeStudentProcessNumber(e.target.value))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="as-dob">Data de nascimento</label>
              <input id="as-dob" type="date" max={maxDob} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-phone">Telefone</label>
              <input id="as-phone" type="tel" placeholder="+244 9xx…" value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-email">Email (opcional)</label>
              <input id="as-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-password">Palavra-passe de adesão *</label>
              <input
                id="as-password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
              <small className="form-hint">Login automático do aluno: {loginEmailPreview}</small>
            </div>
            <div className="form-field">
              <label htmlFor="as-password-confirm">Confirmar a palavra-passe *</label>
              <input
                id="as-password-confirm"
                type="password"
                minLength={8}
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                placeholder="Repete a palavra-passe"
              />
            </div>
            {areas.length > 0 && (
              <div className="form-field">
                <label htmlFor="as-area">Área de Formação</label>
                <select id="as-area" value={form.training_area_id} onChange={(e) => set("training_area_id", e.target.value)}>
                  <option value="">Selecionar…</option>
                  {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="form-field">
              <label htmlFor="as-turma">Turma</label>
              <input id="as-turma" placeholder="Ex: 11-TI-A" value={form.turma} onChange={(e) => set("turma", e.target.value)} />
            </div>
          </div>

          <h4 style={{ margin: "1rem 0 0.5rem", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>
            Encarregado de Educação
          </h4>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="as-guard-name">Nome do encarregado</label>
              <input id="as-guard-name" value={form.guardian_name} onChange={(e) => set("guardian_name", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-guard-phone">Contacto</label>
              <input id="as-guard-phone" type="tel" value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="as-guard-rel">Relação</label>
              <select id="as-guard-rel" value={form.guardian_relation} onChange={(e) => set("guardian_relation", e.target.value)}>
                <option value="">—</option>
                <option value="Pai">Pai</option>
                <option value="Mãe">Mãe</option>
                <option value="Tutor Legal">Tutor Legal</option>
                <option value="Irmão/Irmã">Irmão/Irmã</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              <span className="material-icons-sharp">person_add</span>
              {submitting ? "A registar…" : "Registar Aluno"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-academic-result">
        {result ? (
          <div className="admin-process-card">
            <span className="material-icons-sharp admin-process-check">check_circle</span>
            <h4>Aluno Registado</h4>
            <div className="admin-process-number">{result.processNumber}</div>
            <p className="admin-process-name">{result.name}</p>
            {result.turma && <p className="meta">Turma: {result.turma}</p>}
            {result.loginEmail && <p className="meta">Login: {result.loginEmail}</p>}
            <button className="btn secondary" style={{ marginTop: "0.75rem" }} onClick={copyProcess}>
              <span className="material-icons-sharp">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copiado!" : "Copiar Nº de Processo"}
            </button>
            <p className="form-hint" style={{ marginTop: "0.75rem" }}>
              {result.authAlreadyExists
                ? "A conta de acesso já existia para este processo e mantém a palavra-passe anterior."
                : "O aluno já pode iniciar sessão com este login e a palavra-passe definida no registo."}
            </p>
          </div>
        ) : (
          <div className="admin-process-empty">
            <span className="material-icons-sharp">badge</span>
            <p>O número de processo informado aparecerá aqui após o registo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ClassesAdminSection ────────────────────────────────────────
const BLANK_CLASS = { turma: "", anoLetivo: "", curso: "", supervisor: "", total: "", ativos: "" };

function ClassesAdminSection({ toast }) {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(BLANK_CLASS);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    try {
      const data = await listManualClasses();
      setClasses(data);
    } catch (err) {
      toast(err?.message ?? "Não foi possível carregar as turmas.", "error");
    }
  }

  useEffect(() => { load(); }, []);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.turma.trim()) { toast("Nome da turma é obrigatório.", "error"); return; }
    const normalizedYear = form.anoLetivo.trim() || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
    if (!parseSchoolYear(normalizedYear)) {
      toast("Ano letivo inválido. Use o formato YYYY/YYYY.", "error");
      return;
    }
    if (isPastSchoolYear(normalizedYear)) {
      toast("Não é permitido registar ano letivo anterior ao ano atual.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createManualClass({
        turma: form.turma.trim(),
        anoLetivo: normalizedYear,
        curso: form.curso.trim() || "—",
        supervisor: form.supervisor.trim() || "—",
        total: parseInt(form.total) || 0,
        ativos: parseInt(form.ativos) || 0,
      });
      toast("Turma criada.");
      setForm(BLANK_CLASS);
      setShowForm(false);
      load();
    } catch (err) {
      toast("Erro ao criar turma: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 className="admin-section-h3">Turmas</h3>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>
          <span className="material-icons-sharp">{showForm ? "close" : "add"}</span>
          {showForm ? "Cancelar" : "Nova Turma"}
        </button>
      </div>

      {showForm && (
        <div className="form-card" style={{ marginBottom: "1.5rem" }}>
          <form onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="ac-turma">Nome da turma *</label>
                <input id="ac-turma" required placeholder="Ex: 11-TI-A" value={form.turma} onChange={(e) => set("turma", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="ac-ano">Ano letivo</label>
                <input id="ac-ano" placeholder="2026/2027" value={form.anoLetivo} onChange={(e) => set("anoLetivo", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="ac-curso">Curso</label>
                <input id="ac-curso" placeholder="Ex: TI, EIE, TLQB" value={form.curso} onChange={(e) => set("curso", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="ac-sup">Supervisor/Professor</label>
                <input id="ac-sup" value={form.supervisor} onChange={(e) => set("supervisor", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="ac-total">Nº total de alunos</label>
                <input id="ac-total" type="number" min="0" value={form.total} onChange={(e) => set("total", e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="ac-ativos">Alunos em estágio</label>
                <input id="ac-ativos" type="number" min="0" value={form.ativos} onChange={(e) => set("ativos", e.target.value)} />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={submitting}>
                {submitting ? "A criar…" : "Criar Turma"}
              </button>
            </div>
          </form>
        </div>
      )}

      {classes.length === 0 ? (
        <p className="admin-empty">Nenhuma turma registada.</p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Ano letivo</th>
                <th>Curso</th>
                <th>Supervisor</th>
                <th>Total</th>
                <th>Em estágio</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="admin-table-row">
                  <td style={{ fontWeight: 700 }}>{c.turma}</td>
                  <td>{c.anoLetivo}</td>
                  <td>{c.curso}</td>
                  <td>{c.supervisor}</td>
                  <td>{c.total}</td>
                  <td>{c.ativos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── UserEditModal ──────────────────────────────────────────────
function UserEditModal({ user, onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    display_name: user.display_name ?? "",
    bio: user.bio ?? "",
    avatar_url: user.avatar_url ?? "",
    type: user.type ?? "external",
    moderation: user.moderation ?? "active",
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("user_profiles").update({
      display_name: form.display_name.trim(),
      bio: form.bio.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
      type: form.type,
      moderation: form.moderation,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast("Erro ao guardar: " + error.message, "error"); return; }
    toast("Perfil atualizado.");
    onSaved({ ...user, ...form });
  }

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>Editar Perfil</h3>
          <button type="button" className="btn ghost sm" onClick={onClose}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>
        <p className="meta" style={{ marginBottom: "1rem" }}>{user.email}</p>
        <form onSubmit={handleSave}>
          <div className="form-grid">
            <div className="form-field">
              <label>Nome de apresentação</label>
              <input value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
            </div>
            <div className="form-field">
              <label>URL do avatar</label>
              <input type="url" value={form.avatar_url} placeholder="https://…" onChange={(e) => set("avatar_url", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Tipo de conta</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="student">Aluno</option>
                <option value="company">Empresa</option>
                <option value="external">Externo</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="form-field">
              <label>Estado</label>
              <select value={form.moderation} onChange={(e) => set("moderation", e.target.value)}>
                <option value="active">Ativo</option>
                <option value="pending">Pendente</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>
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

// ── AnnouncementSection ────────────────────────────────────────
function AnnouncementSection({ user, toast }) {
  const [form, setForm] = useState({ title: "", body: "", target: "" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.title.trim()) { toast("O título é obrigatório.", "error"); return; }
    setSubmitting(true);
    setResult(null);
    try {
      const { sent, errors } = await broadcastAnnouncement({
        actorId: user?.id ?? null,
        title: form.title.trim(),
        body: form.body.trim() || null,
        targetType: form.target || null,
      });
      setResult({ sent, errors });
      if (errors === 0) toast(`Anúncio enviado para ${sent} utilizador(es).`);
      else toast(`Enviado para ${sent}, falhou em ${errors}.`, errors > 0 ? "warning" : "success");
    } catch (err) {
      toast("Erro ao enviar: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-announcement-wrap">
      <h3 className="admin-section-h3">Enviar Anúncio</h3>
      <p className="meta" style={{ marginBottom: "1rem" }}>
        Envia uma notificação de anúncio para utilizadores ativos da plataforma.
      </p>
      <div className="form-card">
        <form onSubmit={handleSend}>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="ann-title">Título *</label>
              <input id="ann-title" required maxLength={120} placeholder="Ex: Início das inscrições para estágios 2026/27" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="ann-body">Mensagem (opcional)</label>
              <textarea id="ann-body" rows={3} maxLength={500} placeholder="Adicione mais detalhes aqui…" value={form.body} onChange={(e) => set("body", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="ann-target">Destinatários</label>
              <select id="ann-target" value={form.target} onChange={(e) => set("target", e.target.value)}>
                <option value="">Todos os utilizadores ativos</option>
                <option value="student">Apenas Alunos</option>
                <option value="company">Apenas Empresas</option>
                <option value="external">Apenas Externos</option>
              </select>
            </div>
          </div>
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button className="btn primary" type="submit" disabled={submitting}>
              <span className="material-icons-sharp">campaign</span>
              {submitting ? "A enviar…" : "Enviar Anúncio"}
            </button>
          </div>
        </form>
        {result && (
          <div className={`admin-announce-result${result.errors > 0 ? " warn" : " ok"}`}>
            <span className="material-icons-sharp">{result.errors > 0 ? "warning" : "check_circle"}</span>
            Enviado para <strong>{result.sent}</strong> utilizador(es)
            {result.errors > 0 && <> · Falhou em <strong>{result.errors}</strong></>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminPage() {
  const ctx = useOutletContext?.() ?? {};
  const navigate = useNavigate();
  const { showToast } = ctx;
  const { authProfile, user } = useAuth();

  if (!canAccessAdminPanel(authProfile?.role)) {
    return (
      <div className="page">
        <PageHeader
          title="Painel de Administração"
          subtitle="Área restrita a Super Admin."
          icon="admin_panel_settings"
        />
        <div className="tools-empty" style={{ gridColumn: "1/-1" }}>
          <span className="material-icons-sharp">lock</span>
          <p>Não tem permissão para aceder a esta área.</p>
        </div>
      </div>
    );
  }

  const [stats, setStats] = useState({ users: 0, companies: 0, posts: 0, pendingCompanies: 0, pendingPosts: 0 });
  const [pendingCompanies, setPendingCompanies] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("overview"); // overview | companies | posts | users | academico
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [academicTab, setAcademicTab] = useState("students"); // students | classes | users | announce
  const [editingUser, setEditingUser] = useState(null);

  function toast(msg, type = "success") {
    if (showToast) showToast(msg, type);
    else console.info("[toast]", msg);
  }

  function allowSensitiveAction(actionLabel) {
    if (canRunAdminSensitiveAction(authProfile?.role)) {
      return true;
    }

    toast(`Permissão insuficiente para ${actionLabel}.`, "error");
    return false;
  }

  // Load stats + pending data on mount
  useEffect(() => {
    async function loadAll() {
      try {
        const [
          { count: userCount },
          { count: companyCount },
          { count: postCount },
          { count: pendingCompanyCount },
          { count: pendingPostCount },
        ] = await Promise.all([
          supabase.from("user_profiles").select("*", { count: "exact", head: true }),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("type", "company"),
          supabase.from("posts").select("*", { count: "exact", head: true }),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("type", "company").eq("moderation", "pending"),
          supabase.from("posts").select("*", { count: "exact", head: true }).eq("moderation", "pending"),
        ]);
        setStats({
          users: userCount ?? 0,
          companies: companyCount ?? 0,
          posts: postCount ?? 0,
          pendingCompanies: pendingCompanyCount ?? 0,
          pendingPosts: pendingPostCount ?? 0,
        });
      } catch (err) {
        console.error("AdminPage stats error", err);
      }

      // Pending companies
      try {
        const { data } = await supabase
          .from("user_profiles")
          .select("id, display_name, avatar_url, email, created_at")
          .eq("type", "company")
          .eq("moderation", "pending")
          .order("created_at", { ascending: false });
        setPendingCompanies(data ?? []);
      } catch (err) {
        console.error("AdminPage pendingCompanies error", err);
      } finally {
        setLoadingCompanies(false);
      }

      // Pending posts
      try {
        const posts = await getPendingPosts();
        setPendingPosts(posts);
      } catch (err) {
        console.error("AdminPage pendingPosts error", err);
      } finally {
        setLoadingPosts(false);
      }
    }

    loadAll();
  }, []);

  // Load all users when tab selected (users or academico > users sub-tab)
  useEffect(() => {
    if (activeTab !== "users" && !(activeTab === "academico" && academicTab === "profiles")) return;
    if (allUsers.length > 0) return;
    setLoadingUsers(true);
    supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url, email, type, moderation, created_at")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setAllUsers(data ?? []))
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [activeTab, academicTab, allUsers.length]);

  // ── Actions ────────────────────────────────────────────────
  async function approveCompany(id) {
    if (!allowSensitiveAction("aprovar empresa")) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ moderation: "active" })
      .eq("id", id);
    if (error) { toast("Erro ao aprovar empresa", "error"); return; }
    setPendingCompanies((prev) => prev.filter((c) => c.id !== id));
    setStats((s) => ({ ...s, pendingCompanies: Math.max(0, s.pendingCompanies - 1) }));
    toast("Empresa aprovada com sucesso.");
  }

  async function rejectCompany(id) {
    if (!allowSensitiveAction("rejeitar empresa")) return;
    const { error } = await supabase
      .from("user_profiles")
      .update({ moderation: "suspended" })
      .eq("id", id);
    if (error) { toast("Erro ao rejeitar empresa", "error"); return; }
    setPendingCompanies((prev) => prev.filter((c) => c.id !== id));
    setStats((s) => ({ ...s, pendingCompanies: Math.max(0, s.pendingCompanies - 1) }));
    toast("Empresa rejeitada.", "info");
  }

  async function approvePost(id) {
    if (!allowSensitiveAction("aprovar publicação")) return;
    await moderatePost(id, "approved").catch(() => null);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, pendingPosts: Math.max(0, s.pendingPosts - 1) }));
    toast("Publicação aprovada.");
  }

  async function rejectPost(id) {
    if (!allowSensitiveAction("rejeitar publicação")) return;
    await moderatePost(id, "rejected").catch(() => null);
    setPendingPosts((prev) => prev.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, pendingPosts: Math.max(0, s.pendingPosts - 1) }));
    toast("Publicação rejeitada.", "info");
  }

  async function quickSetModeration(id, status) {
    if (!allowSensitiveAction("alterar moderação de utilizador")) return;
    const { error } = await supabase.from("user_profiles").update({ moderation: status }).eq("id", id);
    if (error) { toast("Erro ao atualizar estado: " + error.message, "error"); return; }
    setAllUsers((prev) => prev.map((u) => u.id === id ? { ...u, moderation: status } : u));
    const msg = status === "active" ? "Utilizador ativado." : status === "suspended" ? "Utilizador suspenso." : "Estado atualizado.";
    toast(msg);
  }

  // ── Render ─────────────────────────────────────────────────
  const TABS = [
    { id: "overview",  icon: "dashboard",         label: "Visão geral" },
    { id: "companies", icon: "apartment",          label: `Empresas${stats.pendingCompanies > 0 ? ` (${stats.pendingCompanies})` : ""}` },
    { id: "posts",     icon: "article",            label: `Publicações${stats.pendingPosts > 0 ? ` (${stats.pendingPosts})` : ""}` },
    { id: "users",     icon: "manage_accounts",    label: "Utilizadores" },
    { id: "academico", icon: "school",             label: "Gestão Académica" },
  ];

  return (
    <div className="admin-page">
      <div className="admin-hero">
        <div className="admin-hero-inner">
          <div className="admin-hero-badge">
            <span className="material-icons-sharp">admin_panel_settings</span>
          </div>
          <div className="admin-hero-text">
            <h1 className="admin-hero-title">Painel de Administração</h1>
            <p className="admin-hero-sub">Bem-vindo, {authProfile?.display_name ?? "Administrador"}</p>
          </div>
        </div>
      </div>

      {/* Modal global — acessível em qualquer tab */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          toast={toast}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setAllUsers((prev) => prev.map((u) => u.id === updated.id ? { ...u, ...updated } : u));
            setEditingUser(null);
          }}
        />
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

      {/* Overview */}
      {activeTab === "overview" && (
        <div>
          <div className="admin-stats-grid">
            <StatCard icon="group" label="Utilizadores" value={stats.users} />
            <StatCard icon="apartment" label="Empresas" value={stats.companies} color="#7856ff" />
            <StatCard icon="article" label="Publicações" value={stats.posts} color="#1d9bf0" />
            <StatCard icon="pending" label="Empresas pendentes" value={stats.pendingCompanies} color="#d97706" />
            <StatCard icon="hourglass_top" label="Posts pendentes" value={stats.pendingPosts} color="#d97706" />
          </div>

          {stats.pendingCompanies > 0 && (
            <div className="admin-alert">
              <span className="material-icons-sharp">warning</span>
              Há <strong>{stats.pendingCompanies}</strong>{" "}
              {stats.pendingCompanies === 1 ? "empresa pendente" : "empresas pendentes"} de aprovação.
              <button type="button" className="btn ghost sm" onClick={() => setActiveTab("companies")}>
                Ver empresas
              </button>
            </div>
          )}

          {stats.pendingPosts > 0 && (
            <div className="admin-alert">
              <span className="material-icons-sharp">warning</span>
              Há <strong>{stats.pendingPosts}</strong>{" "}
              {stats.pendingPosts === 1 ? "publicação pendente" : "publicações pendentes"} de moderação.
              <button type="button" className="btn ghost sm" onClick={() => setActiveTab("posts")}>
                Ver publicações
              </button>
            </div>
          )}

          {stats.pendingCompanies === 0 && stats.pendingPosts === 0 && (
            <div className="admin-all-clear">
              <span className="material-icons-sharp">check_circle</span>
              Tudo em ordem. Nenhum item pendente de revisão.
            </div>
          )}
        </div>
      )}

      {/* Companies */}
      {activeTab === "companies" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="material-icons-sharp">apartment</span>
            <h2>Empresas pendentes de aprovação</h2>
          </div>
          {loadingCompanies ? (
            <p className="admin-loading">A carregar...</p>
          ) : pendingCompanies.length === 0 ? (
            <p className="admin-empty">Nenhuma empresa pendente de aprovação.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Data de registo</th>
                    <th>Estado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCompanies.map((c) => (
                    <CompanyRow key={c.id} profile={c} onApprove={approveCompany} onReject={rejectCompany} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      {activeTab === "posts" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="material-icons-sharp">article</span>
            <h2>Publicações pendentes de moderação</h2>
          </div>
          {loadingPosts ? (
            <p className="admin-loading">A carregar...</p>
          ) : pendingPosts.length === 0 ? (
            <p className="admin-empty">Nenhuma publicação pendente de moderação.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Publicação</th>
                    <th>Data</th>
                    <th>Estado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPosts.map((p) => (
                    <PostRow key={p.id} post={p} onApprove={approvePost} onReject={rejectPost} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Users — lista interativa */}
      {activeTab === "users" && (
        <div className="admin-panel">
          <div className="admin-panel-head">
            <span className="material-icons-sharp">manage_accounts</span>
            <h2>Utilizadores registados</h2>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <button className="btn secondary sm" onClick={() => setAllUsers([])}>
              <span className="material-icons-sharp">refresh</span>
              Atualizar
            </button>
            {authProfile?.role === "SUPER_ADMIN" && (
              <button
                className="btn primary sm"
                onClick={() => navigate("/ferramentas?tab=utilizadores")}
              >
                <span className="material-icons-sharp">person_add</span>
                Gerir em Ferramentas
              </button>
            )}
          </div>
          {loadingUsers ? (
            <p className="admin-loading">A carregar...</p>
          ) : allUsers.length === 0 ? (
            <p className="admin-empty">Nenhum utilizador encontrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Utilizador</th>
                    <th>Tipo</th>
                    <th>Estado</th>
                    <th>Data de registo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((u) => (
                    <tr key={u.id} className="admin-table-row">
                      <td data-label="Utilizador">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <Avatar url={u.avatar_url} name={u.display_name} />
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--text)" }}>{u.display_name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        {u.type === "company"  && <Badge label="Empresa"   variant="neutral" />}
                        {u.type === "student"  && <Badge label="Aluno"     variant="success" />}
                        {u.type === "admin"    && <Badge label="Admin"     variant="danger"  />}
                        {u.type === "external" && <Badge label="Externo"   variant="neutral" />}
                        {!u.type && <Badge label="—" />}
                      </td>
                      <td data-label="Estado">
                        {u.moderation === "pending"   && <Badge label="Pendente"  variant="warning" />}
                        {u.moderation === "active"    && <Badge label="Ativo"    variant="success" />}
                        {u.moderation === "suspended" && <Badge label="Suspenso"  variant="danger"  />}
                        {u.moderation === "rejected"  && <Badge label="Rejeitado" variant="danger"  />}
                        {!u.moderation && <Badge label="—" />}
                      </td>
                      <td data-label="Registado em" style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("pt-PT") : "—"}
                      </td>
                      <td data-label="Ações">
                        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                          {u.moderation === "pending" && (
                            <button type="button" className="btn primary sm" onClick={() => quickSetModeration(u.id, "active")}> 
                              <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>check</span>
                              Ativar
                            </button>
                          )}
                          {u.moderation === "active" && (
                            <button type="button" className="btn danger sm" onClick={() => quickSetModeration(u.id, "suspended")}> 
                              <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>block</span>
                              Suspender
                            </button>
                          )}
                          {u.moderation === "suspended" && (
                            <button type="button" className="btn primary sm" onClick={() => quickSetModeration(u.id, "active")}> 
                              <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>check</span>
                              Reativar
                            </button>
                          )}
                          <button type="button" className="btn ghost sm" onClick={() => setEditingUser(u)}>
                            <span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>edit</span>
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="form-hint" style={{ marginTop: "0.75rem" }}>
            Criação e gestão avançada de utilizadores foi unificada em Ferramentas.
          </p>
        </div>
      )}

      {/* ── Gestão Académica ──────────────────────────────────── */}
      {activeTab === "academico" && (
        <div className="admin-academic-panel">
          {/* Sub-tabs */}
          <div className="admin-sub-tabs">
            {[
              { id: "students",  icon: "person_add",      label: "Registar Aluno" },
              { id: "classes",   icon: "groups",          label: "Turmas" },
              { id: "profiles",  icon: "manage_accounts", label: "Perfis" },
              { id: "announce",  icon: "campaign",        label: "Anúncios" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                className={`admin-sub-tab${academicTab === st.id ? " active" : ""}`}
                onClick={() => setAcademicTab(st.id)}
              >
                <span className="material-icons-sharp">{st.icon}</span>
                {st.label}
              </button>
            ))}
          </div>

          {/* Registar Aluno */}
          {academicTab === "students" && (
            <StudentRegisterSection toast={toast} authProfile={authProfile} />
          )}

          {/* Turmas */}
          {academicTab === "classes" && (
            <ClassesAdminSection toast={toast} />
          )}

          {/* Perfis de utilizadores com edição */}
          {academicTab === "profiles" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 className="admin-section-h3">Gestão de Perfis</h3>
                <button className="btn secondary sm" onClick={() => setAllUsers([])}>
                  <span className="material-icons-sharp">refresh</span>
                  Atualizar
                </button>
              </div>
              {loadingUsers ? (
                <p className="admin-loading">A carregar...</p>
              ) : allUsers.length === 0 ? (
                <p className="admin-empty">Nenhum utilizador encontrado.</p>
              ) : (
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Utilizador</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map((u) => (
                        <tr key={u.id} className="admin-table-row">
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <Avatar url={u.avatar_url} name={u.display_name} />
                              <div>
                                <div style={{ fontWeight: 600 }}>{u.display_name}</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {u.type === "company"  && <Badge label="Empresa"      variant="neutral" />}
                            {u.type === "student"  && <Badge label="Aluno"        variant="success" />}
                            {u.type === "admin"    && <Badge label="Admin"        variant="danger"  />}
                            {u.type === "external" && <Badge label="Externo"      variant="neutral" />}
                          </td>
                          <td>
                            {u.moderation === "pending"   && <Badge label="Pendente"  variant="warning" />}
                            {u.moderation === "active"    && <Badge label="Ativo"    variant="success" />}
                            {u.moderation === "suspended" && <Badge label="Suspenso" variant="danger"  />}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => setEditingUser(u)}
                            >
                              <span className="material-icons-sharp">edit</span>
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Anúncios */}
          {academicTab === "announce" && (
            <AnnouncementSection user={user} toast={toast} />
          )}
        </div>
      )}
    </div>
  );
}

