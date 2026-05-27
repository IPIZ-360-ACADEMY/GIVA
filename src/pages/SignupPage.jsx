import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoImage from "../../images/logo.png";
import {
  PENDING_STUDENT_OAUTH_STORAGE,
   isValidEmail,
  requiresEmailConfirmation,
  signInWithOAuth,
  signUpStudent,
  signUpWithType,
  uploadAvatar,
  verifyStudentProcessNumber,
} from "../services/authService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";

const TYPES = [
  {
    id: "student",
    icon: "school",
    label: "Aluno",
    description: "Aluno inscrito no IPIZ — usa o teu número de processo",
  },
  {
    id: "company",
    icon: "apartment",
    label: "Empresa",
    description: "Empresa ou parceiro institucional do IPIZ",
  },
  {
    id: "external",
    icon: "visibility",
    label: "Visitante",
    description: "Acesso público para acompanhar a comunidade IPIZ",
  },
];

function TypeCard({ type, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`signup-type-card${selected ? " selected" : ""}`}
      onClick={() => onSelect(type.id)}
    >
      <span className="material-icons-sharp signup-type-icon">{type.icon}</span>
      <strong>{type.label}</strong>
      <small>{type.description}</small>
    </button>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="student-info-row">
      <span className="student-info-label">{label}</span>
      <span className="student-info-value">{value}</span>
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();

  function goToEmailStatus({ email, purpose, source }) {
    const query = new URLSearchParams({
      email: String(email ?? "").trim().toLowerCase(),
      purpose: String(purpose ?? "activation"),
      source: String(source ?? "signup"),
    }).toString();
    navigate(`/email-status?${query}`, { replace: true });
  }

  // step: 1 = tipo | 2 = lookup/formulário | 3 = senha aluno | 4 = pendente empresa
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [error, setError] = useState("");

  // ── Aluno: verificação ────────────────────────────────────────────────────
  const [processNumber, setProcessNumber] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState(null);

  // ── Aluno: senha ─────────────────────────────────────────────────────────
  const [studentPassword, setStudentPassword] = useState("");
  const [studentConfirm, setStudentConfirm] = useState("");
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [oauthProviderLoading, setOauthProviderLoading] = useState("");

  // ── Empresa / Externo ─────────────────────────────────────────────────────
  const [companyForm, setCompanyForm] = useState({
    display_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [submittingOther, setSubmittingOther] = useState(false);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [studentAvatarFile, setStudentAvatarFile] = useState(null);
  const [studentAvatarPreview, setStudentAvatarPreview] = useState(null);
  const avatarInputRef = useRef(null);
  const studentAvatarInputRef = useRef(null);

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleStudentAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStudentAvatarFile(file);
    setStudentAvatarPreview(URL.createObjectURL(file));
  }

  function handleTypeNext() {
    if (!selectedType) { setError("Escolhe o tipo de conta"); return; }
    setError("");
    setStep(2);
  }

  function goBackToType() {
    setStep(1);
    setError("");
    setVerifiedStudent(null);
    setProcessNumber("");
    setStudentPassword("");
    setStudentConfirm("");
  }

  // ─── ALUNO: verificar processo ─────────────────────────────────────────────
  async function handleVerifyProcess(e) {
    e.preventDefault();
    const num = normalizeStudentProcessNumber(processNumber);
    if (!num) { setError("Introduz o número de processo"); return; }
    setError("");
    setVerifying(true);
    const { data, error: rpcError } = await verifyStudentProcessNumber(num);
    setVerifying(false);
    if (rpcError) {
      setError("Erro de ligação. Tenta novamente.");
      return;
    }
    if (!data || !data.found) {
      setError(data?.message ?? "Número de processo não encontrado.");
      return;
    }
    setVerifiedStudent(data);
    setStep(3);
  }

  // ─── ALUNO: criar conta ────────────────────────────────────────────────────
  async function handleStudentSignup(e) {
    e.preventDefault();
    if (studentPassword.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (studentPassword !== studentConfirm) {
      setError("As senhas não coincidem");
      return;
    }
    setError("");
    setSubmittingStudent(true);
    const normalizedProcessNumber = normalizeStudentProcessNumber(processNumber);

    const { data: signUpData, error: signUpError } = await signUpStudent(
      normalizedProcessNumber,
      studentPassword,
      verifiedStudent.full_name,
      verifiedStudent.student_id ?? null,
      verifiedStudent.email ?? null
    );

    setSubmittingStudent(false);

    if (signUpError) {
      const msg = signUpError.message ?? "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setError("Este número de processo já tem conta. Faz login.");
      } else {
        setError(msg || "Erro ao criar conta. Tenta novamente.");
      }
      return;
    }

    // Faz upload do avatar (em background, não bloqueia)
    if (studentAvatarFile) {
      uploadAvatar(studentAvatarFile, "students").catch(() => null);
    }

    if (requiresEmailConfirmation(signUpData)) {
      goToEmailStatus({
        email: verifiedStudent?.email,
        purpose: "activation",
        source: "signup-student",
      });
      return;
    }

    navigate("/login", {
      replace: true,
      state: {
        signupMessage: "Conta criada com sucesso. Podes entrar agora.",
      },
    });
  }

  async function handleStudentOAuthSignup(provider) {
    const normalizedProcessNumber = normalizeStudentProcessNumber(processNumber);
    if (!normalizedProcessNumber) {
      setError("Introduz um número de processo válido para continuar.");
      setStep(2);
      return;
    }

    setError("");
    setOauthProviderLoading(provider);

    const { data, error: rpcError } = await verifyStudentProcessNumber(normalizedProcessNumber);
    if (rpcError) {
      setOauthProviderLoading("");
      setError("Erro de ligação ao validar número de processo. Tenta novamente.");
      return;
    }

    if (!data?.found) {
      setOauthProviderLoading("");
      setStep(2);
      setError(data?.message ?? "Número de processo não encontrado. Contacta a secretaria ou o admin do sistema.");
      return;
    }

    const payload = {
      processNumber: normalizedProcessNumber,
      fullName: data.full_name ?? verifiedStudent?.full_name ?? "",
      studentId: data.student_id ?? verifiedStudent?.student_id ?? null,
      createdAt: Date.now(),
    };

    sessionStorage.setItem(PENDING_STUDENT_OAUTH_STORAGE, JSON.stringify(payload));
    const { error: oauthError } = await signInWithOAuth(provider);

    if (oauthError) {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
      setOauthProviderLoading("");
      setError("Não foi possível iniciar login com provedor externo. Tenta novamente.");
      return;
    }
  }

  // ─── EMPRESA / EXTERNO: formulário ─────────────────────────────────────────
  function handleCompanyChange(e) {
    setCompanyForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleOtherSignup(e) {
    e.preventDefault();
     if (!isValidEmail(companyForm.email)) {
       setError("Por favor, introduz um e-mail válido com domínio real (ex: nome@empresa.com)");
       return;
     }
    if (companyForm.password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (companyForm.password !== companyForm.confirm_password) {
      setError("As senhas não coincidem");
      return;
    }
    setError("");
    setSubmittingOther(true);

    let avatarUrl = null;
    if (avatarFile) {
      const prefix = selectedType === "company" ? "companies" : "visitors";
      const { url } = await uploadAvatar(avatarFile, prefix);
      avatarUrl = url;
    }

    const typeData = avatarUrl ? { avatar_url: avatarUrl } : {};

    const { data: signUpData, error: signUpError } = await signUpWithType(
      companyForm.email.trim(),
      companyForm.password,
      companyForm.display_name.trim(),
      selectedType,
      typeData
    );

    setSubmittingOther(false);

    if (signUpError) {
      const msg = signUpError.message ?? "";
      if (msg.includes("already registered") || msg.includes("already exists")) {
        setError("Este e-mail já está registado. Tenta fazer login.");
      } else {
        setError(msg || "Erro ao criar conta. Tenta novamente.");
      }
      return;
    }

    const shouldConfirmByEmail = selectedType === "company" || requiresEmailConfirmation(signUpData);
    if (shouldConfirmByEmail) {
      goToEmailStatus({
        email: companyForm.email,
        purpose: "activation",
        source: selectedType === "company" ? "signup-company" : "signup-external",
      });
      return;
    }

    navigate("/login", {
      replace: true,
      state: {
        signupMessage: "Conta criada com sucesso. Podes entrar agora.",
      },
    });
  }

  return (
    <main className="login-shell">
      <div className="login-box signup-box">
        <div className="login-box-logo">
          <img className="login-box-img" src={logoImage} alt="" />
        </div>

        {/* ── STEP 1: Escolha de tipo ─────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="login-box-head">
              <h1>Criar conta</h1>
              <p>Plataforma institucional IPIZ</p>
            </div>
            <div className="signup-step">
              <p className="signup-step-hint">Que tipo de conta queres criar?</p>
              <div className="signup-type-grid">
                {TYPES.map((t) => (
                  <TypeCard
                    key={t.id}
                    type={t}
                    selected={selectedType === t.id}
                    onSelect={setSelectedType}
                  />
                ))}
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="button" className="btn primary" onClick={handleTypeNext} style={{ marginTop: "1rem", width: "100%" }}>
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2 (ALUNO): Inserir número de processo ─────────────── */}
        {step === 2 && selectedType === "student" && (
          <>
            <div className="login-box-head">
              <h1>Verificar matrícula</h1>
              <p>Introduz o teu número de processo IPIZ</p>
            </div>
            <form className="login-box-form" onSubmit={handleVerifyProcess}>
              <div className="form-field">
                <label htmlFor="s-proc">Número de processo</label>
                <input
                  id="s-proc"
                  name="process_number"
                  type="text"
                  required
                  autoFocus
                  value={processNumber}
                  onChange={(e) => setProcessNumber(normalizeStudentProcessNumber(e.target.value))}
                  placeholder="Ex: 2024/001"
                  disabled={verifying}
                />
                <small className="form-hint">Atribuído pelo IPIZ na tua matrícula</small>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn primary" disabled={verifying}>
                {verifying
                  ? <><span className="material-icons-sharp spinning" style={{ fontSize: "1rem", verticalAlign: "middle", marginRight: "0.4rem" }}>sync</span>A verificar...</>
                  : "Verificar →"}
              </button>
              <button type="button" className="btn ghost" onClick={goBackToType} style={{ marginTop: "0.5rem" }}>
                ← Voltar
              </button>
            </form>
          </>
        )}

        {/* ── STEP 3 (ALUNO): Confirmar dados + definir senha ─────────── */}
        {step === 3 && selectedType === "student" && verifiedStudent && (
          <>
            <div className="login-box-head">
              <h1>Confirmar identidade</h1>
              <p>Verifica os dados e define a tua senha</p>
            </div>
            <form className="login-box-form" onSubmit={handleStudentSignup}>
              <div className="student-info-card">
                <div className="student-info-badge">
                  <span className="material-icons-sharp">verified</span>
                  Matrícula confirmada
                </div>
                <InfoRow label="Nome completo" value={verifiedStudent.full_name} />
                {verifiedStudent.date_of_birth && (
                  <InfoRow label="Data de nascimento" value={new Date(verifiedStudent.date_of_birth).toLocaleDateString("pt-AO")} />
                )}
                <InfoRow label="Telefone" value={verifiedStudent.phone_number} />
                <InfoRow label="E-mail" value={verifiedStudent.email} />
                <InfoRow label="Curso" value={verifiedStudent.course_name} />
                <InfoRow label="Área de formação" value={verifiedStudent.training_area_name} />
                {verifiedStudent.guardian_name && (
                  <>
                    <InfoRow label="Encarregado" value={verifiedStudent.guardian_name} />
                    <InfoRow label="Cont. encarregado" value={verifiedStudent.guardian_phone} />
                  </>
                )}
              </div>

              {/* Foto de perfil (opcional) */}
              <div className="form-field" style={{ alignItems: "center", marginTop: "1.2rem" }}>
                <label>Foto de perfil <small style={{ fontWeight: 400 }}>(opcional)</small></label>
                <div className="avatar-upload-wrapper" onClick={() => studentAvatarInputRef.current?.click()}>
                  {studentAvatarPreview
                    ? <img src={studentAvatarPreview} className="avatar-upload-preview" alt="preview" />
                    : <div className="avatar-upload-placeholder"><span className="material-icons-sharp">add_a_photo</span></div>
                  }
                </div>
                <input ref={studentAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleStudentAvatarChange} />
              </div>

              <div className="form-field" style={{ marginTop: "1.2rem" }}>
                <label htmlFor="s-pass">Escolher senha</label>
                <input
                  id="s-pass"
                  type="password"
                  required
                  minLength={8}
                  maxLength={12}
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  placeholder="8-12 caracteres"
                />
              </div>
              <div className="form-field">
                <label htmlFor="s-confirm">Confirmar senha</label>
                <input
                  id="s-confirm"
                  type="password"
                  required
                  maxLength={12}
                  value={studentConfirm}
                  onChange={(e) => setStudentConfirm(e.target.value)}
                  placeholder="Repete a senha"
                />
              </div>

              <div className="oauth-hint-box">
                <span className="material-icons-sharp" style={{ fontSize: "1rem", color: "var(--primary)" }}>tips_and_updates</span>
                Também podes criar a conta com <strong>Google</strong> ou <strong>LinkedIn</strong>. O número de processo será validado antes da confirmação do provedor.
              </div>

              {error && <p className="form-error">{error}</p>}

              <div className="form-actions" style={{ marginTop: "0.5rem", marginBottom: "0.5rem", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={submittingStudent || Boolean(oauthProviderLoading)}
                  onClick={() => handleStudentOAuthSignup("google")}
                >
                  {oauthProviderLoading === "google" ? "A validar..." : "Criar conta com Google"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={submittingStudent || Boolean(oauthProviderLoading)}
                  onClick={() => handleStudentOAuthSignup("linkedin_oidc")}
                >
                  {oauthProviderLoading === "linkedin_oidc" ? "A validar..." : "Criar conta com LinkedIn"}
                </button>
              </div>

              <button type="submit" className="btn primary" disabled={submittingStudent}>
                {submittingStudent ? "A criar conta..." : "Criar conta"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setStep(2); setError(""); setStudentPassword(""); setStudentConfirm(""); }}
                style={{ marginTop: "0.5rem" }}
              >
                ← Alterar processo
              </button>
            </form>
          </>
        )}

        {/* ── STEP 2 (EMPRESA / EXTERNO): Formulário ─────────────────── */}
        {step === 2 && (selectedType === "company" || selectedType === "external") && (
          <>
            <div className="login-box-head">
              <h1>{selectedType === "company" ? "Registar empresa" : "Criar conta visitante"}</h1>
              <p>{selectedType === "company"
                ? "Confirma o e-mail e aguarda aprovação do administrador"
                : "Acesso público à comunidade IPIZ"}
              </p>
            </div>
            <form className="login-box-form" onSubmit={handleOtherSignup}>
              {/* Avatar / Logo */}
              <div className="form-field" style={{ alignItems: "center" }}>
                <label>{selectedType === "company" ? "Logo da empresa" : "Foto de perfil"} <small style={{ fontWeight: 400 }}>(opcional)</small></label>
                <div className="avatar-upload-wrapper" onClick={() => avatarInputRef.current?.click()}>
                  {avatarPreview
                    ? <img src={avatarPreview} className="avatar-upload-preview" alt="preview" />
                    : <div className="avatar-upload-placeholder"><span className="material-icons-sharp">add_a_photo</span></div>
                  }
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
              </div>
              <div className="form-field">
                <label htmlFor="o-name">{selectedType === "company" ? "Nome da empresa" : "Nome completo"}</label>
                <input id="o-name" name="display_name" type="text" required autoFocus value={companyForm.display_name} onChange={handleCompanyChange} placeholder={selectedType === "company" ? "Nome institucional" : "O teu nome"} />
              </div>
              <div className="form-field">
                <label htmlFor="o-email">E-mail</label>
                <input id="o-email" name="email" type="email" required value={companyForm.email} onChange={handleCompanyChange} placeholder="email@exemplo.com" />
              </div>
              <div className="form-field">
                <label htmlFor="o-pass">Senha</label>
                 <input id="o-pass" name="password" type="password" required minLength={8} maxLength={12} value={companyForm.password} onChange={handleCompanyChange} placeholder="8-12 caracteres" />
              </div>
              <div className="form-field">
                <label htmlFor="o-confirm">Confirmar senha</label>
                 <input id="o-confirm" name="confirm_password" type="password" required maxLength={12} value={companyForm.confirm_password} onChange={handleCompanyChange} placeholder="Repete a senha" />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn primary" disabled={submittingOther}>
                {submittingOther ? "A criar conta..." : selectedType === "company" ? "Submeter pedido" : "Criar conta"}
              </button>
              <button type="button" className="btn ghost" onClick={goBackToType} style={{ marginTop: "0.5rem" }}>
                ← Voltar
              </button>
            </form>
          </>
        )}

        <p className="login-box-footer" style={{ marginTop: "1rem" }}>
          Já tens conta?{" "}
          <Link to="/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
