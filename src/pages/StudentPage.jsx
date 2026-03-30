import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { matchesSearch } from "../utils/search.js";

export default function StudentPage() {
  const { query, showToast, t } = useOutletContext();
  const studentTimeline = [t("student.t1"), t("student.t2"), t("student.t3")];
  const [note, setNote] = useState("");

  function saveNote(event) {
    event.preventDefault();
    if (!note.trim()) {
      showToast(t("student.toast.noteRequired"), "error");
      return;
    }
    showToast(t("student.toast.saved"));
    setNote("");
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>{t("student.title")}</h2>
        <p>{t("student.description")}</p>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h3>{t("student.competencies")}</h3>
          <div className="bars">
            <div className="bar">
              <strong>{t("student.skill.analysis")}</strong>
              <div className="line"><span className="p-87" /></div>
            </div>
            <div className="bar">
              <strong>{t("student.skill.communication")}</strong>
              <div className="line line-accent"><span className="p-68" /></div>
            </div>
            <div className="bar">
              <strong>{t("student.skill.autonomy")}</strong>
              <div className="line"><span className="p-63" /></div>
            </div>
          </div>
        </article>

        <article className="form-card">
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

      <section className="panel">
        <h3>{t("student.timeline")}</h3>
        <div className="list">
          {studentTimeline
            .filter((item) => matchesSearch(query, item))
            .map((item) => (
              <div className="list-item" key={item}>
                <strong>{item}</strong>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
