import { useEffect } from "react";

const AVATAR_PALETTE = ["#0c9a61", "#1a73e8", "#b97c12", "#c23b57", "#5c4fcf"];

function avatarColor(name) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function initials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function statusMeta(status, t) {
  if (status === "active") return { label: t("internships.active"), cls: "smodal-tag-active" };
  if (status === "monitoring") return { label: t("internships.monitoring"), cls: "smodal-tag-monitoring" };
  return { label: t("internships.risk"), cls: "smodal-tag-risk" };
}

export default function StudentProfileModal({ student, onClose, t }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const { label: statusLabel, cls: statusCls } = statusMeta(student.status, t);
  const skillLabels = [
    t("student.skill.analysis"),
    t("student.skill.communication"),
    t("student.skill.autonomy"),
  ];
  const skillValues = student.skills ?? [87, 68, 63];
  const skillClasses = ["", "line-accent", "line-danger"];
  const timelineItems = [t("student.t1"), t("student.t2"), t("student.t3")];

  return (
    <>
      <div className="smodal-overlay" onClick={onClose} aria-hidden="true" />

      <aside
        className="smodal"
        role="dialog"
        aria-modal="true"
        aria-label={`${t("student.modal.profile")}: ${student.aluno}`}
      >
        <div className="smodal-header">
          {student.photo ? (
            <img className="smodal-avatar-image" src={student.photo} alt="" />
          ) : (
            <div
              className="smodal-avatar"
              style={{ background: avatarColor(student.aluno) }}
              aria-hidden="true"
            >
              {initials(student.aluno)}
            </div>
          )}

          <div className="smodal-hero-info">
            <strong>{student.aluno}</strong>
            <div className="smodal-badges">
              <span className="tag">{student.curso}</span>
              <span className={`tag ${statusCls}`}>{statusLabel}</span>
            </div>
          </div>

          <button
            className="smodal-close"
            type="button"
            onClick={onClose}
            aria-label={t("student.modal.close")}
          >
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <div className="smodal-body">
          <section className="smodal-section">
            <h3>{t("student.modal.contact")}</h3>
            <div className="smodal-info-list">
              <div className="smodal-info-row">
                <span className="material-icons-sharp" aria-hidden="true">apartment</span>
                <span>{student.empresa}</span>
              </div>
              <div className="smodal-info-row">
                <span className="material-icons-sharp" aria-hidden="true">mail_outline</span>
                <span>{student.email ?? "—"}</span>
              </div>
              <div className="smodal-info-row">
                <span className="material-icons-sharp" aria-hidden="true">phone</span>
                <span>{student.telefone ?? "—"}</span>
              </div>
              <div className="smodal-info-row">
                <span className="material-icons-sharp" aria-hidden="true">calendar_today</span>
                <span>{t("student.modal.since")}: {student.inicio ?? "—"}</span>
              </div>
              {student.nota !== undefined && (
                <div className="smodal-info-row">
                  <span className="material-icons-sharp" aria-hidden="true">grade</span>
                  <span>{t("evaluations.grade")}: <strong>{student.nota}</strong></span>
                </div>
              )}
            </div>
          </section>

          <section className="smodal-section">
            <h3>{t("student.competencies")}</h3>
            <div className="bars">
              {skillLabels.map((label, i) => (
                <div key={label} className="bar">
                  <strong>{label}</strong>
                  <div className={`line ${skillClasses[i]}`}>
                    <span style={{ width: `${skillValues[i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="smodal-section">
            <h3>{t("student.timeline")}</h3>
            <div className="smodal-timeline">
              {timelineItems.map((item) => (
                <div key={item} className="smodal-timeline-item">
                  <div className="smodal-timeline-dot" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
