import { useState, useEffect } from "react";
import {
  createIndividualEvaluation,
  createGroupEvaluation,
  listEvaluationsByType,
  exportEvaluationsReport,
} from "../../services/evaluationService.js";
import { listTrainingAreas } from "../../services/trainingAreaService.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

/**
 * Visão TEACHER — turmas, lançamento de notas e progresso dos alunos.
 */
export default function EvalDashboardTeacher({ activeTab, t }) {
  const { authProfile } = useAuth();
  const teacherId = authProfile?.id ?? null;

  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("individual"); // individual | group

  useEffect(() => {
    listTrainingAreas().then((data) => {
      const list = data || [];
      setAreas(list);
      if (list.length > 0) setSelectedArea(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedArea) return;
    setLoading(true);
    listEvaluationsByType(selectedArea, "INDIVIDUAL")
      .then((data) => setEvaluations(data || []))
      .finally(() => setLoading(false));
  }, [selectedArea]);

  async function handleExport() {
    const data = await exportEvaluationsReport(selectedArea, "csv");
    if (data) {
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notas-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── Minhas Turmas ─────────────────────────────────────────────────────────────
  if (activeTab === "my-classes") {
    const grouped = groupBy(
      evaluations,
      (ev) => ev.class_name ?? ev.course_name ?? "Turma",
    );
    return (
      <div className="eval-view eval-view--teacher">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />

        {loading ? (
          <p className="meta">A carregar turmas…</p>
        ) : (
          <>
            {Object.keys(grouped).length === 0 ? (
              <EmptyState message="Nenhuma avaliação registada nas suas turmas." />
            ) : (
              <div className="teacher-classes">
                {Object.entries(grouped).map(([cls, items]) => {
                  const stats = computeStats(items);
                  return (
                    <div key={cls} className="class-card">
                      <div className="class-card__header">
                        <h4 className="class-card__name">{cls}</h4>
                        <span className="class-card__count">{items.length} alunos avaliados</span>
                      </div>
                      <div className="class-card__stats">
                        <span>Média: <strong>{stats.average !== null ? stats.average.toFixed(1) : "—"}</strong></span>
                        <span className="text-success">✓ {stats.approved}</span>
                        <span className="text-danger">✗ {stats.failed}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="eval-actions">
              <button className="btn secondary" onClick={handleExport}>
                ⬇ Exportar notas
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Lançar Nota ───────────────────────────────────────────────────────────────
  if (activeTab === "grade-entry") {
    return (
      <div className="eval-view eval-view--teacher">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />

        <div className="grade-entry-controls">
          <div className="toggle-group">
            <button
              className={`toggle-btn ${formType === "individual" ? "active" : ""}`}
              onClick={() => { setFormType("individual"); setShowForm(true); }}
            >
              {t ? t("evaluation.type.individual") : "Individual"}
            </button>
            <button
              className={`toggle-btn ${formType === "group" ? "active" : ""}`}
              onClick={() => { setFormType("group"); setShowForm(true); }}
            >
              {t ? t("evaluation.type.group") : "Grupo"}
            </button>
          </div>
        </div>

        {showForm && formType === "individual" && (
          <IndividualEvalForm
            trainingAreaId={selectedArea}
            teacherId={teacherId}
            onSuccess={() => {
              setShowForm(false);
              if (selectedArea) {
                listEvaluationsByType(selectedArea, "INDIVIDUAL").then((d) =>
                  setEvaluations(d || [])
                );
              }
            }}
            onCancel={() => setShowForm(false)}
            t={t}
          />
        )}

        {showForm && formType === "group" && (
          <GroupEvalForm
            trainingAreaId={selectedArea}
            teacherId={teacherId}
            onSuccess={() => {
              setShowForm(false);
              if (selectedArea) {
                listEvaluationsByType(selectedArea, "INDIVIDUAL").then((d) =>
                  setEvaluations(d || [])
                );
              }
            }}
            onCancel={() => setShowForm(false)}
            t={t}
          />
        )}

        {!showForm && (
          <p className="meta hint">
            Selecione o tipo de avaliação acima para abrir o formulário.
          </p>
        )}
      </div>
    );
  }

  // ── Progresso dos Alunos ──────────────────────────────────────────────────────
  if (activeTab === "student-progress") {
    const grouped = groupBy(
      evaluations,
      (ev) => ev.student_name ?? ev.student_id ?? "Aluno",
    );
    return (
      <div className="eval-view eval-view--teacher">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />

        {loading ? (
          <p className="meta">A carregar…</p>
        ) : Object.keys(grouped).length === 0 ? (
          <EmptyState message="Sem registos de progresso." />
        ) : (
          <div className="student-progress-list">
            {Object.entries(grouped).map(([student, items]) => {
              const stats = computeStats(items);
              const sorted = [...items].sort(
                (a, b) => new Date(a.evaluation_date) - new Date(b.evaluation_date),
              );
              return (
                <div key={student} className="progress-card">
                  <div className="progress-card__header">
                    <span className="progress-card__name">{student}</span>
                    <span className={`score-pill score-pill--${scoreCls(stats.average)}`}>
                      {stats.average !== null ? stats.average.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="progress-card__timeline">
                    {sorted.map((ev) => (
                      <span
                        key={ev.id}
                        className={`timeline-dot timeline-dot--${scoreCls(ev.score)}`}
                        title={`${new Date(ev.evaluation_date).toLocaleDateString("pt-PT")}: ${ev.score}`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Formulários ──────────────────────────────────────────────────────────────

function IndividualEvalForm({ trainingAreaId, teacherId, onSuccess, onCancel, t }) {
  const [form, setForm] = useState({
    studentId: "",
    score: "",
    feedback: "",
    evaluationDate: new Date().toISOString().split("T")[0],
    isFinal: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    if (!form.studentId.trim() || form.score === "") {
      setError("Preencha o ID do aluno e a nota.");
      return;
    }
    const score = parseFloat(form.score);
    if (Number.isNaN(score) || score < 0 || score > 20) {
      setError("A nota deve ser um valor entre 0 e 20.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createIndividualEvaluation({
      training_area_id: trainingAreaId,
      student_id: form.studentId.trim(),
      evaluator_id: teacherId,
      score,
      feedback: form.feedback,
      evaluation_date: form.evaluationDate,
      is_final: form.isFinal,
    });
    setSaving(false);
    if (result) {
      onSuccess();
    } else {
      setError("Erro ao criar avaliação. Tente novamente.");
    }
  }

  return (
    <div className="eval-form">
      <h3>{t ? t("evaluation.create") : "Criar Avaliação"} — Individual</h3>
      {error && <p className="form-error">{error}</p>}
      <div className="form-grid">
        <div className="form-field">
          <label>{t ? t("evaluation.studentId") : "ID do Aluno"}</label>
          <input
            type="text"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            placeholder="Nº processo / ID"
          />
        </div>
        <div className="form-field">
          <label>{t ? t("evaluation.score") : "Nota"}</label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
          />
        </div>
        <div className="form-field full-width">
          <label>{t ? t("evaluation.feedback") : "Feedback"}</label>
          <textarea
            value={form.feedback}
            onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            rows="3"
          />
        </div>
        <div className="form-field">
          <label>{t ? t("evaluation.date") : "Data"}</label>
          <input
            type="date"
            value={form.evaluationDate}
            onChange={(e) => setForm({ ...form, evaluationDate: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isFinal}
              onChange={(e) => setForm({ ...form, isFinal: e.target.checked })}
            />
            {t ? t("evaluation.final") : "Nota Final"}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "A guardar…" : "Guardar"}
          </button>
          <button className="btn ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupEvalForm({ trainingAreaId, teacherId, onSuccess, onCancel, t }) {
  const [form, setForm] = useState({
    subject: "",
    students: "",
    score: "",
    feedback: "",
    evaluationDate: new Date().toISOString().split("T")[0],
    isFinal: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit() {
    const studentIds = form.students
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (studentIds.length === 0 || form.score === "") {
      setError("Indique pelo menos um aluno e a nota.");
      return;
    }
    const score = parseFloat(form.score);
    if (Number.isNaN(score) || score < 0 || score > 20) {
      setError("A nota deve ser um valor entre 0 e 20.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createGroupEvaluation({
      training_area_id: trainingAreaId,
      evaluatorId: teacherId,
      subject: form.subject,
      score,
      feedback: form.feedback,
      studentIds,
      evaluationDate: form.evaluationDate,
      isFinal: form.isFinal,
    });
    setSaving(false);
    if (result && result.length > 0) {
      onSuccess();
    } else {
      setError("Erro ao criar avaliação de grupo. Tente novamente.");
    }
  }

  return (
    <div className="eval-form">
      <h3>{t ? t("evaluation.create") : "Criar Avaliação"} — Grupo</h3>
      {error && <p className="form-error">{error}</p>}
      <div className="form-grid">
        <div className="form-field full-width">
          <label>Disciplina / Tema</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Nome da disciplina ou trabalho"
          />
        </div>
        <div className="form-field full-width">
          <label>Alunos (IDs separados por vírgula)</label>
          <input
            type="text"
            value={form.students}
            onChange={(e) => setForm({ ...form, students: e.target.value })}
            placeholder="A001, A002, A003"
          />
        </div>
        <div className="form-field">
          <label>{t ? t("evaluation.score") : "Nota"}</label>
          <input
            type="number"
            min="0"
            max="20"
            step="0.5"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
          />
        </div>
        <div className="form-field full-width">
          <label>{t ? t("evaluation.feedback") : "Feedback"}</label>
          <textarea
            value={form.feedback}
            onChange={(e) => setForm({ ...form, feedback: e.target.value })}
            rows="3"
          />
        </div>
        <div className="form-field">
          <label>{t ? t("evaluation.date") : "Data"}</label>
          <input
            type="date"
            value={form.evaluationDate}
            onChange={(e) => setForm({ ...form, evaluationDate: e.target.value })}
          />
        </div>
        <div className="form-field">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.isFinal}
              onChange={(e) => setForm({ ...form, isFinal: e.target.checked })}
            />
            {t ? t("evaluation.final") : "Nota Final"}
          </label>
        </div>
        <div className="form-actions">
          <button className="btn primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "A guardar…" : "Guardar para grupo"}
          </button>
          <button className="btn ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function AreaSelector({ areas, selected, onChange, t }) {
  if (areas.length === 0) return null;
  return (
    <div className="eval-filters">
      <div className="filter-group">
        <label className="filter-label">{t ? t("evaluation.selectArea") : "Área"}</label>
        <select
          className="filter-select"
          value={selected || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="eval-empty-state">
      <p className="meta">{message}</p>
    </div>
  );
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function computeStats(list) {
  if (!list || list.length === 0) return { total: 0, average: null, approved: 0, failed: 0 };
  const scores = list.map((e) => Number(e.score)).filter((s) => !Number.isNaN(s));
  const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return {
    total: list.length,
    average,
    approved: scores.filter((s) => s >= 10).length,
    failed: scores.filter((s) => s < 10).length,
  };
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function scoreCls(score) {
  if (score == null) return "unknown";
  const n = Number(score);
  if (n >= 18) return "excellent";
  if (n >= 14) return "good";
  if (n >= 10) return "pass";
  return "fail";
}
