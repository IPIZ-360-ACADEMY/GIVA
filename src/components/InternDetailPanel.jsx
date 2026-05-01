import { useState, useEffect, useCallback } from "react";
import {
  listFollowupLogs,
  createFollowupLog,
  updateFollowupLog,
  deleteFollowupLog,
  calcAttendanceStats,
  calcAvgPerformance,
  getRatingLabel,
  listObjectives,
  createObjective,
  updateObjective,
  deleteObjective,
  listEvaluations,
  upsertEvaluation,
  RECOMMENDATION_LABELS,
} from "../services/internFollowupService.js";
import { getCompanyProgress } from "../services/companyProgressService.js";
import CompanyProgressTimeline from "./CompanyProgressTimeline.jsx";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BLANK_LOG = {
  period_start: "",
  period_end: "",
  attendance_present: "",
  attendance_absent: "",
  attendance_justified: "",
  activities: "",
  supervisor_notes: "",
  performance_rating: "",
};

const BLANK_OBJ = { description: "", target_date: "", achieved: false, achievement_notes: "" };

const BLANK_EVAL = {
  eval_type: "MIDTERM",
  eval_date: new Date().toISOString().slice(0, 10),
  rating_punctuality: "",
  rating_initiative: "",
  rating_teamwork: "",
  rating_technical: "",
  rating_communication: "",
  general_comments: "",
  recommendation: "",
  signed_by_company: false,
  signed_by_student: false,
};

function StarRating({ value, onChange, disabled }) {
  return (
    <span style={{ display: "inline-flex", gap: "0.1rem" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          aria-label={`${s} estrelas`}
          disabled={disabled}
          onClick={() => onChange && onChange(s)}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "default" : "pointer",
            fontSize: "1.3rem",
            color: s <= (value || 0) ? "#f59e0b" : "#d1d5db",
            padding: "0 1px",
          }}
        >
          ★
        </button>
      ))}
    </span>
  );
}

