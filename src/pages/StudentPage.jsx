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

  return (
    <main className="page page-student">
      <PageHeader
        title={t("student.title")}
        description={studentName ? `${t("student.description")} — ${studentName}` : t("student.description")}
      />

      <section className="panel-grid student-main-grid">
        <article className="panel student-competencies-panel">
          <h3>{t("student.competencies")}</h3>
          <div className="bars">
            {competencies.map(({ label, pct }, i) => (
              <div className="bar" key={label}>
                <strong>{label}</strong>
                <div className={i === 1 ? "line line-accent" : "line"}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          {user?.id && (
            <div className="panel-actions" style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
              <Link className="btn secondary small" to={`/perfil/${user.id}`}>{t("student.viewProfile") || "Ver perfil"}</Link>
              <Link className="btn secondary small" to={`/progresso/${user.id}`}>{t("student.viewProgress") || "Ver progresso"}</Link>
            </div>
          )}
        </article>

        <article className="form-card student-note-panel">
          <h3>{t("student.coordinatorNote")}</h3>
          <form onSubmit={saveNote}>
            <div className="form-field">
              <label htmlFor="student-note">{t("student.observation")}</label>
              <textarea id="student-note" rows="4" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">{t("student.saveNote")}</button>
            </div>
          </form>
        </article>
      </section>

      <section className="panel student-timeline-panel">
        <h3>{t("student.timeline")}</h3>
        <div className="list">
          {myApplications.length > 0 ? (
            myApplications
              .filter((app) => matchesSearch(query, app.partner?.empresa || ""))
              .map((app) => (
                <div className="list-item" key={app.id}>
                  <strong>{app.partner?.empresa || app.partner_id}</strong>
                  <span className={`badge badge-${app.status}`} style={{ marginLeft: "0.5rem" }}>
                    {t(`application.status.${app.status}`) || app.status}
                  </span>
                </div>
              ))
          ) : (
            [t("student.t1"), t("student.t2"), t("student.t3")]
              .filter((item) => matchesSearch(query, item))
              .map((item) => (
                <div className="list-item" key={item}>
                  <strong>{item}</strong>
                </div>
              ))
          )}
        </div>
      </section>
    </main>
  );
}
