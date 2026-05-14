import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import ClassRegisterModal from "../components/ClassRegisterModal.jsx";
import PageHeader from "../components/PageHeader.jsx";
import UsersManagementPage from "./UsersManagementPage.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { listInternships, canUseInternshipsApi } from "../services/internshipsService.js";
import { listManualClasses, createManualClass } from "../services/classesService.js";
import {
  listTrainingAreas,
  createTrainingArea,
  listCoursesByArea,
  createCourse,
  updateTrainingArea,
  updateCourse,
} from "../services/trainingAreaService.js";
import { acceptJobApplication, rejectJobApplication } from "../services/jobApplicationService.js";
import { listPartners } from "../services/partnersService.js";
import { registerStudentUnified } from "../services/studentRegistryService.js";
import { importExcelData } from "../services/excelImportService.js";
import { createTranslator } from "../utils/i18n.js";
import { normalizeStudentProcessNumber, validateIpizProcessNumber } from "../utils/processNumber.js";
import { matchesSearch } from "../utils/search.js";
import { isCoordinatorRole } from "../utils/accessControl.js";

// ── helpers ──────────────────────────────────────────────────
function Avatar({ url, name, size = 40 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  const safeUrl = typeof url === "string" && url.startsWith("https://") ? url : null;
  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt={name ?? ""}
        className="tools-avatar"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return (
    <div
      className="tools-avatar tools-avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}

function Badge({ label, variant = "neutral" }) {
  return <span className={`tools-badge tools-badge-${variant}`}>{label}</span>;
}

function formatPhoneAO(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 12);

  if (!digits) return "";
  if (digits.startsWith("244")) {
    const local = digits.slice(3);
    const p1 = local.slice(0, 3);
    const p2 = local.slice(3, 6);
    const p3 = local.slice(6, 9);
    return `+244 ${p1}${p2 ? ` ${p2}` : ""}${p3 ? ` ${p3}` : ""}`.trim();
  }

  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 9);
  return `${p1}${p2 ? ` ${p2}` : ""}${p3 ? ` ${p3}` : ""}`.trim();
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
  return parsed.endYear < new Date().getFullYear();
}

// ── Tabs ─────────────────────────────────────────────────────
const ADMIN_TABS = [
  { id: "alunos",       icon: "people",              label: "Alunos" },
  { id: "importar",    icon: "upload_file",         label: "Importar Excel" },
  { id: "turmas",      icon: "school",               label: "Gestão de Turmas" },
  { id: "vagas",       icon: "work_outline",         label: "Vagas" },
  { id: "atribuicao",  icon: "assignment_ind",       label: "Atribuição" },
  { id: "pautas",      icon: "grading",              label: "Pautas por Turma" },
];

const SUPER_ADMIN_TABS = [
  { id: "utilizadores", icon: "manage_accounts", label: "Utilizadores" },
  { id: "orquestracao", icon: "hub", label: "Orquestração" },
  { id: "estrutura", icon: "account_tree", label: "Áreas e Cursos" },
  { id: "importacao", icon: "upload_file", label: "Importação Excel" },
];

export function resolveVisibleToolTabs(role) {
  const normalizedRole = String(role ?? "").toUpperCase();
  return normalizedRole === "SUPER_ADMIN" ? [...ADMIN_TABS, ...SUPER_ADMIN_TABS] : ADMIN_TABS;
}

export function canAccessToolsTab(role, tabId) {
  return resolveVisibleToolTabs(role).some((tab) => tab.id === tabId);
}

export function resolveRequestedToolsTab(requestedTab, visibleTabs, fallbackTab = "alunos") {
  if (!requestedTab) {
    return fallbackTab;
  }

  return visibleTabs.some((tab) => tab.id === requestedTab) ? requestedTab : fallbackTab;
}

// ── Secção: lista de alunos ──────────────────────────────────
function AlunosTab({ showToast, reloadToken }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    supabase
      .from("internships")
      .select("id, aluno, turma, curso, ano_letivo, status, email, telefone, photo, processo")
      .order("aluno", { ascending: true })
      .then(({ data, error }) => {
        if (!error) setRows(data ?? []);
        else showToast("Erro ao carregar alunos", "error");
        setLoading(false);
      });
  }, [showToast, reloadToken]);

  const filtered = rows.filter((r) =>
    `${r.aluno} ${r.turma} ${r.curso} ${r.processo ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  const statusLabel = (s) =>
    s === "active" ? "Em andamento" : s === "monitoring" ? "Atenção" : "Em risco";
  const statusVariant = (s) =>
    s === "active" ? "success" : s === "monitoring" ? "warning" : "danger";

  return (
    <div className="tools-section">
      <div className="tools-toolbar">
        <input
          type="search"
          placeholder="Pesquisar aluno, turma, processo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="tools-search"
        />
        <span className="tools-count">{filtered.length} aluno(s)</span>
      </div>

      {loading ? (
        <div className="tools-loading">
          <span className="material-icons-sharp spinning">refresh</span>
          A carregar...
        </div>
      ) : filtered.length === 0 ? (
        <div className="tools-empty">
          <span className="material-icons-sharp">school</span>
          <p>Nenhum aluno encontrado</p>
        </div>
      ) : (
        <div className="tools-table-wrap">
          <table className="tools-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>N.º Processo</th>
                <th>Turma</th>
                <th>Curso</th>
                <th>Ano Lectivo</th>
                <th>Estado</th>
                <th>Contacto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Aluno">
                    <div className="tools-student-cell">
                      <Avatar url={r.photo || null} name={r.aluno} size={36} />
                      <span>{r.aluno}</span>
                    </div>
                  </td>
                  <td data-label="N.º Processo">
                    <code className="tools-processo">{r.processo ?? "—"}</code>
                  </td>
                  <td data-label="Turma">{r.turma}</td>
                  <td data-label="Curso">{r.curso}</td>
                  <td data-label="Ano Lectivo">{r.ano_letivo}</td>
                  <td data-label="Estado">
                    <Badge label={statusLabel(r.status)} variant={statusVariant(r.status)} />
                  </td>
                  <td data-label="Contacto">
                    <div className="tools-contact">
                      <small>{r.email}</small>
                      <small>{r.telefone}</small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Secção: registar novo aluno ──────────────────────────────
function RegistarTab({ showToast, authProfile, fallbackAreaId, onRegistered }) {
  const [form, setForm] = useState({
    nome: "", processo: "", email: "", telefone: "",
    turma: "", curso: "", courseId: "", areaId: "", anoLetivo: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
    dataNasc: "", bi: "", morada: "", password: "", confirmPassword: "",
  });
  const [areas, setAreas] = useState([]);
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [credentialInfo, setCredentialInfo] = useState(null);
  const [isExterno, setIsExterno] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    listManualClasses().then((rows) => setClasses(rows ?? [])).catch(() => setClasses([]));
  }, []);

  const filteredClasses = useMemo(
    () => (form.areaId ? classes.filter((cls) => cls.areaId === form.areaId) : classes),
    [classes, form.areaId]
  );

  const loginEmailPreview = useMemo(() => {
    const normalizedProcess = normalizeStudentProcessNumber(form.processo);
    if (!normalizedProcess) {
      return "aluno.processo@giva.ao";
    }

    const configuredDomain = String(import.meta.env.VITE_AUTH_EMAIL_DOMAIN ?? "").trim().toLowerCase();
    const domain = configuredDomain || "giva.ao";
    return `aluno.${normalizedProcess.toLowerCase()}@${domain}`;
  }, [form.processo]);

  useEffect(() => {
    let active = true;
    listTrainingAreas()
      .then((data) => {
        if (!active) return;
        const rows = data ?? [];
        setAreas(rows);
        if (rows.length === 0) {
          showToast("Nenhuma área de formação ativa encontrada.", "error");
          return;
        }
        if (rows.length) {
          const scoped = authProfile?.areaId
            ? rows.find((item) => item.id === authProfile.areaId)
            : rows.find((item) => item.id === fallbackAreaId);
          const selected = scoped ?? rows[0];
          setForm((prev) => ({ ...prev, areaId: selected?.id ?? prev.areaId }));
        }
      })
      .catch(() => {
        if (active) {
          setAreas([]);
          showToast("Não foi possível carregar áreas de formação.", "error");
        }
      });

    return () => {
      active = false;
    };
  }, [authProfile?.areaId, fallbackAreaId, showToast]);

  useEffect(() => {
    let active = true;
    if (!form.areaId) {
      setCourses([]);
      return;
    }

    listCoursesByArea(form.areaId, { includeInactive: false })
      .then((rows) => {
        if (!active) return;
        const nextCourses = rows ?? [];
        setCourses(nextCourses);
        const stillValid = nextCourses.some((course) => course.id === form.courseId);
        if (!stillValid) {
          const first = nextCourses[0];
          setForm((prev) => ({ ...prev, courseId: first?.id ?? "", curso: first?.code ?? "" }));
        }
      })
      .catch(() => {
        if (active) {
          setCourses([]);
          showToast("Não foi possível carregar os cursos desta área.", "error");
        }
      });

    return () => {
      active = false;
    };
  }, [form.areaId, form.courseId, showToast]);

  function set(key, value) {
    let nextValue = value;
    if (key === "telefone") {
      nextValue = formatPhoneAO(value);
    }
    if (key === "processo") {
      nextValue = normalizeStudentProcessNumber(value);
    }

    if (key === "areaId") {
      setForm((prev) => ({ ...prev, areaId: value, courseId: "", curso: "", processo: "", turma: "" }));
      setError("");
      setSuccess(false);
      setCredentialInfo(null);
      return;
    }

    if (key === "courseId") {
      const selectedCourse = courses.find((course) => course.id === value);
      setForm((prev) => ({
        ...prev,
        courseId: value,
        curso: selectedCourse?.code ?? "",
        processo: "",
      }));
      setError("");
      setSuccess(false);
      setCredentialInfo(null);
      return;
    }

    setForm((prev) => ({ ...prev, [key]: nextValue }));
    setError("");
    setSuccess(false);
    setCredentialInfo(null);
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Foto máx. 5 MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.email.trim() || !form.turma.trim() || !form.areaId) {
      setError("Nome, email, turma e área são obrigatórios.");
      return;
    }

    const processValidation = validateIpizProcessNumber(form.processo);
    if (!processValidation.valid) {
      setError(processValidation.error);
      return;
    }

    if (form.password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    if (!parseSchoolYear(form.anoLetivo)) {
      setError("Ano lectivo inválido. Use o formato YYYY/YYYY.");
      return;
    }

    if (isPastSchoolYear(form.anoLetivo)) {
      setError("Não é permitido registar ano lectivo anterior ao ano atual.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const selectedArea = areas.find((area) => area.id === form.areaId);
      const selectedCourse = courses.find((course) => course.id === form.courseId);
      const normalizedProcess = normalizeStudentProcessNumber(form.processo);

      let photoUrl = null;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop();
        const path = `students/${normalizedProcess}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, photoFile, { upsert: true });
        
        if (upErr) {
          setError(`Erro ao carregar foto: ${upErr.message || "Falha desconhecida"}`);
          setSubmitting(false);
          return;
        }
        
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        if (data?.publicUrl) {
          photoUrl = data.publicUrl;
        } else {
          setError("Erro ao gerar URL da foto. Tenta novamente.");
          setSubmitting(false);
          return;
        }
      }

      const registered = await registerStudentUnified({
        fullName: form.nome,
        processNumber: normalizedProcess,
        email: form.email,
        phoneNumber: form.telefone,
        dateOfBirth: form.dataNasc,
        trainingAreaId: form.areaId,
        courseId: form.courseId || null,
        address: form.morada,
        profilePhotoUrl: photoUrl,
        className: form.turma,
        courseCode: selectedCourse?.code || selectedArea?.code || form.curso,
        schoolYear: form.anoLetivo,
        bi: form.bi,
        loginPassword: form.password,
      });

      if (registered.authAlreadyExists) {
        setSuccess(false);
        setCredentialInfo({
          loginEmail: registered.loginEmail,
          authCreated: false,
          authAlreadyExists: true,
        });
        setError(
          `Já existe conta de acesso para este processo (${registered.loginEmail}). ` +
          "A password introduzida agora não substitui a password antiga."
        );
        showToast(
          `Conta já existente para ${registered.loginEmail}. A password anterior mantém-se.`,
          "error"
        );
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setCredentialInfo({
        loginEmail: registered.loginEmail,
        authCreated: registered.authCreated,
        authAlreadyExists: registered.authAlreadyExists,
      });
      setForm({
        nome: "", processo: "", email: "", telefone: "",
        turma: "", curso: "", courseId: "", areaId: authProfile?.areaId ?? fallbackAreaId ?? "", anoLetivo: new Date().getFullYear() + "/" + (new Date().getFullYear() + 1),
        dataNasc: "", bi: "", morada: "", password: "", confirmPassword: "",
      });
      setPhotoFile(null);
      setPhotoPreview(null);
      setIsExterno(false);
      onRegistered?.();
      if (registered.authAlreadyExists) {
        showToast(`Aluno registado. A conta ${registered.loginEmail} já existia.`, "success");
      } else {
        showToast(`Aluno registado com sucesso. Login: ${registered.loginEmail}`, "success");
      }
    } catch (err) {
      setError(err.message ?? "Erro ao registar aluno.");
    }
    setSubmitting(false);
  }

  return (
    <div className="tools-section">
      <form className="tools-form" onSubmit={handleSubmit} noValidate>
        {/* Foto */}
        <div className="tools-form-photo-row">
          <button
            type="button"
            className="tools-photo-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Alterar foto"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Pré-visualização" className="tools-photo-preview" />
            ) : (
              <span className="material-icons-sharp tools-photo-placeholder">add_a_photo</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <div className="tools-form-photo-hint">
            <strong>Foto do aluno</strong>
            <small>JPEG/PNG, máx. 5 MB</small>
          </div>
        </div>

        <div className="tools-form-grid">
          <div className="form-field">
            <label>Nome completo *</label>
            <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex: João Manuel Silva" required />
          </div>
          <div className="form-field">
            <label>Número de processo *</label>
            <input
              value={form.processo}
              onChange={(e) => set("processo", e.target.value)}
              placeholder={(() => {
                const area = areas.find((a) => a.id === form.areaId);
                const initial = area ? String(area.name ?? area.code ?? "").trim().toUpperCase().charAt(0) : "X";
                return isExterno ? `${initial}735A` : `${initial}723`;
              })()}
              autoCapitalize="characters"
              required
            />
            <label className="tools-checkbox-label">
              <input
                type="checkbox"
                checked={isExterno}
                onChange={(e) => { setIsExterno(e.target.checked); set("processo", ""); }}
              />
              Aluno externo (de outra instituição) — número termina em A
            </label>
          </div>
          <div className="form-field">
            <label>Email *</label>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="aluno@ipiz.ao" required />
          </div>
          <div className="form-field">
            <label>Palavra-passe de acesso *</label>
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Mínimo 8 caracteres"
              required
            />
            <small className="form-hint">Login automático do aluno: {loginEmailPreview}</small>
          </div>
          <div className="form-field">
            <label>Confirmar palavra-passe *</label>
            <input
              type="password"
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              placeholder="Repete a palavra-passe"
              required
            />
          </div>
          <div className="form-field">
            <label>Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="+244 9XX XXX XXX"
              inputMode="tel"
            />
          </div>
          <div className="form-field">
            <label>Turma *</label>
            {filteredClasses.length > 0 ? (
              <select value={form.turma} onChange={(e) => set("turma", e.target.value)} required>
                <option value="">Selecionar turma...</option>
                {filteredClasses.map((cls) => (
                  <option key={cls.id} value={cls.turma}>
                    {cls.turma} — {cls.curso} ({cls.anoLetivo})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: "0.6rem", borderRadius: "0.4rem", border: "1px solid var(--border-light)", backgroundColor: "var(--bg-secondary)", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {form.areaId ? "Nenhuma turma registada para esta área. Contacta o administrador." : "Seleciona primeiro uma área de formação"}
              </div>
            )}
          </div>
          <div className="form-field">
            <label>Área de formação *</label>
            <select value={form.areaId} onChange={(e) => set("areaId", e.target.value)} required>
              <option value="">Selecionar...</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.code} - {area.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Curso</label>
            <select value={form.courseId} onChange={(e) => set("courseId", e.target.value)}>
              <option value="">Selecionar...</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Ano Lectivo</label>
            <input value={form.anoLetivo} onChange={(e) => set("anoLetivo", e.target.value)} placeholder="2025/2026" />
          </div>
          <div className="form-field">
            <label>Data de nascimento</label>
            <input type="date" value={form.dataNasc} onChange={(e) => set("dataNasc", e.target.value)} />
          </div>
          <div className="form-field tools-form-full">
            <label>Morada</label>
            <textarea rows={2} value={form.morada} onChange={(e) => set("morada", e.target.value)} placeholder="Endereço completo..." />
          </div>
        </div>

        {error && <p className="tools-error">{error}</p>}
        {success && (
          <p className="tools-success">
            ✓ Aluno registado com sucesso!
            {credentialInfo?.loginEmail ? ` Login: ${credentialInfo.loginEmail}.` : ""}
            {credentialInfo?.authAlreadyExists ? " A conta já existia e mantém a password anterior." : ""}
          </p>
        )}

        <div className="tools-form-actions">
          <button type="submit" className="btn primary" disabled={submitting}>
            {submitting ? (
              <><span className="material-icons-sharp spinning">refresh</span> A registar...</>
            ) : (
              <><span className="material-icons-sharp">person_add</span> Registar Aluno</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Secção: importar alunos via Excel ────────────────────────
function ImportarTab({ showToast, onImported }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef(null);

  function normalizeHeader(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  const HEADER_ALIASES = {
    processNumber: ["processo", "nprocesso", "numprocesso", "numeroprocesso", "numerodeprocesso", "processnumber"],
    fullName: ["nome", "nomecompleto", "fullname", "name"],
    className: ["turma", "class", "classname", "nomedaturma", "turmanome"],
  };

  function mapHeaders(headerRow) {
    const mapped = {};
    headerRow.forEach((headerValue, index) => {
      const normalized = normalizeHeader(headerValue);
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(normalized) && mapped[field] === undefined) {
          mapped[field] = index;
        }
      }
    });
    return mapped;
  }

  async function handleFileSelect(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileName = String(selectedFile.name ?? "").toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      showToast("Selecione um ficheiro Excel (.xlsx ou .xls).", "error");
      return;
    }

    setFile(selectedFile);
    setRows([]);
    setResults(null);
    setParseError("");

    try {
      const XLSX = await import("xlsx");
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

      if (rawRows.length < 2) {
        setParseError("O ficheiro deve conter cabeçalho e pelo menos uma linha de dados.");
        return;
      }

      const mapping = mapHeaders(rawRows[0]);
      if (
        mapping.processNumber === undefined
        || mapping.fullName === undefined
        || mapping.className === undefined
      ) {
        setParseError("Colunas obrigatórias: Processo, Nome Completo e Turma.");
        return;
      }

      const previewRows = rawRows
        .slice(1)
        .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
        .map((row, index) => ({
          _rowNum: index + 2,
          processNumber: String(row[mapping.processNumber] ?? "").trim(),
          fullName: String(row[mapping.fullName] ?? "").trim(),
          className: String(row[mapping.className] ?? "").trim(),
        }));

      setRows(previewRows);
    } catch (err) {
      setParseError(`Erro a processar o ficheiro: ${err?.message ?? "formato inválido"}`);
    }
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    try {
      const importResults = await importExcelData(file);
      setResults(importResults);
      if ((importResults?.studentsRegistered ?? 0) > 0) {
        onImported?.();
      }
      showToast("Importação concluída. Verifique os resultados abaixo.", "success");
    } catch (err) {
      showToast(err, "error");
    }
    setImporting(false);
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const headers = ["Processo", "Nome Completo", "Turma"];
    const exampleRows = [
      ["IPIZ-2026-0001", "João Manuel Silva", "11-TI-A"],
      ["IPIZ-2026-0002", "Maria da Costa", "11-TI-A"],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alunos");
    XLSX.writeFile(workbook, "template_importacao_alunos_minimo.xlsx");
  }

  function resetImport() {
    setFile(null);
    setRows([]);
    setResults(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="tools-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="tools-section-title">Importar Alunos via Excel</h3>
        <button className="tools-btn tools-btn-secondary" onClick={downloadTemplate} type="button">
          <span className="material-icons-sharp" style={{ fontSize: 18 }}>download</span>
          Template (Processo, Nome, Turma)
        </button>
      </div>

      <div className="tools-alert" style={{ marginBottom: 16 }}>
        O ficheiro deve conter apenas 3 colunas: <strong>Processo</strong>, <strong>Nome Completo</strong> e <strong>Turma</strong>.
        As turmas em falta são criadas automaticamente e os restantes dados podem ser editados depois pelo admin ou pelo aluno.
      </div>

      <div
        className="tools-upload-zone"
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = e.dataTransfer.files;
          if (files?.[0]) handleFileSelect({ target: { files } });
        }}
        style={{
          border: "2px dashed var(--color-border, #ccc)",
          borderRadius: 8,
          padding: "32px 24px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        <span className="material-icons-sharp" style={{ fontSize: 40, color: "var(--color-primary, #2563eb)", display: "block", marginBottom: 8 }}>
          upload_file
        </span>
        <p style={{ margin: 0, fontWeight: 600 }}>Clique ou arraste um ficheiro .xlsx / .xls</p>
        <p style={{ margin: "4px 0 0", fontSize: "0.85em", color: "var(--color-text-secondary, #666)" }}>
          Primeira linha deve conter os cabeçalhos Processo, Nome Completo e Turma
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileSelect} />
      </div>

      {parseError && (
        <div className="tools-alert tools-alert-error" style={{ marginBottom: 16 }}>{parseError}</div>
      )}

      {rows.length > 0 && !results && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <p style={{ margin: 0 }}>
              <strong>{rows.length}</strong> linha(s) pronta(s) para importação automática.
            </p>
            <button className="tools-btn tools-btn-primary" onClick={handleImport} disabled={importing} type="button">
              {importing ? "A importar..." : `Importar ${rows.length} aluno(s)`}
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="tools-table" style={{ fontSize: "0.85em" }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Processo</th>
                  <th>Nome Completo</th>
                  <th>Turma</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._rowNum}>
                    <td>{row._rowNum}</td>
                    <td>{row.processNumber || <span style={{ color: "red" }}>Em falta</span>}</td>
                    <td>{row.fullName || <span style={{ color: "red" }}>Em falta</span>}</td>
                    <td>{row.className || <span style={{ color: "red" }}>Em falta</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results && (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: "12px 16px", background: "var(--color-success-bg, #dcfce7)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#16a34a" }}>{results.studentsRegistered ?? 0}</div>
              <div style={{ fontSize: "0.85em" }}>Alunos Registados</div>
            </div>
            <div style={{ flex: 1, padding: "12px 16px", background: "var(--color-info-bg, #dbeafe)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#2563eb" }}>{results.classesCreated ?? 0}</div>
              <div style={{ fontSize: "0.85em" }}>Turmas Criadas</div>
            </div>
            <div style={{ flex: 1, padding: "12px 16px", background: "var(--color-warning-bg, #fef9c3)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: "1.6em", fontWeight: 700, color: "#ca8a04" }}>{results.skipped ?? 0}</div>
              <div style={{ fontSize: "0.85em" }}>Linhas Ignoradas</div>
            </div>
          </div>

          {results.errors?.length > 0 && (
            <div className="tools-errors" style={{ marginBottom: 12 }}>
              <h4 style={{ marginBottom: 6 }}>Erros ({results.errors.length})</h4>
              <ul>
                {results.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {results.warnings?.length > 0 && (
            <div className="tools-warnings" style={{ marginBottom: 12 }}>
              <h4 style={{ marginBottom: 6 }}>Avisos ({results.warnings.length})</h4>
              <ul>
                {results.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="tools-btn tools-btn-secondary" onClick={resetImport} type="button">
            Nova Importação
          </button>
        </div>
      )}
    </div>
  );
}

// ── Secção: gestão de vagas ──────────────────────────────────
function VagasTab({ showToast }) {
  const [vagas, setVagas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    empresa: "",
    areaId: "",
    courseId: "",
    area: "",
    descricao: "",
    vagas: 1,
    dataInicio: "",
    dataFim: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const minDate = useMemo(() => toLocalIsoDate(), []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("internship_vacancies")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) setVagas(data ?? []);
        else showToast("Erro ao carregar vagas.", "error");
        setLoading(false);
      });
  }, [showToast]);

  useEffect(() => {
    let active = true;
    listTrainingAreas()
      .then((data) => {
        if (!active) return;
        const nextAreas = data ?? [];
        setAreas(nextAreas);
        const firstAreaId = nextAreas[0]?.id ?? "";
        setForm((prev) => ({ ...prev, areaId: prev.areaId || firstAreaId }));
      })
      .catch(() => {
        if (active) setAreas([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!form.areaId) {
      setCourses([]);
      setForm((prev) => ({ ...prev, courseId: "", area: "" }));
      return;
    }

    listCoursesByArea(form.areaId, { includeInactive: false })
      .then((data) => {
        if (!active) return;
        const next = data ?? [];
        setCourses(next);
        const selected = next.find((course) => course.id === form.courseId) ?? next[0] ?? null;
        setForm((prev) => ({
          ...prev,
          courseId: selected?.id ?? "",
          area: selected?.code ?? "",
        }));
      })
      .catch(() => {
        if (active) setCourses([]);
      });

    return () => {
      active = false;
    };
  }, [form.areaId, form.courseId]);

  function setF(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.empresa.trim()) return;

    if (form.dataInicio && form.dataInicio < minDate) {
      showToast("Não é permitido registar data de início anterior ao dia atual.", "error");
      return;
    }

    if (form.dataFim && form.dataFim < minDate) {
      showToast("Não é permitido registar data de fim anterior ao dia atual.", "error");
      return;
    }

    if (form.dataInicio && form.dataFim && form.dataFim < form.dataInicio) {
      showToast("A data de fim não pode ser anterior à data de início.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("internship_vacancies")
        .insert({
          titulo: form.titulo.trim(),
          empresa: form.empresa.trim(),
          area: form.area.trim() || null,
          descricao: form.descricao.trim() || null,
          total_vagas: Number(form.vagas) || 1,
          data_inicio: form.dataInicio || null,
          data_fim: form.dataFim || null,
          status: "aberta",
        })
        .select()
        .single();
      if (error) throw error;
      setVagas((prev) => [data, ...prev]);
      setForm((prev) => ({
        ...prev,
        titulo: "",
        empresa: "",
        descricao: "",
        vagas: 1,
        dataInicio: "",
        dataFim: "",
      }));
      setShowForm(false);
      showToast("Vaga criada com sucesso!", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao criar vaga.", "error");
    }
    setSubmitting(false);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from("internship_vacancies").delete().eq("id", id);
    if (!error) setVagas((prev) => prev.filter((v) => v.id !== id));
    else showToast("Erro ao eliminar vaga.", "error");
  }

  return (
    <div className="tools-section">
      <div className="tools-toolbar">
        <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
          <span className="material-icons-sharp">{showForm ? "close" : "add"}</span>
          {showForm ? "Cancelar" : "Nova Vaga"}
        </button>
        <span className="tools-count">{vagas.length} vaga(s)</span>
      </div>

      {showForm && (
        <form className="tools-form tools-form-compact" onSubmit={handleCreate}>
          <div className="tools-form-grid">
            <div className="form-field">
              <label>Título da vaga *</label>
              <input value={form.titulo} onChange={(e) => setF("titulo", e.target.value)} placeholder="Ex: Estagiário de TI" required />
            </div>
            <div className="form-field">
              <label>Empresa *</label>
              <input value={form.empresa} onChange={(e) => setF("empresa", e.target.value)} placeholder="Nome da empresa" required />
            </div>
            <div className="form-field">
              <label>Área de formação</label>
              <select value={form.areaId} onChange={(e) => setF("areaId", e.target.value)}>
                <option value="">Seleccionar área...</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.code} - {area.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Curso</label>
              <select
                value={form.courseId}
                onChange={(e) => {
                  const selected = courses.find((course) => course.id === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    courseId: e.target.value,
                    area: selected?.code ?? "",
                  }));
                }}
              >
                <option value="">Seleccionar curso...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.code} - {course.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>N.º de vagas</label>
              <input type="number" min={1} value={form.vagas} onChange={(e) => setF("vagas", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Data de início</label>
              <input type="date" min={minDate} value={form.dataInicio} onChange={(e) => setF("dataInicio", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Data de fim</label>
              <input type="date" min={form.dataInicio || minDate} value={form.dataFim} onChange={(e) => setF("dataFim", e.target.value)} />
            </div>
            <div className="form-field tools-form-full">
              <label>Descrição</label>
              <textarea rows={3} value={form.descricao} onChange={(e) => setF("descricao", e.target.value)} placeholder="Requisitos, responsabilidades..." />
            </div>
          </div>
          <div className="tools-form-actions">
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? "A criar..." : "Criar Vaga"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="tools-loading"><span className="material-icons-sharp spinning">refresh</span> A carregar...</div>
      ) : vagas.length === 0 ? (
        <div className="tools-empty">
          <span className="material-icons-sharp">work_outline</span>
          <p>Nenhuma vaga disponível. Clica em "Nova Vaga" para criar.</p>
        </div>
      ) : (
        <div className="tools-vagas-grid">
          {vagas.map((v) => (
            <div key={v.id} className="tools-vaga-card">
              <div className="tools-vaga-head">
                <div>
                  <strong className="tools-vaga-title">{v.titulo}</strong>
                  <span className="tools-vaga-empresa">{v.empresa}</span>
                </div>
                <div className="tools-vaga-actions">
                  <Badge label={v.status === "aberta" ? "Aberta" : "Fechada"} variant={v.status === "aberta" ? "success" : "neutral"} />
                  <button type="button" className="btn ghost btn-sm" onClick={() => handleDelete(v.id)} title="Eliminar">
                    <span className="material-icons-sharp" style={{ fontSize: "1rem", color: "var(--danger)" }}>delete</span>
                  </button>
                </div>
              </div>
              <div className="tools-vaga-meta">
                {v.area && <span className="tag">{v.area}</span>}
                <span className="tag"><span className="material-icons-sharp" style={{ fontSize: "0.9rem" }}>people</span>{v.total_vagas} vaga(s)</span>
                {v.data_inicio && <span className="tag">{new Date(v.data_inicio).toLocaleDateString("pt-PT")}</span>}
              </div>
              {v.descricao && <p className="tools-vaga-desc">{v.descricao}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Secção: atribuição aluno → vaga ─────────────────────────
function AtribuicaoTab({ showToast, reloadToken }) {
  const [alunos, setAlunos] = useState([]);
  const [vagas, setVagas] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState([]);
  const [form, setForm] = useState({ alunoId: "", vagaId: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("internships").select("id, aluno, turma, curso, photo, processo").order("aluno"),
      supabase.from("internship_vacancies").select("id, titulo, empresa, status").eq("status", "aberta"),
      supabase.from("internship_assignments").select("*, aluno:internships(aluno, photo, processo), vaga:internship_vacancies(titulo, empresa)").order("created_at", { ascending: false }),
    ]).then(([al, va, at]) => {
      setAlunos(al.data ?? []);
      setVagas(va.data ?? []);
      setAtribuicoes(at.data ?? []);
      setLoading(false);
    }).catch(() => {
      setAlunos([]);
      setVagas([]);
      setAtribuicoes([]);
      showToast("Erro ao carregar dados de atribuição.", "error");
      setLoading(false);
    });
  }, [showToast, reloadToken]);

  async function handleAtribuir(e) {
    e.preventDefault();
    if (!form.alunoId || !form.vagaId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("internship_assignments")
        .insert({ internship_id: form.alunoId, vacancy_id: form.vagaId })
        .select("*, aluno:internships(aluno, photo, processo), vaga:internship_vacancies(titulo, empresa)")
        .single();
      if (error) throw error;
      setAtribuicoes((prev) => [data, ...prev]);
      setForm({ alunoId: "", vagaId: "" });
      showToast("Aluno atribuído com sucesso!", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao atribuir.", "error");
    }
    setSubmitting(false);
  }

  async function handleRemover(id) {
    const { error } = await supabase.from("internship_assignments").delete().eq("id", id);
    if (!error) setAtribuicoes((prev) => prev.filter((a) => a.id !== id));
    else showToast("Erro ao remover atribuição.", "error");
  }

  return (
    <div className="tools-section">
      <div className="tools-atrib-layout">
        {/* Formulário de atribuição */}
        <div className="tools-atrib-form-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">assignment_ind</span>
            Atribuir Aluno a Vaga
          </h3>
          <form onSubmit={handleAtribuir} className="tools-form tools-form-compact">
            <div className="form-field">
              <label>Seleccionar Aluno</label>
              <select value={form.alunoId} onChange={(e) => setForm((p) => ({ ...p, alunoId: e.target.value }))} required>
                <option value="">Escolher aluno...</option>
                {alunos.map((a) => (
                  <option key={a.id} value={a.id}>{a.aluno} {a.processo ? `(${a.processo})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Seleccionar Vaga</label>
              <select value={form.vagaId} onChange={(e) => setForm((p) => ({ ...p, vagaId: e.target.value }))} required>
                <option value="">Escolher vaga...</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>{v.titulo} — {v.empresa}</option>
                ))}
              </select>
            </div>
            <div className="tools-form-actions">
              <button type="submit" className="btn primary" disabled={submitting || !form.alunoId || !form.vagaId}>
                <span className="material-icons-sharp">link</span>
                {submitting ? "A atribuir..." : "Atribuir"}
              </button>
            </div>
          </form>
        </div>

        {/* Histórico de atribuições */}
        <div className="tools-atrib-list-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">list_alt</span>
            Atribuições Actuais
          </h3>
          {loading ? (
            <div className="tools-loading"><span className="material-icons-sharp spinning">refresh</span> A carregar...</div>
          ) : atribuicoes.length === 0 ? (
            <div className="tools-empty">
              <span className="material-icons-sharp">assignment</span>
              <p>Nenhuma atribuição ainda.</p>
            </div>
          ) : (
            <div className="tools-atrib-list">
              {atribuicoes.map((a) => (
                <div key={a.id} className="tools-atrib-item">
                  <Avatar url={a.aluno?.photo} name={a.aluno?.aluno} size={36} />
                  <div className="tools-atrib-info">
                    <strong>{a.aluno?.aluno ?? "—"}</strong>
                    <small>{a.vaga?.titulo} · {a.vaga?.empresa}</small>
                    {a.aluno?.processo && <code className="tools-processo">{a.aluno.processo}</code>}
                  </div>
                  <button
                    type="button"
                    className="btn ghost btn-sm"
                    onClick={() => handleRemover(a.id)}
                    title="Remover atribuição"
                  >
                    <span className="material-icons-sharp" style={{ fontSize: "1rem", color: "var(--danger)" }}>link_off</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Secção: pautas de notas por turma ────────────────────────
const STATUS_LABEL = { active: "Em andamento", monitoring: "Atenção", risk: "Em risco" };
const STATUS_VARIANT = { active: "success", monitoring: "warning", risk: "danger" };

function PautasTab({ showToast, reloadToken }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [turmaAtiva, setTurmaAtiva] = useState(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("internships")
      .select("id, aluno, turma, curso, ano_letivo, status, nota, inicio, ultima_atualizacao, photo, processo, empresa, supervisor")
      .order("aluno", { ascending: true })
      .then(({ data, error }) => {
        if (!error) setRows(data ?? []);
        else showToast("Erro ao carregar pautas", "error");
        setLoading(false);
      });
  }, [showToast, reloadToken]);

  // agrupar por turma
  const turmas = [...new Map(rows.map((r) => [`${r.ano_letivo}|${r.curso}|${r.turma}`, r])).values()]
    .sort((a, b) => `${a.turma}`.localeCompare(`${b.turma}`));

  const alunosDaTurma = turmaAtiva
    ? rows.filter((r) => r.turma === turmaAtiva.turma && r.curso === turmaAtiva.curso && r.ano_letivo === turmaAtiva.ano_letivo)
    : [];

  const media = alunosDaTurma.length
    ? (alunosDaTurma.reduce((s, r) => s + Number(r.nota ?? 0), 0) / alunosDaTurma.length).toFixed(1)
    : "—";

  function gradeColor(nota) {
    const n = Number(nota);
    if (n >= 17) return "var(--success)";
    if (n >= 14) return "var(--primary)";
    if (n >= 10) return "var(--warning)";
    return "var(--danger)";
  }

  return (
    <div className="tools-section tools-pautas">
      {loading ? (
        <div className="tools-loading"><span className="material-icons-sharp spinning">refresh</span> A carregar...</div>
      ) : (
        <div className="tools-pautas-layout">
          {/* Lista de turmas */}
          <div className="tools-pautas-sidebar">
            <div className="tools-card-title-row">
              <span className="material-icons-sharp">school</span>
              <strong>Turmas</strong>
            </div>
            {turmas.length === 0 ? (
              <p className="tools-muted">Sem turmas</p>
            ) : (
              <div className="tools-turmas-list">
                {turmas.map((t) => {
                  const key = `${t.ano_letivo}|${t.curso}|${t.turma}`;
                  const active =
                    turmaAtiva &&
                    `${turmaAtiva.ano_letivo}|${turmaAtiva.curso}|${turmaAtiva.turma}` === key;
                  const count = rows.filter(
                    (r) => r.turma === t.turma && r.curso === t.curso && r.ano_letivo === t.ano_letivo
                  ).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`tools-turma-btn${active ? " active" : ""}`}
                      onClick={() => setTurmaAtiva(t)}
                    >
                      <div className="tools-turma-code">{t.turma}</div>
                      <div className="tools-turma-meta">
                        <small>{t.curso} · {t.ano_letivo}</small>
                        <span className="tools-turma-count">{count} aluno(s)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pauta da turma selecionada */}
          <div className="tools-pautas-main">
            {!turmaAtiva ? (
              <div className="tools-empty">
                <span className="material-icons-sharp">grading</span>
                <p>Selecciona uma turma para ver a pauta de notas.</p>
              </div>
            ) : (
              <>
                {/* Cabeçalho da pauta */}
                <div className="tools-pauta-header">
                  <div>
                    <h3 className="tools-pauta-title">Pauta — {turmaAtiva.turma}</h3>
                    <p className="tools-pauta-sub">{turmaAtiva.curso} · Ano lectivo {turmaAtiva.ano_letivo}</p>
                  </div>
                  <div className="tools-pauta-stats">
                    <div className="tools-pauta-stat">
                      <span className="tools-pauta-stat-val">{alunosDaTurma.length}</span>
                      <span className="tools-pauta-stat-label">Alunos</span>
                    </div>
                    <div className="tools-pauta-stat">
                      <span className="tools-pauta-stat-val" style={{ color: "var(--primary)" }}>{media}</span>
                      <span className="tools-pauta-stat-label">Média</span>
                    </div>
                  </div>
                </div>

                {/* Tabela estilo pauta tradicional */}
                <div className="tools-pauta-table-wrap">
                  <table className="tools-pauta-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th style={{ width: 48 }}>Foto</th>
                        <th>Nome do Aluno</th>
                        <th>N.º Processo</th>
                        <th>Empresa</th>
                        <th>Início de Estágio</th>
                        <th>Fim / Atualiz.</th>
                        <th>Nota</th>
                        <th>Condição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alunosDaTurma.map((aluno, idx) => (
                        <tr key={aluno.id} className="tools-pauta-row">
                          <td className="tools-pauta-num">{idx + 1}</td>
                          <td>
                            <Avatar url={aluno.photo} name={aluno.aluno} size={36} />
                          </td>
                          <td>
                            <strong className="tools-pauta-name">{aluno.aluno}</strong>
                            {aluno.supervisor && <small className="tools-pauta-supervisor">Supervisor: {aluno.supervisor}</small>}
                          </td>
                          <td>
                            <code className="tools-processo">{aluno.processo ?? "—"}</code>
                          </td>
                          <td>{aluno.empresa ?? "—"}</td>
                          <td>{aluno.inicio ?? "—"}</td>
                          <td>{aluno.ultima_atualizacao ?? "—"}</td>
                          <td>
                            <span
                              className="tools-pauta-nota"
                              style={{ color: gradeColor(aluno.nota) }}
                            >
                              {aluno.nota ?? "—"}
                            </span>
                          </td>
                          <td>
                            <Badge
                              label={STATUS_LABEL[aluno.status] ?? aluno.status}
                              variant={STATUS_VARIANT[aluno.status] ?? "neutral"}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Secção: gestão de turmas ─────────────────────────────────
const COURSE_RESOURCES = {
  TI: ["Guia de Desenvolvimento", "Checklist de Sprint", "Template de Relatório Técnico"],
  EIE: ["Manual de Segurança Industrial", "Checklist de Bancada", "Plano de Ensaios"],
  TLQB: ["Protocolo de Laboratório", "Ficha de Controlo de Qualidade", "Normas de Biossegurança"],
};

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractProcessSequence(processNumber) {
  const raw = String(processNumber ?? "").trim().toUpperCase();
  const match = raw.match(/^[A-Z0-9]+-([0-9]+)-[A-Z0-9]+$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function TurmasTab({ showToast, areaId }) {
  const [rows, setRows] = useState([]);
  const [registeredClasses, setRegisteredClasses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState("");
  const [areas, setAreas] = useState([]);
  const [classAreaId, setClassAreaId] = useState("");
  const [classAreaCourses, setClassAreaCourses] = useState([]);
  const [targetCourses, setTargetCourses] = useState([]);
  const [transferring, setTransferring] = useState(false);
  const [transferForm, setTransferForm] = useState({
    studentId: "",
    areaId: "",
    courseId: "",
    turma: "",
    anoLetivo: "",
  });
  const language = useMemo(() => {
    const raw = localStorage.getItem("giva.preferences");
    if (!raw) {
      return "pt-BR";
    }

    try {
      const parsed = JSON.parse(raw);
      return parsed.language === "pt-PT" || parsed.language === "en" ? parsed.language : "pt-BR";
    } catch {
      return "pt-BR";
    }
  }, []);
  const t = useMemo(() => createTranslator(language), [language]);

  async function refreshRows() {
    if (!canUseInternshipsApi()) return;
    const data = await listInternships();
    setRows(data ?? []);
  }

  useEffect(() => {
    let active = true;
    if (!canUseInternshipsApi()) return;
    listInternships()
      .then((data) => { if (active) setRows(data); })
      .catch(() => { if (active) showToast("Falha ao carregar turmas.", "error"); });
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    listManualClasses().then(setRegisteredClasses).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    listTrainingAreas()
      .then((data) => {
        if (!active) return;
        const nextAreas = data ?? [];
        setAreas(nextAreas);
        const fallback = areaId ?? nextAreas[0]?.id ?? "";
        setClassAreaId((prev) => prev || fallback);
        setTransferForm((prev) => ({
          ...prev,
          areaId: prev.areaId || fallback,
        }));
      })
      .catch(() => {
        if (active) setAreas([]);
      });

    return () => {
      active = false;
    };
  }, [areaId]);

  useEffect(() => {
    if (!areaId) return;
    setClassAreaId(areaId);
  }, [areaId]);

  useEffect(() => {
    let active = true;
    if (!classAreaId) {
      setClassAreaCourses([]);
      return;
    }

    listCoursesByArea(classAreaId, { includeInactive: false })
      .then((data) => {
        if (!active) return;
        setClassAreaCourses(data ?? []);
      })
      .catch(() => {
        if (active) setClassAreaCourses([]);
      });

    return () => {
      active = false;
    };
  }, [classAreaId]);

  useEffect(() => {
    let active = true;
    if (!transferForm.areaId) {
      setTargetCourses([]);
      setTransferForm((prev) => ({ ...prev, courseId: "" }));
      return;
    }

    listCoursesByArea(transferForm.areaId, { includeInactive: false })
      .then((data) => {
        if (!active) return;
        const next = data ?? [];
        setTargetCourses(next);
        const hasSelected = next.some((item) => item.id === transferForm.courseId);
        if (!hasSelected) {
          setTransferForm((prev) => ({ ...prev, courseId: next[0]?.id ?? "" }));
        }
      })
      .catch(() => {
        if (active) setTargetCourses([]);
      });

    return () => {
      active = false;
    };
  }, [transferForm.areaId, transferForm.courseId]);

  const students = useMemo(
    () => [...rows].sort((a, b) => String(a.aluno ?? "").localeCompare(String(b.aluno ?? ""))),
    [rows]
  );

  const selectedStudent = useMemo(
    () => students.find((item) => item.id === transferForm.studentId) ?? null,
    [students, transferForm.studentId]
  );

  async function handleTransferStudent(e) {
    e.preventDefault();
    if (!transferForm.studentId || !transferForm.areaId || !transferForm.courseId || !transferForm.turma.trim() || !transferForm.anoLetivo.trim()) {
      showToast("Selecione aluno, área, curso, turma e ano lectivo.", "error");
      return;
    }

    if (!parseSchoolYear(transferForm.anoLetivo)) {
      showToast("Ano lectivo inválido. Use o formato YYYY/YYYY.", "error");
      return;
    }

    if (isPastSchoolYear(transferForm.anoLetivo)) {
      showToast("Não é permitido registar ano lectivo anterior ao ano atual.", "error");
      return;
    }

    const area = areas.find((item) => item.id === transferForm.areaId);
    const course = targetCourses.find((item) => item.id === transferForm.courseId);
    if (!area?.code || !course?.code) {
      showToast("Área/curso inválidos para transferência.", "error");
      return;
    }

    setTransferring(true);
    try {
      let sequence = extractProcessSequence(selectedStudent?.processo);

      if (!sequence) {
        const { count, error: countError } = await supabase
          .from("internships")
          .select("id", { count: "exact", head: true })
          .eq("area_id", transferForm.areaId)
          .eq("curso", course.code);

        if (countError) throw countError;
        sequence = Number(count ?? 0) + 1;
      }

      const nextProcessNumber = buildProcessNumber(area.code, sequence, course.code);

      const { error: updateError } = await supabase
        .from("internships")
        .update({
          area_id: transferForm.areaId,
          curso: course.code,
          turma: transferForm.turma.trim().toUpperCase(),
          ano_letivo: transferForm.anoLetivo.trim(),
          processo: nextProcessNumber,
          ultima_atualizacao: new Date().toLocaleDateString("pt-PT"),
        })
        .eq("id", transferForm.studentId);

      if (updateError) throw updateError;

      await refreshRows();
      showToast("Turma/curso do aluno atualizados com sucesso.", "success");
    } catch (err) {
      showToast(err?.message ?? "Falha ao transferir aluno de turma.", "error");
    }
    setTransferring(false);
  }

  const classGroups = useMemo(() => {
    const byClass = new Map();

    for (const row of rows) {
      if (areaId && row.areaId && row.areaId !== areaId) continue;
      if (!matchesSearch(query, `${row.turma} ${row.anoLetivo} ${row.curso} ${row.supervisor} ${row.aluno}`)) continue;
      const key = `${row.anoLetivo}|${row.curso}|${row.turma}`;
      if (!byClass.has(key)) {
        byClass.set(key, { key, anoLetivo: row.anoLetivo, curso: row.curso, turma: row.turma, supervisor: row.supervisor, total: 0, ativos: 0, monitoramento: 0, risco: 0, somaNotas: 0 });
      }
      const g = byClass.get(key);
      g.total += 1;
      g.somaNotas += Number(row.nota ?? 0);
      if (row.status === "active") g.ativos += 1;
      if (row.status === "monitoring") g.monitoramento += 1;
      if (row.status === "risk") g.risco += 1;
    }

    for (const item of registeredClasses) {
      if (areaId && item.areaId && item.areaId !== areaId) continue;
      if (!matchesSearch(query, `${item.turma} ${item.anoLetivo} ${item.curso} ${item.supervisor}`)) continue;
      const key = `${item.anoLetivo}|${item.curso}|${item.turma}`;
      if (byClass.has(key)) continue;
      const total = safeNumber(item.total, 0);
      byClass.set(key, {
        key, anoLetivo: item.anoLetivo, curso: item.curso, turma: item.turma, supervisor: item.supervisor || "—",
        total, ativos: safeNumber(item.ativos, 0), monitoramento: safeNumber(item.monitoramento, 0),
        risco: safeNumber(item.risco, 0), somaNotas: safeNumber(item.mediaNota, 0) * Math.max(total, 1),
      });
    }

    const byYear = new Map();
    for (const g of byClass.values()) {
      const mediaNota = g.total ? (g.somaNotas / g.total).toFixed(1) : "0.0";
      const item = { ...g, mediaNota };
      if (!byYear.has(item.anoLetivo)) byYear.set(item.anoLetivo, new Map());
      const byCourse = byYear.get(item.anoLetivo);
      if (!byCourse.has(item.curso)) byCourse.set(item.curso, []);
      byCourse.get(item.curso).push(item);
    }

    return Array.from(byYear.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([anoLetivo, courseMap]) => ({
        anoLetivo,
        cursos: Array.from(courseMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([curso, turmas]) => ({ curso, turmas: turmas.sort((a, b) => a.turma.localeCompare(b.turma)) })),
      }));
  }, [query, rows, registeredClasses]);

  const classCourseOptions = useMemo(() => {
    const options = new Set();

    for (const course of classAreaCourses) {
      const code = String(course?.code ?? "").trim().toUpperCase();
      if (code) options.add(code);
    }

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [classAreaCourses]);

  function handleSave(payload, validationError) {
    if (validationError) { showToast(validationError, "error"); return false; }

    if (!classAreaId) {
      showToast("Selecione uma área de formação para registar a turma.", "error");
      return false;
    }

    if (!parseSchoolYear(payload?.anoLetivo)) {
      showToast("Ano lectivo inválido. Use o formato YYYY/YYYY.", "error");
      return false;
    }

    if (isPastSchoolYear(payload?.anoLetivo)) {
      showToast("Não é permitido registar ano lectivo anterior ao ano atual.", "error");
      return false;
    }

    if (!classCourseOptions.includes(String(payload?.curso ?? "").trim().toUpperCase())) {
      showToast("Selecione um curso já registado na área escolhida.", "error");
      return false;
    }

    const payloadWithScope = { ...payload, areaId: classAreaId };
    const key = `${payloadWithScope.anoLetivo}|${payloadWithScope.curso}|${payloadWithScope.turma}`;
    const exists = rows.some((r) => `${r.anoLetivo}|${r.curso}|${r.turma}` === key) ||
      registeredClasses.some((r) => `${r.anoLetivo}|${r.curso}|${r.turma}` === key);
    if (exists) { showToast("Esta turma/curso já está registada.", "error"); return false; }

    createManualClass(payloadWithScope)
      .then((created) => {
        setRegisteredClasses((prev) => [created, ...prev]);
        showToast("Turma registada com sucesso!");
      })
      .catch((err) => showToast(err?.message ?? "Falha ao sincronizar turma na base de dados.", "error"));

    setShowModal(false);
    return true;
  }

  return (
    <div className="tools-section">
      <div className="tools-atrib-layout" style={{ marginBottom: "1rem" }}>
        <div className="tools-atrib-form-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">swap_horiz</span>
            Transferir/Atribuir turma
          </h3>
          <form className="tools-form tools-form-compact" onSubmit={handleTransferStudent}>
            <div className="form-field">
              <label>Aluno *</label>
              <select
                value={transferForm.studentId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, studentId: e.target.value }))}
                required
              >
                <option value="">Selecionar...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.aluno} {student.processo ? `(${student.processo})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="tools-form-grid">
              <div className="form-field">
                <label>Área *</label>
                <select
                  value={transferForm.areaId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, areaId: e.target.value }))}
                  required
                >
                  <option value="">Selecionar...</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Curso *</label>
                <select
                  value={transferForm.courseId}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, courseId: e.target.value }))}
                  required
                >
                  <option value="">Selecionar...</option>
                  {targetCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Turma *</label>
                <input
                  value={transferForm.turma}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, turma: e.target.value }))}
                  placeholder="Ex: 12-TI-B"
                  required
                />
              </div>
              <div className="form-field">
                <label>Ano lectivo *</label>
                <input
                  value={transferForm.anoLetivo}
                  onChange={(e) => setTransferForm((prev) => ({ ...prev, anoLetivo: e.target.value }))}
                  placeholder="2025/2026"
                  required
                />
              </div>
            </div>

            <div className="tools-form-actions">
              <button type="submit" className="btn primary" disabled={transferring}>
                {transferring ? "A atualizar..." : "Transferir/Atribuir"}
              </button>
            </div>
          </form>
        </div>

        <div className="tools-atrib-list-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">fact_check</span>
            Pré-visualização da transferência
          </h3>
          {!selectedStudent ? (
            <div className="tools-empty">
              <span className="material-icons-sharp">person_search</span>
              <p>Selecione um aluno para ver os dados actuais.</p>
            </div>
          ) : (
            <div className="tools-vaga-card" style={{ marginTop: "0.5rem" }}>
              <p><strong>Aluno:</strong> {selectedStudent.aluno}</p>
              <p><strong>Processo atual:</strong> <code className="tools-processo">{selectedStudent.processo ?? "—"}</code></p>
              <p><strong>Turma atual:</strong> {selectedStudent.turma || "—"}</p>
              <p><strong>Curso atual:</strong> {selectedStudent.curso || "—"}</p>
              <p><strong>Ano lectivo:</strong> {selectedStudent.anoLetivo || "—"}</p>
            </div>
          )}
        </div>
      </div>

      <div className="tools-toolbar">
        <input
          type="search"
          placeholder="Pesquisar turma, curso, ano lectivo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="tools-search"
        />
        <button type="button" className="btn primary" onClick={() => setShowModal(true)}>
          <span className="material-icons-sharp">add</span>
          Registar turma
        </button>
        <span className="tools-count">{classGroups.reduce((s, y) => s + y.cursos.reduce((c, g) => c + g.turmas.length, 0), 0)} turma(s)</span>
      </div>

      {classGroups.length === 0 ? (
        <div className="tools-empty">
          <span className="material-icons-sharp">school</span>
          <p>Nenhuma turma encontrada.</p>
        </div>
      ) : (
        classGroups.map((yearGroup) => (
          <div key={yearGroup.anoLetivo} className="tools-turmas-year-block">
            <h3 className="tools-turmas-year-title">Ano Lectivo: {yearGroup.anoLetivo}</h3>
            {yearGroup.cursos.map((courseGroup) => (
              <div key={courseGroup.curso} className="tools-turmas-course-block">
                <div className="tools-turmas-course-head">
                  <h4>{courseGroup.curso}</h4>
                  <span className="tag">{courseGroup.turmas.length} turma(s)</span>
                </div>
                <div className="tools-turmas-grid">
                  {courseGroup.turmas.map((turma) => {
                    const riskRate = turma.total ? Math.round((turma.risco / turma.total) * 100) : 0;
                    const detailUrl = `/turmas/detalhe?anoLetivo=${encodeURIComponent(turma.anoLetivo)}&curso=${encodeURIComponent(turma.curso)}&turma=${encodeURIComponent(turma.turma)}`;
                    return (
                      <div key={turma.key} className="tools-turma-card">
                        <div className="tools-turma-card-head">
                          <div>
                            <strong>{turma.turma}</strong>
                            <small>{turma.curso} · {turma.anoLetivo}</small>
                          </div>
                          <span className="tag">{turma.total} aluno(s)</span>
                        </div>
                        <div className="tools-turma-card-kpis">
                          <div className="tools-turma-kpi">
                            <span>Média</span>
                            <strong>{turma.mediaNota}</strong>
                          </div>
                          <div className="tools-turma-kpi">
                            <span>Risco</span>
                            <strong>{riskRate}%</strong>
                          </div>
                        </div>
                        <div className="tools-turma-card-tags">
                          <span className="tag">Ativos: {turma.ativos}</span>
                          <span className="tag">Atenção: {turma.monitoramento}</span>
                          <span className="tag">Risco: {turma.risco}</span>
                        </div>
                        {COURSE_RESOURCES[turma.curso] && (
                          <ul className="tools-turma-resources">
                            {COURSE_RESOURCES[turma.curso].map((r) => <li key={r}>{r}</li>)}
                          </ul>
                        )}
                        <div className="tools-turma-card-foot">
                          <small>Supervisor: {turma.supervisor}</small>
                          <Link className="btn outline btn-sm" to={detailUrl}>
                            <span className="material-icons-sharp">open_in_new</span>
                            Abrir turma
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {showModal && (
        <ClassRegisterModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          t={t}
          areaOptions={areas}
          selectedAreaId={classAreaId}
          onAreaChange={setClassAreaId}
          areaLocked={Boolean(areaId)}
          courseOptions={classCourseOptions}
        />
      )}
    </div>
  );
}

function EstruturaAcademicaTab({ showToast }) {
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [courses, setCourses] = useState([]);
  const [savingArea, setSavingArea] = useState(false);
  const [savingCourse, setSavingCourse] = useState(false);
  const [updatingArea, setUpdatingArea] = useState(false);
  const [updatingCourseId, setUpdatingCourseId] = useState(null);
  const [areaForm, setAreaForm] = useState({ code: "", name: "" });
  const [courseForm, setCourseForm] = useState({ code: "", name: "", description: "" });
  const [areaEditForm, setAreaEditForm] = useState({ code: "", name: "" });
  const [courseEdits, setCourseEdits] = useState({});

  useEffect(() => {
    listTrainingAreas().then((data) => {
      const items = data ?? [];
      setAreas(items);
      if (items.length && !selectedAreaId) {
        setSelectedAreaId(items[0].id);
      }
    }).catch(() => showToast("Falha ao carregar áreas de formação.", "error"));
  }, [showToast, selectedAreaId]);

  useEffect(() => {
    const selected = areas.find((item) => item.id === selectedAreaId);
    if (!selected) {
      setAreaEditForm({ code: "", name: "" });
      return;
    }
    setAreaEditForm({
      code: selected.code ?? "",
      name: selected.name ?? "",
    });
  }, [areas, selectedAreaId]);

  useEffect(() => {
    if (!selectedAreaId) {
      setCourses([]);
      return;
    }
    listCoursesByArea(selectedAreaId)
      .then((data) => setCourses(data ?? []))
      .catch(() => showToast("Falha ao carregar cursos da área.", "error"));
  }, [selectedAreaId, showToast]);

  useEffect(() => {
    const next = {};
    for (const course of courses) {
      next[course.id] = {
        code: course.code ?? "",
        name: course.name ?? "",
        description: course.description ?? "",
      };
    }
    setCourseEdits(next);
  }, [courses]);

  async function handleCreateArea(e) {
    e.preventDefault();
    if (!areaForm.code.trim() || !areaForm.name.trim()) {
      showToast("Código e nome da área são obrigatórios.", "error");
      return;
    }
    setSavingArea(true);
    try {
      const created = await createTrainingArea({
        code: areaForm.code.trim().toUpperCase(),
        name: areaForm.name.trim(),
      });
      if (!created) throw new Error("Não foi possível criar a área.");
      setAreas((prev) => [...prev, created]);
      setSelectedAreaId(created.id);
      setAreaForm({ code: "", name: "" });
      showToast("Área de formação criada com sucesso.", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao criar área.", "error");
    }
    setSavingArea(false);
  }

  async function handleCreateCourse(e) {
    e.preventDefault();
    if (!selectedAreaId) {
      showToast("Selecione uma área antes de criar curso.", "error");
      return;
    }
    if (!courseForm.code.trim() || !courseForm.name.trim()) {
      showToast("Código e nome do curso são obrigatórios.", "error");
      return;
    }
    setSavingCourse(true);
    try {
      const created = await createCourse(selectedAreaId, {
        code: courseForm.code.trim().toUpperCase(),
        name: courseForm.name.trim(),
        description: courseForm.description.trim() || null,
      });
      if (!created) throw new Error("Não foi possível criar o curso.");
      setCourses((prev) => [created, ...prev]);
      setCourseForm({ code: "", name: "", description: "" });
      showToast("Curso criado com sucesso.", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao criar curso.", "error");
    }
    setSavingCourse(false);
  }

  async function handleUpdateArea(e) {
    e.preventDefault();
    if (!selectedAreaId) {
      showToast("Selecione uma área para atualizar.", "error");
      return;
    }

    if (!areaEditForm.code.trim() || !areaEditForm.name.trim()) {
      showToast("Código e nome da área são obrigatórios.", "error");
      return;
    }

    setUpdatingArea(true);
    try {
      const updated = await updateTrainingArea(selectedAreaId, {
        code: areaEditForm.code.trim().toUpperCase(),
        name: areaEditForm.name.trim(),
      });

      if (!updated) throw new Error("Não foi possível atualizar a área.");

      setAreas((prev) => prev.map((item) => (item.id === selectedAreaId ? updated : item)));
      showToast("Área atualizada com sucesso.", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao atualizar área.", "error");
    }
    setUpdatingArea(false);
  }

  async function handleUpdateCourse(courseId) {
    if (!courseId || !courseEdits[courseId]) return;
    const payload = courseEdits[courseId];

    if (!payload.code.trim() || !payload.name.trim()) {
      showToast("Código e nome do curso são obrigatórios.", "error");
      return;
    }

    setUpdatingCourseId(courseId);
    try {
      const updated = await updateCourse(courseId, {
        code: payload.code.trim().toUpperCase(),
        name: payload.name.trim(),
        description: payload.description.trim() || null,
      });

      if (!updated) throw new Error("Não foi possível atualizar o curso.");

      setCourses((prev) => prev.map((item) => (item.id === courseId ? updated : item)));
      showToast("Curso atualizado com sucesso.", "success");
    } catch (err) {
      showToast(err.message ?? "Erro ao atualizar curso.", "error");
    }
    setUpdatingCourseId(null);
  }

  return (
    <div className="tools-section">
      <div className="tools-atrib-layout">
        <div className="tools-atrib-form-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">domain_add</span>
            Criar Área de Formação
          </h3>
          <form className="tools-form tools-form-compact" onSubmit={handleCreateArea}>
            <div className="form-field">
              <label>Código *</label>
              <input value={areaForm.code} onChange={(e) => setAreaForm((p) => ({ ...p, code: e.target.value }))} placeholder="Ex: INFO" required />
            </div>
            <div className="form-field">
              <label>Nome *</label>
              <input value={areaForm.name} onChange={(e) => setAreaForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Informática" required />
            </div>
            <div className="tools-form-actions">
              <button type="submit" className="btn primary" disabled={savingArea}>
                {savingArea ? "A criar..." : "Criar Área"}
              </button>
            </div>
          </form>

          <div className="form-field" style={{ marginTop: "1rem" }}>
            <label>Área ativa</label>
            <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)}>
              <option value="">Seleccionar área...</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>

          <form className="tools-form tools-form-compact" style={{ marginTop: "1rem" }} onSubmit={handleUpdateArea}>
            <h4 style={{ margin: "0 0 0.75rem" }}>Editar área ativa</h4>
            <div className="form-field">
              <label>Código</label>
              <input
                value={areaEditForm.code}
                onChange={(e) => setAreaEditForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="Ex: INFO"
                disabled={!selectedAreaId}
              />
            </div>
            <div className="form-field">
              <label>Nome</label>
              <input
                value={areaEditForm.name}
                onChange={(e) => setAreaEditForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Informática"
                disabled={!selectedAreaId}
              />
            </div>
            <div className="tools-form-actions">
              <button type="submit" className="btn ghost" disabled={updatingArea || !selectedAreaId}>
                {updatingArea ? "A atualizar..." : "Guardar alterações da área"}
              </button>
            </div>
          </form>
        </div>

        <div className="tools-atrib-list-card">
          <h3 className="tools-card-title">
            <span className="material-icons-sharp">menu_book</span>
            Cursos por Área
          </h3>
          <form className="tools-form tools-form-compact" onSubmit={handleCreateCourse}>
            <div className="tools-form-grid">
              <div className="form-field">
                <label>Código *</label>
                <input value={courseForm.code} onChange={(e) => setCourseForm((p) => ({ ...p, code: e.target.value }))} placeholder="Ex: TI" required />
              </div>
              <div className="form-field">
                <label>Nome *</label>
                <input value={courseForm.name} onChange={(e) => setCourseForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Tecnologias de Informação" required />
              </div>
              <div className="form-field tools-form-full">
                <label>Descrição</label>
                <textarea rows={2} value={courseForm.description} onChange={(e) => setCourseForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <div className="tools-form-actions">
              <button type="submit" className="btn primary" disabled={savingCourse || !selectedAreaId}>
                {savingCourse ? "A criar..." : "Criar Curso"}
              </button>
            </div>
          </form>

          {!courses.length ? (
            <div className="tools-empty" style={{ marginTop: "1rem" }}>
              <span className="material-icons-sharp">school</span>
              <p>Nenhum curso nesta área.</p>
            </div>
          ) : (
            <div className="tools-vagas-grid" style={{ marginTop: "1rem" }}>
              {courses.map((course) => (
                <div key={course.id} className="tools-vaga-card">
                  <div className="tools-form-grid">
                    <div className="form-field">
                      <label>Código</label>
                      <input
                        value={courseEdits[course.id]?.code ?? ""}
                        onChange={(e) =>
                          setCourseEdits((prev) => ({
                            ...prev,
                            [course.id]: { ...(prev[course.id] ?? {}), code: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label>Nome</label>
                      <input
                        value={courseEdits[course.id]?.name ?? ""}
                        onChange={(e) =>
                          setCourseEdits((prev) => ({
                            ...prev,
                            [course.id]: { ...(prev[course.id] ?? {}), name: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="form-field tools-form-full">
                      <label>Descrição</label>
                      <textarea
                        rows={2}
                        value={courseEdits[course.id]?.description ?? ""}
                        onChange={(e) =>
                          setCourseEdits((prev) => ({
                            ...prev,
                            [course.id]: { ...(prev[course.id] ?? {}), description: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="tools-vaga-head" style={{ marginTop: "0.5rem" }}>
                    <strong className="tools-vaga-title">{course.code} - {course.name}</strong>
                    <button
                      type="button"
                      className="btn ghost btn-sm"
                      disabled={updatingCourseId === course.id}
                      onClick={() => handleUpdateCourse(course.id)}
                    >
                      {updatingCourseId === course.id ? "A guardar..." : "Guardar"}
                    </button>
                  </div>
                  {course.description && <p className="tools-vaga-desc">{course.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportacaoExcelTab({ showToast }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.xlsx') && !selectedFile.name.toLowerCase().endsWith('.xls')) {
        showToast('Por favor, selecione um ficheiro Excel (.xlsx ou .xls).', 'error');
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      showToast('Por favor, selecione um ficheiro Excel primeiro.', 'error');
      return;
    }

    setImporting(true);
    try {
      const importResults = await importExcelData(file);
      setResults(importResults);
      showToast('Importação concluída. Verifique os resultados abaixo.', 'success');
    } catch (err) {
      showToast(`Erro na importação: ${err.message}`, 'error');
    }
    setImporting(false);
  };

  const clearResults = () => {
    setResults(null);
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="tools-section">
      <div className="tools-card">
        <h3 className="tools-card-title">
          <span className="material-icons-sharp">upload_file</span>
          Importação Automática de Turmas via Excel
        </h3>
        <p className="tools-card-desc">
          Carregue um ficheiro Excel com apenas 3 colunas: Processo, Nome Completo e Turma.
          O sistema cria automaticamente a turma (quando não existir) e regista os alunos.
        </p>

        <div className="form-field">
          <label>Ficheiro Excel</label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={importing}
          />
          {file && <small>Ficheiro selecionado: {file.name}</small>}
        </div>

        <div className="tools-form-actions">
          <button
            type="button"
            className="btn primary"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? 'A importar...' : 'Importar Dados'}
          </button>
          {results && (
            <button type="button" className="btn ghost" onClick={clearResults}>
              Limpar Resultados
            </button>
          )}
        </div>

        {results && (
          <div className="tools-import-results">
            <h4>Resultados da Importação</h4>
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-head"><span>Linhas Processadas</span><span className="material-icons-sharp">table_rows</span></div>
                <h3>{results.rowsProcessed ?? 0}</h3>
              </article>
              <article className="stat-card">
                <div className="stat-head"><span>Alunos Registados</span><span className="material-icons-sharp">people</span></div>
                <h3>{results.studentsRegistered}</h3>
              </article>
              <article className="stat-card">
                <div className="stat-head"><span>Turmas Criadas</span><span className="material-icons-sharp">school</span></div>
                <h3>{results.classesCreated}</h3>
              </article>
              <article className="stat-card">
                <div className="stat-head"><span>Linhas Ignoradas</span><span className="material-icons-sharp">do_not_disturb</span></div>
                <h3>{results.skipped ?? 0}</h3>
              </article>
            </div>

            {results.errors.length > 0 && (
              <div className="tools-errors">
                <h5>Erros ({results.errors.length})</h5>
                <ul>
                  {results.errors.map((error, index) => (
                    <li key={index} className="error-item">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {results.warnings.length > 0 && (
              <div className="tools-warnings">
                <h5>Avisos ({results.warnings.length})</h5>
                <ul>
                  {results.warnings.map((warning, index) => (
                    <li key={index} className="warning-item">{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OrquestracaoSuperAdminTab({ showToast }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [selectedVacancyId, setSelectedVacancyId] = useState("ALL");
  const [processingId, setProcessingId] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const [appsResponse, vacanciesResponse] = await Promise.all([
        supabase
          .from("job_applications")
          .select(`
            id,
            status,
            applied_at,
            reviewed_at,
            acceptance_notes,
            rejection_reason,
            student:students(id, full_name, email),
            partner:partners(id, empresa),
            vacancy:partner_vacancies(id, title, status, total_slots, filled_slots)
          `)
          .order("applied_at", { ascending: false }),
        supabase
          .from("partner_vacancies")
          .select("id, title, status, total_slots, filled_slots, partner:partners(empresa)")
          .order("created_at", { ascending: false }),
      ]);

      setRows(appsResponse.data ?? []);
      setVacancies(vacanciesResponse.data ?? []);
    } catch {
      setRows([]);
      setVacancies([]);
      showToast("Falha ao carregar orquestração de candidaturas.", "error");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredRows = rows.filter((item) => {
    if (selectedVacancyId === "ALL") return true;
    return item?.vacancy?.id === selectedVacancyId;
  });

  const pendingRows = filteredRows.filter((item) => item.status === "PENDING");
  const acceptedRows = filteredRows.filter((item) => item.status === "ACCEPTED");
  const rejectedRows = filteredRows.filter((item) => item.status === "REJECTED");

  async function handleDecision(applicationId, decision) {
    if (!applicationId || processingId) return;
    setProcessingId(applicationId);
    try {
      const ok = decision === "ACCEPT"
        ? await acceptJobApplication(applicationId, "Validado por super admin")
        : await rejectJobApplication(applicationId, "Reprovado por super admin");

      if (!ok) {
        throw new Error("Falha na decisão da candidatura.");
      }

      showToast(
        decision === "ACCEPT" ? "Candidatura aceite por supervisão." : "Candidatura rejeitada por supervisão.",
        "success"
      );
      await refresh();
    } catch (err) {
      showToast(err?.message ?? "Não foi possível concluir a operação.", "error");
    }
    setProcessingId(null);
  }

  return (
    <div className="tools-section">
      <div className="tools-toolbar">
        <div className="form-field" style={{ minWidth: 300, marginBottom: 0 }}>
          <label>Filtrar por vaga</label>
          <select value={selectedVacancyId} onChange={(e) => setSelectedVacancyId(e.target.value)}>
            <option value="ALL">Todas as vagas</option>
            {vacancies.map((vacancy) => (
              <option key={vacancy.id} value={vacancy.id}>
                {vacancy.title} · {vacancy.partner?.empresa ?? "Empresa"}
              </option>
            ))}
          </select>
        </div>
        <span className="tools-count">{filteredRows.length} candidatura(s) no escopo</span>
      </div>

      <div className="stats-grid" style={{ marginBottom: "1rem" }}>
        <article className="stat-card">
          <div className="stat-head"><span>Pendentes</span><span className="material-icons-sharp">hourglass_empty</span></div>
          <h3>{pendingRows.length}</h3>
          <p>Aguardando decisão central.</p>
        </article>
        <article className="stat-card">
          <div className="stat-head"><span>Aceites</span><span className="material-icons-sharp">check_circle</span></div>
          <h3>{acceptedRows.length}</h3>
          <p>Já convertidas para estágio.</p>
        </article>
        <article className="stat-card">
          <div className="stat-head"><span>Rejeitadas</span><span className="material-icons-sharp">cancel</span></div>
          <h3>{rejectedRows.length}</h3>
          <p>Sem encaminhamento activo.</p>
        </article>
      </div>

      {loading ? (
        <div className="tools-loading"><span className="material-icons-sharp spinning">refresh</span> A carregar...</div>
      ) : filteredRows.length === 0 ? (
        <div className="tools-empty">
          <span className="material-icons-sharp">hub</span>
          <p>Sem candidaturas para o filtro selecionado.</p>
        </div>
      ) : (
        <div className="tools-table-wrap">
          <table className="tools-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Empresa</th>
                <th>Vaga</th>
                <th>Estado</th>
                <th>Submetida em</th>
                <th>Acção</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((item) => (
                <tr key={item.id}>
                  <td data-label="Aluno">
                    <strong>{item.student?.full_name ?? "—"}</strong>
                    <div className="meta">{item.student?.email ?? "Sem email"}</div>
                  </td>
                  <td data-label="Empresa">{item.partner?.empresa ?? "—"}</td>
                  <td data-label="Vaga">{item.vacancy?.title ?? "—"}</td>
                  <td data-label="Estado">
                    <Badge
                      label={item.status === "PENDING" ? "Pendente" : item.status === "ACCEPTED" ? "Aceite" : item.status === "REJECTED" ? "Rejeitada" : item.status}
                      variant={item.status === "PENDING" ? "warning" : item.status === "ACCEPTED" ? "success" : item.status === "REJECTED" ? "danger" : "neutral"}
                    />
                  </td>
                  <td data-label="Submetida em">
                    {item.applied_at ? new Date(item.applied_at).toLocaleString("pt-PT") : "—"}
                  </td>
                  <td data-label="Acção">
                    {item.status === "PENDING" ? (
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn primary btn-sm"
                          disabled={processingId === item.id}
                          onClick={() => handleDecision(item.id, "ACCEPT")}
                        >
                          Aceitar
                        </button>
                        <button
                          type="button"
                          className="btn ghost btn-sm"
                          disabled={processingId === item.id}
                          onClick={() => handleDecision(item.id, "REJECT")}
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      <span className="meta">Sem acção pendente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function ToolsPage() {
  const outletCtx = useOutletContext() ?? {};
  const location = useLocation();
  const navigate = useNavigate();
  const showToast = outletCtx.showToast ?? (() => {});
  const { authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("alunos");
  const [fallbackAreaId, setFallbackAreaId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    if (authProfile?.areaId) {
      setFallbackAreaId(null);
      return () => {
        active = false;
      };
    }

    async function resolveFallbackArea() {
      try {
        const [{ data: internshipRow }, { data: areaRow }] = await Promise.all([
          supabase
            .from("internships")
            .select("area_id")
            .not("area_id", "is", null)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("training_area")
            .select("id")
            .limit(1)
            .maybeSingle(),
        ]);

        if (!active) return;
        setFallbackAreaId(internshipRow?.area_id ?? areaRow?.id ?? null);
      } catch {
        if (active) setFallbackAreaId(null);
      }
    }

    resolveFallbackArea();

    return () => {
      active = false;
    };
  }, [authProfile?.areaId]);

  function handleStudentRegistered() {
    setReloadToken((v) => v + 1);
  }

  const _role = String(authProfile?.role ?? "").toUpperCase();
  const isSuperAdmin = _role === "SUPER_ADMIN";
  const isCoordinator = isCoordinatorRole(_role);
  const visibleTabs = resolveVisibleToolTabs(_role);

  useEffect(() => {
    const firstTab = visibleTabs[0]?.id ?? "alunos";
    const searchParams = new URLSearchParams(location.search);
    const requestedTab = searchParams.get("tab");
    const nextTab = resolveRequestedToolsTab(requestedTab, visibleTabs, firstTab);

    if (requestedTab && requestedTab !== nextTab) {
      navigate(`/ferramentas?tab=${encodeURIComponent(nextTab)}`, { replace: true });
    }

    setActiveTab(nextTab);
  }, [location.search, navigate, visibleTabs]);

  useEffect(() => {
    const firstTab = visibleTabs[0]?.id ?? "alunos";
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(firstTab);
    }
  }, [activeTab, visibleTabs]);

  if (!isCoordinator && !isSuperAdmin) {
    return (
      <div className="page">
        <PageHeader
          title="Ferramentas"
          subtitle="Área restrita a administradores."
          icon="build"
        />
        <div className="tools-empty" style={{ gridColumn: "1/-1" }}>
          <span className="material-icons-sharp">lock</span>
          <p>Não tem permissão para aceder a esta área.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-tools">
      <PageHeader
        title="Ferramentas"
        subtitle="Registo de alunos, gestão de vagas, atribuições e pautas de notas."
        icon="build"
      />

      {/* Tabs de navegação */}
      <div className="tools-tabs-wrap" style={{ gridColumn: "1/-1" }}>
        <div className="tools-tabs">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tools-tab${activeTab === tab.id ? " active" : ""}`}
              onClick={() => {
                if (!canAccessToolsTab(_role, tab.id)) {
                  showToast("Permissão insuficiente para este separador.", "error");
                  return;
                }
                setActiveTab(tab.id);
                navigate(`/ferramentas?tab=${encodeURIComponent(tab.id)}`, { replace: true });
              }}
            >
              <span className="material-icons-sharp">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da tab activa */}
      <div className="tools-content" style={{ gridColumn: "1/-1" }}>
        {activeTab === "alunos"      && <AlunosTab showToast={showToast} reloadToken={reloadToken} />}
        {activeTab === "registar"   && <RegistarTab showToast={showToast} authProfile={authProfile} fallbackAreaId={fallbackAreaId} onRegistered={handleStudentRegistered} />}
        {activeTab === "importar"   && <ImportarTab showToast={showToast} authProfile={authProfile} fallbackAreaId={fallbackAreaId} onImported={handleStudentRegistered} />}
        {activeTab === "turmas"     && <TurmasTab showToast={showToast} areaId={authProfile?.areaId ?? null} />}
        {activeTab === "vagas"      && <VagasTab showToast={showToast} />}
        {activeTab === "atribuicao" && <AtribuicaoTab showToast={showToast} reloadToken={reloadToken} />}
        {activeTab === "pautas"     && <PautasTab showToast={showToast} reloadToken={reloadToken} />}
        {activeTab === "utilizadores" && isSuperAdmin && <UsersManagementPage embedded showToast={showToast} />}
        {activeTab === "orquestracao" && isSuperAdmin && <OrquestracaoSuperAdminTab showToast={showToast} />}
        {activeTab === "estrutura"  && isSuperAdmin && <EstruturaAcademicaTab showToast={showToast} />}
        {activeTab === "importacao" && isSuperAdmin && <ImportacaoExcelTab showToast={showToast} />}
      </div>
    </div>
  );
}

