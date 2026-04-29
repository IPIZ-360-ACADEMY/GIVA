import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  createIndividualEvaluation,
  createGroupEvaluation,
  getStudentEvaluations,
  getStudentAverageGrade,
  listEvaluationsByType,
  exportEvaluationsReport,
} from "../services/evaluationService.js";
import { listTrainingAreas, listCoursesByArea } from "../services/trainingAreaService.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";

export default function EvaluationsPage() {
  const { t } = useOutletContext();
  const { authProfile } = useAuth();
  const userRole = authProfile?.role ?? authProfile?.role_name ?? null;
  const [activeTab, setActiveTab] = useState("individual");
  const [trainingAreas, setTrainingAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadTrainingAreas();
  }, []);

  useEffect(() => {
    if (selectedArea) {
      loadEvaluations();
    }
  }, [selectedArea, activeTab]);

  async function loadTrainingAreas() {
    const areas = await listTrainingAreas();
    setTrainingAreas(areas || []);
    if (areas && areas.length > 0) {
      setSelectedArea(areas[0].id);
    }
    setLoading(false);
  }

  async function loadEvaluations() {
    const evals = await listEvaluationsByType(selectedArea, activeTab.toUpperCase());
    setEvaluations(evals || []);
  }

  async function handleExport() {
    const data = await exportEvaluationsReport(selectedArea, "csv");
    if (data) {
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avaliacoes-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    }
  }

  return (
    <main className="page page-evaluations">
      <PageHeader
        title={t("evaluations.title")}
        description={t("evaluations.description")}
      />

      {/* Area Selection */}
      <div className="area-selector">
        <label>{t("evaluation.selectArea")}</label>
        <select
          value={selectedArea || ""}
          onChange={(e) => setSelectedArea(e.target.value)}
        >
          {trainingAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="eval-tabs">
        <button
          className={`tab ${activeTab === "individual" ? "active" : ""}`}
          onClick={() => setActiveTab("individual")}
        >
          {t("evaluation.type.individual")}
        </button>
        <button
          className={`tab ${activeTab === "group" ? "active" : ""}`}
          onClick={() => setActiveTab("group")}
        >
          {t("evaluation.type.group")}
        </button>
      </div>

      {/* Actions */}
      <div className="eval-actions">
        {userRole === "PROFESSOR" && (
          <button className="btn primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : `${t("evaluation.create")} (${activeTab})`}
          </button>
        )}
        <button className="btn secondary" onClick={handleExport}>
          {t("evaluation.export")}
        </button>
      </div>

      {/* Form (for Professor only) */}
      {showForm && userRole === "PROFESSOR" && (
        <>
          {activeTab === "individual" ? (
            <IndividualEvalForm
              trainingAreaId={selectedArea}
              onSuccess={() => {
                setShowForm(false);
                loadEvaluations();
              }}
              t={t}
            />
          ) : (
            <GroupEvalForm
              trainingAreaId={selectedArea}
              onSuccess={() => {
                setShowForm(false);
                loadEvaluations();
              }}
              t={t}
            />
          )}
        </>
      )}

      {/* List */}
      <div className="evaluations-list">
        {loading ? (
          <p className="meta">A carregar...</p>
        ) : evaluations.length === 0 ? (
          <p className="meta">{t("common.noData")}</p>
        ) : (
          evaluations.map((eval_) => (
            <div key={eval_.id} className="eval-card">
              <div className="eval-header">
                <h4>{eval_.subject || eval_.student_name}</h4>
                <span className="eval-date">
                  {new Date(eval_.evaluation_date).toLocaleDateString("pt-PT")}
                </span>
              </div>
              <div className="eval-score">
                <span className="score-value">{eval_.score}</span>
                <span className="score-label">/ 20</span>
              </div>
              {eval_.feedback && (
                <p className="feedback">{eval_.feedback}</p>
              )}
              {eval_.isFinal && (
                <span className="badge final">{t("evaluation.final")}</span>
              )}
            </div>
          ))
        )}
      </div>

    </main>
  );
}