function AttendanceBadge({ pct }) {
  if (pct === null) return <span style={{ opacity: 0.5 }}>—</span>;
  const color = pct >= 80 ? "#166534" : pct >= 60 ? "#92400e" : "#b91c1c";
  const bg = pct >= 80 ? "#dcfce7" : pct >= 60 ? "#fef3c7" : "#fee2e2";
  return (
    <span style={{ fontSize: "0.8rem", fontWeight: 700, background: bg, color, borderRadius: 999, padding: "0.15rem 0.55rem" }}>
      {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-painel: Diário de Acompanhamento
// ---------------------------------------------------------------------------

function FollowupLogsPanel({ progressId, partnerId, studentId, disabled }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_LOG);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await listFollowupLogs(progressId);
    setLogs(rows);
    setLoading(false);
  }, [progressId]);

  useEffect(() => { reload(); }, [reload]);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function startNew() {
    setForm(BLANK_LOG);
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function startEdit(log) {
    setForm({
      period_start: log.period_start ?? "",
      period_end: log.period_end ?? "",
      attendance_present: log.attendance_present ?? "",
      attendance_absent: log.attendance_absent ?? "",
      attendance_justified: log.attendance_justified ?? "",
      activities: log.activities ?? "",
      supervisor_notes: log.supervisor_notes ?? "",
      performance_rating: log.performance_rating ?? "",
    });
    setEditingId(log.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!form.period_start || !form.period_end) {
      setError("Preencha o período de início e fim.");
      return;
    }
    if (form.period_end < form.period_start) {
      setError("A data de fim não pode ser anterior à data de início.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      company_progress_id: progressId,
      partner_id: partnerId,
      student_id: studentId,
      period_start: form.period_start,
      period_end: form.period_end,
      attendance_present: Number(form.attendance_present) || 0,
      attendance_absent: Number(form.attendance_absent) || 0,
      attendance_justified: Number(form.attendance_justified) || 0,
      activities: form.activities || null,
      supervisor_notes: form.supervisor_notes || null,
      performance_rating: form.performance_rating ? Number(form.performance_rating) : null,
    };
    const result = editingId
      ? await updateFollowupLog(editingId, payload)
      : await createFollowupLog(payload);
    setSaving(false);
    if (!result) { setError("Não foi possível guardar o registo."); return; }
    setShowForm(false);
    setEditingId(null);
    setForm(BLANK_LOG);
    reload();
  }

  async function handleDelete(id) {
    if (!window.confirm("Apagar este registo de acompanhamento?")) return;
    await deleteFollowupLog(id);
    reload();
  }

  const stats = calcAttendanceStats(logs);
  const avgPerf = calcAvgPerformance(logs);

  return (
    <div>
      {/* Resumo */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div className="kpi-mini">
          <strong>{stats.present}</strong><span>Dias presentes</span>
        </div>
        <div className="kpi-mini">
          <strong>{stats.absent}</strong><span>Faltas</span>
        </div>
        <div className="kpi-mini">
          <strong>{stats.justified}</strong><span>Justificadas</span>
        </div>
        <div className="kpi-mini">
          <AttendanceBadge pct={stats.pct} />
          <span>Taxa presença</span>
        </div>
        <div className="kpi-mini">
          <strong>{avgPerf != null ? `${avgPerf}/5` : "—"}</strong>
          <span>Desempenho médio</span>
        </div>
      </div>

      {!disabled && (
        <button className="btn primary" style={{ marginBottom: "0.85rem" }} onClick={startNew}>
          + Adicionar registo semanal
        </button>
      )}

      {showForm && (
        <div className="panel-card" style={{ padding: "1rem", marginBottom: "1rem", border: "1px solid var(--accent-color, #3b82f6)" }}>
          <h4 style={{ margin: "0 0 0.75rem" }}>{editingId ? "Editar registo" : "Novo registo semanal"}</h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Período — início *</label>
              <input type="date" value={form.period_start} onChange={(e) => setField("period_start", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Período — fim *</label>
              <input type="date" value={form.period_end} min={form.period_start} onChange={(e) => setField("period_end", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Dias presentes</label>
              <input type="number" min="0" value={form.attendance_present} onChange={(e) => setField("attendance_present", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Faltas</label>
              <input type="number" min="0" value={form.attendance_absent} onChange={(e) => setField("attendance_absent", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Faltas justificadas</label>
              <input type="number" min="0" value={form.attendance_justified} onChange={(e) => setField("attendance_justified", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Desempenho semanal</label>
              <StarRating value={Number(form.performance_rating)} onChange={(v) => setField("performance_rating", v)} />
              {form.performance_rating ? <small style={{ marginLeft: "0.4rem", opacity: 0.75 }}>{getRatingLabel(Number(form.performance_rating))}</small> : null}
            </div>
            <div className="form-field tools-form-full">
              <label>Actividades realizadas</label>
              <textarea rows={3} value={form.activities} onChange={(e) => setField("activities", e.target.value)} placeholder="Descreva as actividades da semana..." />
            </div>
            <div className="form-field tools-form-full">
              <label>Notas do supervisor</label>
              <textarea rows={2} value={form.supervisor_notes} onChange={(e) => setField("supervisor_notes", e.target.value)} placeholder="Observações e feedback..." />
            </div>
          </div>
          {error && <p className="tools-error">{error}</p>}
          <div style={{ display: "flex", gap: "0.65rem", marginTop: "0.65rem" }}>
            <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</button>
            <button className="btn ghost" onClick={() => { setShowForm(false); setError(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ opacity: 0.6 }}>A carregar registos...</p>
      ) : logs.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Sem registos de acompanhamento ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {logs.map((log) => (
            <div key={log.id} style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 8, padding: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.9rem" }}>
                  {new Date(log.period_start).toLocaleDateString("pt-AO")} → {new Date(log.period_end).toLocaleDateString("pt-AO")}
                </strong>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                    ✓ {log.attendance_present} · ✗ {log.attendance_absent} · J {log.attendance_justified}
                  </span>
                  {log.performance_rating && (
                    <span style={{ fontSize: "0.8rem", color: "#f59e0b", fontWeight: 600 }}>
                      {"★".repeat(log.performance_rating)} {getRatingLabel(log.performance_rating)}
                    </span>
                  )}
                  {!disabled && (
                    <>
                      <button className="btn ghost btn-sm" onClick={() => startEdit(log)}>Editar</button>
                      <button className="btn ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => handleDelete(log.id)}>Apagar</button>
                    </>
                  )}
                </div>
              </div>
              {log.activities && <p style={{ margin: "0.4rem 0 0", fontSize: "0.875rem" }}><strong>Actividades:</strong> {log.activities}</p>}
              {log.supervisor_notes && <p style={{ margin: "0.3rem 0 0", fontSize: "0.875rem", opacity: 0.8 }}><strong>Supervisor:</strong> {log.supervisor_notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-painel: Objectivos
// ---------------------------------------------------------------------------

function ObjectivesPanel({ progressId, partnerId, studentId, disabled }) {
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_OBJ);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await listObjectives(progressId);
    setObjectives(rows);
    setLoading(false);
  }, [progressId]);

  useEffect(() => { reload(); }, [reload]);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function startNew() { setForm(BLANK_OBJ); setEditingId(null); setShowForm(true); setError(""); }

  function startEdit(obj) {
    setForm({
      description: obj.description ?? "",
      target_date: obj.target_date ?? "",
      achieved: obj.achieved ?? false,
      achievement_notes: obj.achievement_notes ?? "",
    });
    setEditingId(obj.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!form.description.trim()) { setError("Descrição obrigatória."); return; }
    setSaving(true);
    setError("");
    const payload = {
      company_progress_id: progressId,
      partner_id: partnerId,
      student_id: studentId,
      description: form.description.trim(),
      target_date: form.target_date || null,
      achieved: form.achieved,
      achievement_notes: form.achievement_notes || null,
    };
    const result = editingId ? await updateObjective(editingId, payload) : await createObjective(payload);
    setSaving(false);
    if (!result) { setError("Não foi possível guardar o objectivo."); return; }
    setShowForm(false);
    reload();
  }

  async function handleToggleAchieved(obj) {
    await updateObjective(obj.id, { achieved: !obj.achieved });
    reload();
  }

  async function handleDelete(id) {
    if (!window.confirm("Apagar este objectivo?")) return;
    await deleteObjective(id);
    reload();
  }

  const achieved = objectives.filter((o) => o.achieved).length;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.88rem", opacity: 0.75 }}>
          {achieved}/{objectives.length} objectivos alcançados
        </span>
        {objectives.length > 0 && (
          <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, minWidth: 80 }}>
            <div style={{ height: "100%", width: `${objectives.length > 0 ? Math.round((achieved / objectives.length) * 100) : 0}%`, background: "#22c55e", borderRadius: 4, transition: "width 0.4s" }} />
          </div>
        )}
      </div>

      {!disabled && (
        <button className="btn primary" style={{ marginBottom: "0.85rem" }} onClick={startNew}>+ Adicionar objectivo</button>
      )}

      {showForm && (
        <div className="panel-card" style={{ padding: "1rem", marginBottom: "1rem", border: "1px solid var(--accent-color, #3b82f6)" }}>
          <div className="form-grid">
            <div className="form-field tools-form-full">
              <label>Descrição do objectivo *</label>
              <textarea rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="O que se espera que o estagiário alcance..." />
            </div>
            <div className="form-field">
              <label>Data prevista</label>
              <input type="date" value={form.target_date} onChange={(e) => setField("target_date", e.target.value)} />
            </div>
            <div className="form-field">
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer" }}>
                <input type="checkbox" checked={form.achieved} onChange={(e) => setField("achieved", e.target.checked)} />
                Já alcançado
              </label>
            </div>
            {form.achieved && (
              <div className="form-field tools-form-full">
                <label>Notas de conclusão</label>
                <textarea rows={2} value={form.achievement_notes} onChange={(e) => setField("achievement_notes", e.target.value)} />
              </div>
            )}
          </div>
          {error && <p className="tools-error">{error}</p>}
          <div style={{ display: "flex", gap: "0.65rem", marginTop: "0.65rem" }}>
            <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</button>
            <button className="btn ghost" onClick={() => { setShowForm(false); setError(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ opacity: 0.6 }}>A carregar...</p> : objectives.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Sem objectivos definidos ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {objectives.map((obj) => (
            <div key={obj.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 8, padding: "0.75rem" }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleToggleAchieved(obj)}
                aria-label={obj.achieved ? "Marcar como pendente" : "Marcar como alcançado"}
                style={{ background: "none", border: "none", cursor: disabled ? "default" : "pointer", fontSize: "1.25rem", padding: 0, color: obj.achieved ? "#22c55e" : "#9ca3af", flexShrink: 0, marginTop: 2 }}
              >
                {obj.achieved ? "✅" : "⭕"}
              </button>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: obj.achieved ? 400 : 600, textDecoration: obj.achieved ? "line-through" : "none", opacity: obj.achieved ? 0.6 : 1 }}>
                  {obj.description}
                </p>
                {obj.target_date && <small style={{ opacity: 0.65 }}>Prazo: {new Date(obj.target_date).toLocaleDateString("pt-AO")}</small>}
                {obj.achievement_notes && <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", opacity: 0.75 }}>{obj.achievement_notes}</p>}
              </div>
              {!disabled && (
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button className="btn ghost btn-sm" onClick={() => startEdit(obj)}>Editar</button>
                  <button className="btn ghost btn-sm" style={{ color: "#dc2626" }} onClick={() => handleDelete(obj.id)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-painel: Avaliações formais
// ---------------------------------------------------------------------------

function EvaluationsPanel({ progressId, partnerId, studentId, disabled }) {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK_EVAL);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const rows = await listEvaluations(progressId);
    setEvaluations(rows);
    setLoading(false);
  }, [progressId]);

  useEffect(() => { reload(); }, [reload]);

  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function startForm(type) {
    const existing = evaluations.find((e) => e.eval_type === type);
    if (existing) {
      setForm({
        eval_type: existing.eval_type,
        eval_date: existing.eval_date ?? new Date().toISOString().slice(0, 10),
        rating_punctuality: existing.rating_punctuality ?? "",
        rating_initiative: existing.rating_initiative ?? "",
        rating_teamwork: existing.rating_teamwork ?? "",
        rating_technical: existing.rating_technical ?? "",
        rating_communication: existing.rating_communication ?? "",
        general_comments: existing.general_comments ?? "",
        recommendation: existing.recommendation ?? "",
        signed_by_company: existing.signed_by_company ?? false,
        signed_by_student: existing.signed_by_student ?? false,
      });
    } else {
      setForm({ ...BLANK_EVAL, eval_type: type });
    }
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const ratingField = (v) => (v !== "" ? Number(v) : null);
    const payload = {
      company_progress_id: progressId,
      partner_id: partnerId,
      student_id: studentId,
      eval_type: form.eval_type,
      eval_date: form.eval_date,
      rating_punctuality: ratingField(form.rating_punctuality),
      rating_initiative: ratingField(form.rating_initiative),
      rating_teamwork: ratingField(form.rating_teamwork),
      rating_technical: ratingField(form.rating_technical),
      rating_communication: ratingField(form.rating_communication),
      general_comments: form.general_comments || null,
      recommendation: form.recommendation || null,
      signed_by_company: form.signed_by_company,
      signed_by_student: form.signed_by_student,
    };
    const result = await upsertEvaluation(payload);
    setSaving(false);
    if (!result) { setError("Não foi possível guardar a avaliação."); return; }
    setShowForm(false);
    reload();
  }

  const DIMS = [
    { key: "rating_punctuality", label: "Pontualidade" },
    { key: "rating_initiative", label: "Iniciativa" },
    { key: "rating_teamwork", label: "Trabalho em equipa" },
    { key: "rating_technical", label: "Competência técnica" },
    { key: "rating_communication", label: "Comunicação" },
  ];

  return (
    <div>
      {!disabled && !showForm && (
        <div style={{ display: "flex", gap: "0.65rem", marginBottom: "1rem" }}>
          <button className="btn primary" onClick={() => startForm("MIDTERM")}>
            {evaluations.find((e) => e.eval_type === "MIDTERM") ? "Editar avaliação intercalar" : "Nova avaliação intercalar"}
          </button>
          <button className="btn ghost" onClick={() => startForm("FINAL")}>
            {evaluations.find((e) => e.eval_type === "FINAL") ? "Editar avaliação final" : "Nova avaliação final"}
          </button>
        </div>
      )}

      {showForm && (
        <div className="panel-card" style={{ padding: "1rem", marginBottom: "1rem", border: "1px solid var(--accent-color, #3b82f6)" }}>
          <h4 style={{ margin: "0 0 0.75rem" }}>
            Avaliação {form.eval_type === "MIDTERM" ? "Intercalar" : "Final"}
          </h4>
          <div className="form-grid">
            <div className="form-field">
              <label>Data da avaliação</label>
              <input type="date" value={form.eval_date} onChange={(e) => setField("eval_date", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.65rem" }}>
            {DIMS.map((dim) => (
              <div key={dim.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ minWidth: 160, fontSize: "0.875rem" }}>{dim.label}</span>
                <StarRating value={Number(form[dim.key])} onChange={(v) => setField(dim.key, v)} />
                {form[dim.key] && <small style={{ opacity: 0.7 }}>{getRatingLabel(Number(form[dim.key]))}</small>}
              </div>
            ))}
          </div>
          <div className="form-field" style={{ marginTop: "0.75rem" }}>
            <label>Comentários gerais</label>
            <textarea rows={3} value={form.general_comments} onChange={(e) => setField("general_comments", e.target.value)} placeholder="Síntese da avaliação..." />
          </div>
          <div className="form-field" style={{ marginTop: "0.5rem" }}>
            <label>Recomendação</label>
            <select value={form.recommendation} onChange={(e) => setField("recommendation", e.target.value)}>
              <option value="">Sem recomendação</option>
              {Object.entries(RECOMMENDATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.65rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
              <input type="checkbox" checked={form.signed_by_company} onChange={(e) => setField("signed_by_company", e.target.checked)} />
              Assinado pela empresa
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
              <input type="checkbox" checked={form.signed_by_student} onChange={(e) => setField("signed_by_student", e.target.checked)} />
              Assinado pelo estagiário
            </label>
          </div>
          {error && <p className="tools-error">{error}</p>}
          <div style={{ display: "flex", gap: "0.65rem", marginTop: "0.65rem" }}>
            <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "A guardar..." : "Guardar avaliação"}</button>
            <button className="btn ghost" onClick={() => { setShowForm(false); setError(""); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ opacity: 0.6 }}>A carregar...</p> : evaluations.length === 0 && !showForm ? (
        <p style={{ opacity: 0.6 }}>Sem avaliações formais registadas ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {evaluations.map((ev) => (
            <div key={ev.id} style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 8, padding: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <strong>{ev.eval_type === "MIDTERM" ? "Avaliação Intercalar" : "Avaliação Final"}</strong>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {ev.rating_average && (
                    <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#f59e0b" }}>
                      Média: {ev.rating_average}/5
                    </span>
                  )}
                  {ev.recommendation && (
                    <span style={{ fontSize: "0.78rem", background: "#eff6ff", color: "#1d4ed8", borderRadius: 999, padding: "0.15rem 0.5rem", fontWeight: 600 }}>
                      {RECOMMENDATION_LABELS[ev.recommendation] ?? ev.recommendation}
                    </span>
                  )}
                  {!disabled && (
                    <button className="btn ghost btn-sm" onClick={() => startForm(ev.eval_type)}>Editar</button>
                  )}
                </div>
              </div>
              <small style={{ opacity: 0.65 }}>{new Date(ev.eval_date).toLocaleDateString("pt-AO")}</small>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {[
                  { label: "Pontualidade", v: ev.rating_punctuality },
                  { label: "Iniciativa", v: ev.rating_initiative },
                  { label: "Equipa", v: ev.rating_teamwork },
                  { label: "Técnica", v: ev.rating_technical },
                  { label: "Comunicação", v: ev.rating_communication },
                ].filter((d) => d.v != null).map((d) => (
                  <div key={d.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.7rem", opacity: 0.65 }}>{d.label}</div>
                    <div style={{ fontWeight: 700, color: "#f59e0b" }}>{"★".repeat(d.v)}</div>
                  </div>
                ))}
              </div>
              {ev.general_comments && <p style={{ margin: "0.4rem 0 0", fontSize: "0.875rem", opacity: 0.8 }}>{ev.general_comments}</p>}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.4rem", fontSize: "0.78rem", opacity: 0.7 }}>
                <span>{ev.signed_by_company ? "✔ Empresa assinou" : "✗ Empresa não assinou"}</span>
                <span>{ev.signed_by_student ? "✔ Estagiário assinou" : "✗ Estagiário não assinou"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Painel principal: InternDetailPanel
// ---------------------------------------------------------------------------

const INTERN_TABS = [
  { key: "timeline", label: "Progresso", icon: "timeline" },
  { key: "attendance", label: "Presenças", icon: "event_available" },
  { key: "objectives", label: "Objectivos", icon: "flag" },
  { key: "evaluations", label: "Avaliações", icon: "star_rate" },
];

export default function InternDetailPanel({ app, partnerId, isCompanyView = true, t }) {
  const [activeTab, setActiveTab] = useState("timeline");
  const [progress, setProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(true);

  const studentId = app?.student?.id;

  const reloadProgress = useCallback(async () => {
    if (!studentId || !partnerId) return;
    setLoadingProgress(true);
    const p = await getCompanyProgress(studentId, partnerId);
    setProgress(p);
    setLoadingProgress(false);
  }, [studentId, partnerId]);

  useEffect(() => { reloadProgress(); }, [reloadProgress]);

  if (!studentId) return <p style={{ opacity: 0.6 }}>Dados do aluno indisponíveis.</p>;

  return (
    <div>
      {/* Cabeçalho do estagiário */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <span className="material-icons" style={{ fontSize: "2.5rem", color: "var(--accent-color, #3b82f6)" }}>account_circle</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{app.student?.full_name ?? "—"}</div>
          <div style={{ fontSize: "0.82rem", opacity: 0.7 }}>
            {app.student?.email ?? ""}{app.vacancy?.title ? ` · ${app.vacancy.title}` : ""}
          </div>
        </div>
        {loadingProgress || !progress ? null : (
          <div style={{ marginLeft: "auto", fontSize: "0.82rem" }}>
            <span style={{
              padding: "0.25rem 0.65rem", borderRadius: 999, fontWeight: 600,
              background: progress.progression_stage === "COMPLETED" ? "#dcfce7" : progress.progression_stage === "TERMINATED" ? "#fee2e2" : "#eff6ff",
              color: progress.progression_stage === "COMPLETED" ? "#166534" : progress.progression_stage === "TERMINATED" ? "#b91c1c" : "#1d4ed8",
            }}>
              {progress.progression_stage ?? "—"}
            </span>
          </div>
        )}
      </div>

      {/* Tabs internas */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-color, #e2e8f0)", marginBottom: "1rem" }}>
        {INTERN_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.4rem 0.85rem",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: activeTab === tab.key ? "2px solid var(--accent-color, #3b82f6)" : "2px solid transparent",
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? "var(--accent-color, #3b82f6)" : "inherit",
              fontSize: "0.875rem", marginBottom: "-1px",
            }}
          >
            <span className="material-icons-sharp" style={{ fontSize: "1rem" }} aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {activeTab === "timeline" && (
        <CompanyProgressTimeline
          studentId={studentId}
          partnerId={partnerId}
          t={t}
          isCompanyView={isCompanyView}
          onUpdate={reloadProgress}
        />
      )}

      {activeTab === "attendance" && progress && (
        <FollowupLogsPanel
          progressId={progress.id}
          partnerId={partnerId}
          studentId={studentId}
          disabled={!isCompanyView}
        />
      )}
      {activeTab === "attendance" && !loadingProgress && !progress && (
        <p style={{ opacity: 0.65 }}>É necessário iniciar o processo de progresso (entrevista) antes de registar presenças.</p>
      )}

      {activeTab === "objectives" && progress && (
        <ObjectivesPanel
          progressId={progress.id}
          partnerId={partnerId}
          studentId={studentId}
          disabled={!isCompanyView}
        />
      )}
      {activeTab === "objectives" && !loadingProgress && !progress && (
        <p style={{ opacity: 0.65 }}>Inicie o processo de progresso antes de definir objectivos.</p>
      )}

      {activeTab === "evaluations" && progress && (
        <EvaluationsPanel
          progressId={progress.id}
          partnerId={partnerId}
          studentId={studentId}
          disabled={!isCompanyView}
        />
      )}
      {activeTab === "evaluations" && !loadingProgress && !progress && (
        <p style={{ opacity: 0.65 }}>Inicie o processo de progresso antes de registar avaliações.</p>
      )}
    </div>
  );
}
