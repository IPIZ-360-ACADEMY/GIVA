import { useOutletContext, Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { matchesSearch } from "../utils/search.js";
import { canUseStudentNotesApi, createStudentNote } from "../services/studentNotesService.js";
import { canUseJobApplicationApi, listStudentApplications } from "../services/jobApplicationService.js";
import { canUseStudentProfileApi, getStudentProfile } from "../services/studentProfileService.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function StudentPage() {
  const { query, showToast, t } = useOutletContext();
  const { user, authProfile } = useAuth();
  const [note, setNote] = useState("");
  const [myApplications, setMyApplications] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);

  useEffect(() => {
    if (user?.id && canUseStudentProfileApi()) {
      getStudentProfile(user.id)
        .then((data) => setStudentProfile(data))
        .catch(() => {});
    }
  }, [user]);

  const defaultCompetencies = useMemo(
    () => [
      { label: t("student.skill.analysis"), pct: 87 },
      { label: t("student.skill.communication"), pct: 68 },
      { label: t("student.skill.autonomy"), pct: 63 },
    ],
    [t]
  );

  const competencies = useMemo(() => {
    const skills = studentProfile?.skills;
    if (Array.isArray(skills) && skills.length > 0) {
      return skills.slice(0, 3).map((name, i) => ({
        label: name,
        pct: defaultCompetencies[i]?.pct ?? 70,
      }));
    }
    return defaultCompetencies;
  }, [studentProfile, defaultCompetencies]);

  useEffect(() => {
    async function loadApplications() {
      if (!user?.id || !canUseJobApplicationApi()) return;
      const data = await listStudentApplications(user.id);
      setMyApplications(data);
    }
    loadApplications();
  }, [user]);

  async function saveNote(event) {
    event.preventDefault();
    if (!note.trim()) {
      showToast(t("student.toast.noteRequired"), "error");
      return;
    }

    if (!canUseStudentNotesApi()) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return;
    }

    const studentName = authProfile?.full_name || user?.email || "Aluno";
    try {
      await createStudentNote({ note, studentName });
    } catch {
      showToast("Não foi possível guardar a nota.", "error");
      return;
    }

    showToast(t("student.toast.saved"));
    setNote("");
  }

  const studentName = authProfile?.full_name || user?.email || "";

  // Menu actions
  const menuActions = useMemo(() => {
    if (!user?.id) return [];
    return [
      {
        id: "profile",
        icon: "person",
        title: t("student.viewProfile") || "Ver Perfil",
        description: t("student.viewProfile.desc") || "Gerencie seus dados pessoais e profissionais",
        path: `/perfil/${user.id}`,
        color: "blue",
      },
      {
        id: "progress",
        icon: "trending_up",
        title: t("student.viewProgress") || "Ver Progresso",
        description: t("student.viewProgress.desc") || "Acompanhe sua trajetória e estágios",
        path: `/progresso/${user.id}`,
        color: "emerald",
      },
      {
        id: "applications",
        icon: "assignment_ind",
        title: t("student.applications") || "Minhas Candidaturas",
        description: t("student.applications.desc") || `${myApplications.length} candidatura(s) pendente(s)`,
        path: `/parceiros`,
        color: "purple",
      },
      {
        id: "evaluations",
        icon: "assignment",
        title: t("student.evaluations") || "Avaliações",
        description: t("student.evaluations.desc") || "Consulte suas notas e feedback",
        path: `/avaliacoes`,
        color: "orange",
      },
    ];
  }, [user?.id, myApplications.length, t]);

  return (
    <main className="page page-student">

      {/* Hero */}
      <div className="student-hero">
        <div className="student-hero-avatar">
          {authProfile?.avatar_url ? (
            <img src={authProfile.avatar_url} alt="" className="student-hero-photo" />
          ) : (
            <span className="student-hero-initials">{(studentName || "?").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="student-hero-text">
          <h1 className="student-hero-name">{studentName || t("student.title")}</h1>
          <p className="student-hero-sub">{t("student.description")}</p>
        </div>
      </div>

      {/* Menu Section */}
      <div className="student-menu-section">
        <h2 className="student-menu-title">{t("student.whatWouldYouLikeToDo") || "O que você deseja fazer?"}</h2>
        <p className="student-menu-subtitle">{t("student.selectOption") || "Escolha uma das opções abaixo para começar."}</p>
        
        <div className="student-menu-grid">
          {menuActions.map((action) => (
            <Link
              key={action.id}
              to={action.path}
              className={`student-menu-card student-menu-card--${action.color}`}
            >
              <div className="student-menu-icon-box">
                <span className="material-icons-sharp">{action.icon}</span>
              </div>
              <div className="student-menu-content">
                <h3 className="student-menu-item-title">{action.title}</h3>
                <p className="student-menu-item-desc">{action.description}</p>
              </div>
              <div className="student-menu-arrow">
                <span className="material-icons-sharp">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Details Section */}
      <div className="student-details-section">
        <h2 className="student-details-title">{t("student.moreInfo") || "Mais Informações"}</h2>
        <div className="student-body-grid">

        {/* Competencies card */}
        <div className="student-card">
          <div className="student-card-header">
            <span className="material-icons-sharp">psychology</span>
            <h2>{t("student.competencies")}</h2>
          </div>
          <div className="student-skills">
            {competencies.map(({ label, pct }, i) => (
              <div className="student-skill" key={label}>
                <div className="student-skill-meta">
                  <span>{label}</span>
                  <strong>{pct}%</strong>
                </div>
                <div className="student-skill-bar">
                  <div
                    className={`student-skill-fill${i === 1 ? " student-skill-fill--accent" : ""}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note form */}
        <div className="student-card">
          <div className="student-card-header">
            <span className="material-icons-sharp">edit_note</span>
            <h2>{t("student.coordinatorNote")}</h2>
          </div>
          <form onSubmit={saveNote} className="student-note-form">
            <label htmlFor="student-note" className="student-note-label">{t("student.observation")}</label>
            <textarea
              id="student-note"
              className="student-note-textarea"
              rows="4"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button className="student-note-btn" type="submit">
              <span className="material-icons-sharp">save</span>
              {t("student.saveNote")}
            </button>
          </form>
        </div>

        {/* Applications timeline */}
        <div className="student-card student-card--wide">
          <div className="student-card-header">
            <span className="material-icons-sharp">timeline</span>
            <h2>{t("student.timeline")}</h2>
            {myApplications.length > 0 && (
              <span className="student-badge">{myApplications.length}</span>
            )}
          </div>
          <div className="student-timeline">
            {myApplications.length > 0 ? (
              myApplications
                .filter((app) => matchesSearch(query, app.partner?.empresa || ""))
                .map((app) => (
                  <div className="student-timeline-item" key={app.id}>
                    <div className={`student-timeline-dot student-timeline-dot--${(app.status || "pending").toLowerCase()}`} />
                    <div className="student-timeline-content">
                      <strong>{app.partner?.empresa || app.partner_id}</strong>
                      <span className={`student-app-badge student-app-badge--${(app.status || "pending").toLowerCase()}`}>
                        {t(`application.status.${app.status}`) || app.status}
                      </span>
                    </div>
                  </div>
                ))
            ) : (
              [t("student.t1"), t("student.t2"), t("student.t3")]
                .filter((item) => matchesSearch(query, item))
                .map((item) => (
                  <div className="student-timeline-item" key={item}>
                    <div className="student-timeline-dot student-timeline-dot--active" />
                    <div className="student-timeline-content">
                      <strong>{item}</strong>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        </div>
      </div>
    </main>
  );
}
