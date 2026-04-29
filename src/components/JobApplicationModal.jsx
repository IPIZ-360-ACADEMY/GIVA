import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  submitJobApplication,
  listPartnerApplications,
  acceptJobApplication,
  rejectJobApplication,
} from "../services/jobApplicationService.js";
import { listPartnerVacancies } from "../services/vacanciesService.js";

export default function JobApplicationModal({
  studentId,
  partnerId,
  applicationId,
  onClose,
  onSuccess,
  t,
  mode = "student", // 'student' (apply) or 'company' (review)
  existingApplications = [],
}) {
  const [loading, setLoading] = useState(false);
  const [applications, setApplications] = useState([]);
  const [vacancies, setVacancies] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [acceptanceNotes, setAcceptanceNotes] = useState("");

  useEffect(() => {
    if (mode === "company" && partnerId) {
      loadPartnerApplications();
    }
    if (mode === "student" && partnerId) {
      loadPartnerVacancies();
    }
  }, [mode, partnerId]);

  async function loadPartnerVacancies() {
    setLoading(true);
    const rows = await listPartnerVacancies(partnerId, { includeClosed: false });
    setVacancies(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }

  async function loadPartnerApplications() {
    setLoading(true);
    const data = await listPartnerApplications(partnerId);
    const rows = Array.isArray(data) ? data : [];
    setApplications(applicationId ? rows.filter((app) => app.id === applicationId) : rows);
    setLoading(false);
  }

  async function handleSubmitApplication(vacancyId) {
    setLoading(true);
    const result = await submitJobApplication(studentId, partnerId, vacancyId);
    setLoading(false);

    if (result) {
      if (onSuccess) onSuccess(result);
      onClose();
    }
  }

  async function handleAccept(appId) {
    setLoading(true);
    const result = await acceptJobApplication(appId, acceptanceNotes);
    setLoading(false);

    if (result) {
      setApplications(
        applications.map((app) =>
          app.id === appId ? { ...app, status: "ACCEPTED" } : app
        )
      );
      setSelectedApp(null);
      setAcceptanceNotes("");
      if (onSuccess) onSuccess(result);
    }
  }

  async function handleReject(appId) {
    setLoading(true);
    const result = await rejectJobApplication(appId, rejectionReason);
    setLoading(false);

    if (result) {
      setApplications(
        applications.map((app) =>
          app.id === appId ? { ...app, status: "REJECTED" } : app
        )
      );
      setSelectedApp(null);
      setRejectionReason("");
      if (onSuccess) onSuccess(result);
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
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

  const modalTitle =
    mode === "student"
      ? t("application.title")
      : t("progressCompany.title");

  return createPortal(
    <div className="pmodal-layer" role="presentation">
      <div className="pmodal-overlay" onClick={onClose} aria-hidden="true" />

      <div
        className="pmodal"
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
      >
        <div className="pmodal-header">
          <span className="material-icons-sharp pmodal-icon" aria-hidden="true">
            work
          </span>
          <h3>{modalTitle}</h3>
          <button
            className="smodal-close"
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <div className="pmodal-body">
          {mode === "student" ? (
            <div className="application-student-view">
              <p className="meta">Selecione uma vaga publicada para submeter a candidatura.</p>
              {loading ? (
                <p className="meta loading-state">A carregar vagas...</p>
              ) : vacancies.length === 0 ? (
                <p className="meta">Sem vagas abertas para esta empresa.</p>
              ) : (
                <div className="applications-list">
                  {vacancies.map((vacancy) => {
                    const hasApplied = existingApplications.some(
                      (app) => app.vacancy_id === vacancy.id || (!app.vacancy_id && app.partner_id === partnerId)
                    );
                    const openSlots = Math.max(0, Number(vacancy.available_slots ?? 0));

                    return (
                      <div key={vacancy.id} className="application-item">
                        <div className="app-header">
                          <div className="student-info">
                            <h4>{vacancy.title}</h4>
                            <small className="meta">Vagas disponíveis: {openSlots}</small>
                          </div>
                        </div>
                        {vacancy.description && <p className="meta">{vacancy.description}</p>}
                        <button
                          className="btn primary"
                          onClick={() => handleSubmitApplication(vacancy.id)}
                          disabled={loading || hasApplied || openSlots <= 0}
                        >
                          {hasApplied ? "Já candidatado" : openSlots <= 0 ? "Sem vagas" : t("application.submit")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="application-company-view">
              {loading ? (
                <p className="meta loading-state">A carregar candidaturas...</p>
              ) : applications.length === 0 ? (
                <p className="meta">Nenhuma candidatura recebida.</p>
              ) : (
                <div className="applications-list">
                  {applications.map((app) => (
                    <div key={app.id} className="application-item">
                      <div className="app-header">
                        <div className="student-info">
                          <h4>{app.student?.full_name}</h4>
                          <small className="meta">{app.student?.email}</small>
                          {app.vacancy?.title && (
                            <small className="meta">Vaga: {app.vacancy.title}</small>
                          )}
                        </div>
                        <span className={`app-status status-${app.status.toLowerCase()}`}>
                          {t(`application.status.${app.status.toLowerCase()}`)}
                        </span>
                      </div>

                      <small className="meta">
                        {t("application.appliedAt")}:{" "}
                        {new Date(app.applied_at).toLocaleDateString("pt-PT")}
                      </small>

                      {selectedApp?.id === app.id && app.status === "PENDING" && (
                        <div className="app-actions">
                          <div className="form-field">
                            <label>{t("application.acceptanceNotes")}</label>
                            <textarea
                              value={acceptanceNotes}
                              onChange={(e) => setAcceptanceNotes(e.target.value)}
                              placeholder="Notas opcionais..."
                              rows="3"
                            />
                          </div>
                          <div className="form-actions">
                            <button
                              className="btn ghost"
                              onClick={() => handleReject(app.id)}
                              disabled={loading}
                            >
                              {t("common.reject")}
                            </button>
                            <button
                              className="btn primary"
                              onClick={() => handleAccept(app.id)}
                              disabled={loading}
                            >
                              {loading
                                ? "A processar..."
                                : t("application.status.accepted")}
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedApp?.id !== app.id && app.status === "PENDING" && (
                        <button
                          className="btn secondary small"
                          onClick={() => setSelectedApp(app)}
                        >
                          {t("common.review")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pmodal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