// Individual Evaluation Form
function IndividualEvalForm({ trainingAreaId, onSuccess, t }) {
  const [formData, setFormData] = useState({
    studentId: "",
    score: "",
    feedback: "",
    evaluationDate: new Date().toISOString().split("T")[0],
    isFinal: false,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    const result = await createIndividualEvaluation({
      training_area_id: trainingAreaId,
      student_id: formData.studentId,
      score: parseFloat(formData.score),
      feedback: formData.feedback,
      evaluation_date: formData.evaluationDate,
      is_final: formData.isFinal,
    });
    setLoading(false);
    if (result) {
      setFormData({
        studentId: "",
        score: "",
        feedback: "",
        evaluationDate: new Date().toISOString().split("T")[0],
        isFinal: false,
      });
      onSuccess();
    }
  }

  return (
    <div className="eval-form">
      <h3>{t("evaluation.create")} - {t("evaluation.type.individual")}</h3>
      <div className="form-grid">
        <div className="form-field">
          <label>{t("evaluation.studentId")}</label>
          <input
            type="text"
            value={formData.studentId}
            onChange={(e) =>
              setFormData({ ...formData, studentId: e.target.value })
            }
            placeholder="ID do aluno"
          />
        </div>
        <div className="form-field">
          <label>{t("evaluation.score")}</label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={formData.score}
            onChange={(e) =>
              setFormData({ ...formData, score: e.target.value })
            }
          />
        </div>
        <div className="form-field full-width">
          <label>{t("evaluation.feedback")}</label>
          <textarea
            value={formData.feedback}
            onChange={(e) =>
              setFormData({ ...formData, feedback: e.target.value })
            }
            rows="3"
          />
        </div>
        <div className="form-field">
          <label>{t("evaluation.date")}</label>
          <input
            type="date"
            value={formData.evaluationDate}
            onChange={(e) =>
              setFormData({ ...formData, evaluationDate: e.target.value })
            }
          />
        </div>
        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={formData.isFinal}
              onChange={(e) =>
                setFormData({ ...formData, isFinal: e.target.checked })
              }
            />
            {t("evaluation.final")}
          </label>
        </div>
        <button className="btn primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "A criar..." : "Criar avaliação"}
        </button>
      </div>

    </div>
  );
}

// Group Evaluation Form
function GroupEvalForm({ trainingAreaId, onSuccess, t }) {
  const [formData, setFormData] = useState({
    subject: "",
    students: "",
    score: "",
    feedback: "",
    evaluationDate: new Date().toISOString().split("T")[0],
    isFinal: false,
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const studentIds = formData.students
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);

    setLoading(true);
    const result = await createGroupEvaluation({
      training_area_id: trainingAreaId,
      subject: formData.subject,
      score: parseFloat(formData.score),
      feedback: formData.feedback,
      student_ids: studentIds,
      evaluation_date: formData.evaluationDate,
      is_final: formData.isFinal,
    });
    setLoading(false);
    if (result) {
      setFormData({
        subject: "",
        students: "",
        score: "",
        feedback: "",
        evaluationDate: new Date().toISOString().split("T")[0],
        isFinal: false,
      });
      onSuccess();
    }
  }

  return (
    <div className="eval-form">
      <h3>{t("evaluation.create")} - {t("evaluation.type.group")}</h3>
      <div className="form-grid">
        <div className="form-field full-width">
          <label>{t("evaluation.subject")}</label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
            placeholder="Assunto / Título da avaliação"
          />
        </div>
        <div className="form-field full-width">
          <label>{t("evaluation.studentIds")}</label>
          <textarea
            value={formData.students}
            onChange={(e) =>
              setFormData({ ...formData, students: e.target.value })
            }
            rows="3"
            placeholder="IDs dos alunos separados por vírgula (ex: 1, 2, 3)"
          />
        </div>
        <div className="form-field">
          <label>{t("evaluation.score")}</label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={formData.score}
            onChange={(e) =>
              setFormData({ ...formData, score: e.target.value })
            }
          />
        </div>
        <div className="form-field full-width">
          <label>{t("evaluation.feedback")}</label>
          <textarea
            value={formData.feedback}
            onChange={(e) =>
              setFormData({ ...formData, feedback: e.target.value })
            }
            rows="3"
          />
        </div>
        <div className="form-field">
          <label>{t("evaluation.date")}</label>
          <input
            type="date"
            value={formData.evaluationDate}
            onChange={(e) =>
              setFormData({ ...formData, evaluationDate: e.target.value })
            }
          />
        </div>
        <div className="form-field">
          <label>
            <input
              type="checkbox"
              checked={formData.isFinal}
              onChange={(e) =>
                setFormData({ ...formData, isFinal: e.target.checked })
              }
            />
            {t("evaluation.final")}
          </label>
        </div>
        <button className="btn primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "A criar..." : "Criar avaliação de grupo"}
        </button>
      </div>

    </div>
  );
}
