import { useEffect, useState } from "react";
import {
  getCompanyProgress,
  updateInterviewPhase,
  updateInternshipPhase,
  updateContractPhase,
  addMutualAssessment,
  completeProgress,
  terminateProgress,
} from "../services/companyProgressService.js";

function toLocalIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CompanyProgressTimeline({
  studentId,
  partnerId,
  t,
  isCompanyView = false,
}) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadProgress();
  }, [studentId, partnerId]);

  async function loadProgress() {
    setLoading(true);
    const data = await getCompanyProgress(studentId, partnerId);
    setProgress(data);
    if (data) setActivePhase(data.progression_stage);
    setLoading(false);
  }

  const stages = [
    { key: "INTERVIEW", label: t("progressCompany.stage.interview") },
    { key: "INTERNSHIP", label: t("progressCompany.stage.internship") },
    {
      key: "FIXED_TERM_CONTRACT",
      label: t("progressCompany.stage.fixedTermContract"),
    },
    {
      key: "PERMANENT_CONTRACT",
      label: t("progressCompany.stage.permanentContract"),
    },
    { key: "COMPLETED", label: t("progressCompany.stage.completed") },
  ];

  if (!progress) {
    return (
      <div className="company-progress-empty">
        <p className="meta">{t("common.noData")}</p>
      </div>
    );
  }

  return (
    <div className="company-progress-timeline">
      {/* Timeline stages */}
      <div className="timeline-container">
        <div className="timeline-track">
          {stages.map((stage, index) => {
            const isActive =
              activePhase === stage.key ||
              (activePhase === "TERMINATED" && index === 0);
            const isCompleted =
              stages.findIndex((s) => s.key === activePhase) > index ||
              activePhase === "COMPLETED";

            return (
              <div key={stage.key} className="timeline-stage">
                <div
                  className={`timeline-dot ${
                    isCompleted ? "completed" : isActive ? "active" : ""
                  }`}
                />
                <label className="timeline-label">{stage.label}</label>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current phase details */}
      {activePhase === "INTERVIEW" && (
        <InterviewPhasePanel
          progress={progress}
          onUpdate={loadProgress}
          t={t}
          isCompanyView={isCompanyView}
        />
      )}

      {activePhase === "INTERNSHIP" && (
        <InternshipPhasePanel
          progress={progress}
          onUpdate={loadProgress}
          t={t}
          isCompanyView={isCompanyView}
        />
      )}

      {(activePhase === "FIXED_TERM_CONTRACT" ||
        activePhase === "PERMANENT_CONTRACT") && (
        <ContractPhasePanel
          progress={progress}
          onUpdate={loadProgress}
          t={t}
          isCompanyView={isCompanyView}
        />
      )}

      {activePhase === "COMPLETED" && (
        <div className="phase-completion">
          <p className="success">
            {t("common.completed")} em{" "}
            {new Date(progress.updated_at).toLocaleDateString("pt-PT")}
          </p>
        </div>
      )}
    </div>
  );
}

// Interview Phase Component
function InterviewPhasePanel({ progress, onUpdate, t, isCompanyView }) {
  const [formData, setFormData] = useState({
    date: progress.interview_date || "",
    result: progress.interview_result || "",
    notes: progress.interview_notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const minDate = toLocalIsoDate();

  async function handleSubmit() {
    if (formData.date && formData.date < minDate) {
      setError(t("progressCompany.validation.noPastDate"));
      return;
    }

    setError("");
    setLoading(true);
    const result = await updateInterviewPhase(progress.id, formData);
    setLoading(false);
    if (result) onUpdate();
  }

  return (
    <div className="phase-panel">
      <h4>{t("progressCompany.stage.interview")}</h4>
      {isCompanyView ? (
        <>
          <div className="form-field">
            <label>{t("progressCompany.interview.date")}</label>
            <input
              type="date"
              min={minDate}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label>{t("progressCompany.interview.result")}</label>
            <select
              value={formData.result}
              onChange={(e) =>
                setFormData({ ...formData, result: e.target.value })
              }
            >
              <option value="">Selecionar resultado</option>
              <option value="ACCEPTED">
                {t("progressCompany.interview.accepted")}
              </option>
              <option value="REJECTED">
                {t("progressCompany.interview.rejected")}
              </option>
            </select>
          </div>
          <div className="form-field">
            <label>{t("progressCompany.interview.notes")}</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="4"
            />
          </div>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "A processar..."
              : t("progressCompany.update")}
          </button>
          {error && <p className="tools-error">{error}</p>}
        </>
      ) : (
        <>
          <p>
            <strong>{t("progressCompany.interview.date")}:</strong>{" "}
            {progress.interview_date
              ? new Date(progress.interview_date).toLocaleDateString("pt-PT")
              : "Pendente"}
          </p>
          <p>
            <strong>{t("progressCompany.interview.result")}:</strong>{" "}
            {progress.interview_result || "Aguardando resultado"}
          </p>
          {progress.interview_notes && (
            <p>
              <strong>{t("progressCompany.interview.notes")}:</strong>{" "}
              {progress.interview_notes}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Internship Phase Component
function InternshipPhasePanel({ progress, onUpdate, t, isCompanyView }) {
  const [formData, setFormData] = useState({
    startDate: progress.internship_start_date || "",
    endDate: progress.internship_end_date || "",
    hasCompensation: progress.internship_has_compensation || false,
    compensationAmount: progress.internship_compensation_amount || "",
    durationMonths: progress.internship_duration_months || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const minDate = toLocalIsoDate();

  async function handleSubmit() {
    if (formData.startDate && formData.startDate < minDate) {
      setError(t("progressCompany.validation.noPastDate"));
      return;
    }

    if (formData.endDate && formData.endDate < minDate) {
      setError(t("progressCompany.validation.noPastDate"));
      return;
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      setError(t("progressCompany.validation.endBeforeStart"));
      return;
    }

    setError("");
    setLoading(true);
    const result = await updateInternshipPhase(progress.id, formData);
    setLoading(false);
    if (result) onUpdate();
  }

  return (
    <div className="phase-panel">
      <h4>{t("progressCompany.stage.internship")}</h4>
      {isCompanyView ? (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>{t("progressCompany.internship.startDate")}</label>
              <input
                type="date"
                min={minDate}
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>{t("progressCompany.internship.endDate")}</label>
              <input
                type="date"
                min={formData.startDate || minDate}
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>
                <input
                  type="checkbox"
                  checked={formData.hasCompensation}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      hasCompensation: e.target.checked,
                    })
                  }
                />
                {t("progressCompany.internship.hasCompensation")}
              </label>
            </div>
            {formData.hasCompensation && (
              <div className="form-field">
                <label>{t("progressCompany.internship.amount")}</label>
                <input
                  type="number"
                  value={formData.compensationAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      compensationAmount: e.target.value,
                    })
                  }
                />
              </div>
            )}
            <div className="form-field">
              <label>{t("progressCompany.internship.duration")}</label>
              <input
                type="number"
                value={formData.durationMonths}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    durationMonths: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "A processar..."
              : t("progressCompany.update")}
          </button>
          {error && <p className="tools-error">{error}</p>}
        </>
      ) : (
        <>
          <p>
            <strong>{t("progressCompany.internship.startDate")}:</strong>{" "}
            {progress.internship_start_date
              ? new Date(progress.internship_start_date).toLocaleDateString(
                  "pt-PT"
                )
              : "Pendente"}
          </p>
          <p>
            <strong>{t("progressCompany.internship.endDate")}:</strong>{" "}
            {progress.internship_end_date
              ? new Date(progress.internship_end_date).toLocaleDateString(
                  "pt-PT"
                )
              : "Pendente"}
          </p>
          {progress.internship_has_compensation && (
            <p>
              <strong>{t("progressCompany.internship.amount")}:</strong> €
              {progress.internship_compensation_amount}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// Contract Phase Component
function ContractPhasePanel({ progress, onUpdate, t, isCompanyView }) {
  const [formData, setFormData] = useState({
    contractType: progress.contract_type || "",
    startDate: progress.contract_start_date || "",
    endDate: progress.contract_end_date || "",
    salary: progress.contract_salary || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const minDate = toLocalIsoDate();

  async function handleSubmit() {
    if (formData.startDate && formData.startDate < minDate) {
      setError(t("progressCompany.validation.noPastDate"));
      return;
    }

    if (formData.endDate && formData.endDate < minDate) {
      setError(t("progressCompany.validation.noPastDate"));
      return;
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      setError(t("progressCompany.validation.endBeforeStart"));
      return;
    }

    setError("");
    setLoading(true);
    const result = await updateContractPhase(progress.id, formData);
    setLoading(false);
    if (result) onUpdate();
  }

  async function handleCompleteFlow() {
    setFinalizing(true);
    const result = await completeProgress(progress.id);
    setFinalizing(false);
    if (result) onUpdate();
  }

  async function handleTerminateFlow() {
    const reason = window.prompt("Motivo de encerramento do processo:", "");
    if (reason === null) return;
    setTerminating(true);
    const result = await terminateProgress(progress.id, reason || "Processo encerrado pela empresa");
    setTerminating(false);
    if (result) onUpdate();
  }

  return (
    <div className="phase-panel">
      <h4>{t("progressCompany.contract.type")}</h4>
      {isCompanyView ? (
        <>
          <div className="form-grid">
            <div className="form-field">
              <label>{t("progressCompany.contract.type")}</label>
              <select
                value={formData.contractType}
                onChange={(e) =>
                  setFormData({ ...formData, contractType: e.target.value })
                }
              >
                <option value="">Selecionar tipo</option>
                <option value="FIXED_TERM">
                  {t("progressCompany.contract.fixedTerm")}
                </option>
                <option value="PERMANENT">
                  {t("progressCompany.contract.permanent")}
                </option>
              </select>
            </div>
            <div className="form-field">
              <label>{t("progressCompany.contract.salary")}</label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) =>
                  setFormData({ ...formData, salary: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>{t("progressCompany.internship.startDate")}</label>
              <input
                type="date"
                min={minDate}
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
              />
            </div>
            {formData.contractType === "FIXED_TERM" && (
              <div className="form-field">
                <label>{t("progressCompany.internship.endDate")}</label>
                <input
                  type="date"
                  min={formData.startDate || minDate}
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "A processar..."
              : t("progressCompany.update")}
          </button>
          {error && <p className="tools-error">{error}</p>}
          <div className="form-actions" style={{ marginTop: "0.75rem" }}>
            <button className="btn primary" onClick={handleCompleteFlow} disabled={finalizing || terminating}>
              {finalizing ? "A concluir..." : "Marcar como concluído"}
            </button>
            <button className="btn ghost" onClick={handleTerminateFlow} disabled={terminating || finalizing}>
              {terminating ? "A encerrar..." : "Encerrar processo"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            <strong>{t("progressCompany.contract.type")}:</strong>{" "}
            {progress.contract_type || "Pendente"}
          </p>
          <p>
            <strong>{t("progressCompany.contract.salary")}:</strong> €
            {progress.contract_salary || "0.00"}
          </p>
        </>
      )}
    </div>
  );
}
