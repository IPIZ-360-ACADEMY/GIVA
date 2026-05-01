import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const INITIAL_FORM = {
  anoLetivo: "",
  curso: "",
  turma: "",
  supervisor: "",
};

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

export default function ClassRegisterModal({ onClose, onSave, t, courseOptions = [] }) {
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function handleChange(partial) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function submit(event) {
    event.preventDefault();

    const payload = {
      anoLetivo: String(form.anoLetivo).trim(),
      curso: String(form.curso).trim().toUpperCase(),
      turma: String(form.turma).trim(),
      supervisor: String(form.supervisor).trim(),
      total: 0,
      ativos: 0,
      monitoramento: 0,
      risco: 0,
      mediaNota: "0.0",
    };

    if (!payload.anoLetivo || !payload.curso || !payload.turma) {
      onSave(null, t("classModal.toast.required"));
      return;
    }

    const schoolYear = parseSchoolYear(payload.anoLetivo);
    if (!schoolYear) {
      onSave(null, t("classModal.toast.invalidSchoolYear"));
      return;
    }

    if (schoolYear.startYear < new Date().getFullYear()) {
      onSave(null, t("classModal.toast.pastSchoolYear"));
      return;
    }

    const saved = onSave(payload);
    if (saved !== false) {
      onClose();
    }
  }

  return createPortal(
    <div className="pmodal-layer" role="presentation">
      <div className="pmodal-overlay" onClick={onClose} aria-hidden="true" />

      <div className="pmodal" role="dialog" aria-modal="true" aria-label={t("classModal.title")}>
        <div className="pmodal-header">
          <span className="material-icons-sharp pmodal-icon" aria-hidden="true">
            school
          </span>
          <h3>{t("classModal.title")}</h3>
          <button className="smodal-close" type="button" onClick={onClose} aria-label={t("classModal.close")}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <div className="pmodal-body">
          <form id="class-register-form" onSubmit={submit}>
            <section className="pmodal-section">
              <h4 className="pmodal-section-title">
                <span className="material-icons-sharp" aria-hidden="true">fact_check</span>
                {t("classModal.section.data")}
              </h4>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="class-year">{t("classModal.label.schoolYear")}</label>
                  <input
                    id="class-year"
                    value={form.anoLetivo}
                    placeholder="2025/2026"
                    onChange={(e) => handleChange({ anoLetivo: e.target.value })}
                    pattern="[0-9]{4}/[0-9]{4}"
                    title={t("classModal.hint.schoolYear")}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="class-course">{t("classModal.label.course")}</label>
                  {courseOptions.length > 0 ? (
                    <select id="class-course" value={form.curso} onChange={(e) => handleChange({ curso: e.target.value })}>
                      <option value="">{t("classModal.option.selectCourse")}</option>
                      {courseOptions.map((courseCode) => (
                        <option key={courseCode} value={courseCode}>{courseCode}</option>
                      ))}
                    </select>
                  ) : (
                    <input id="class-course" value={form.curso} placeholder="TI" onChange={(e) => handleChange({ curso: e.target.value })} />
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="class-name">{t("classModal.label.class")}</label>
                  <input id="class-name" value={form.turma} placeholder="11-TI-A" onChange={(e) => handleChange({ turma: e.target.value })} />
                </div>

                <div className="form-field">
                  <label htmlFor="class-supervisor">{t("classModal.label.supervisor")}</label>
                  <input id="class-supervisor" value={form.supervisor} placeholder="Professor responsável" onChange={(e) => handleChange({ supervisor: e.target.value })} />
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="pmodal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>{t("classModal.cancel")}</button>
          <button className="btn primary" type="submit" form="class-register-form">{t("classModal.save")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
