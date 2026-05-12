import { useState, useEffect } from "react";
import { listEvaluationsByType, exportEvaluationsReport } from "../../services/evaluationService.js";
import { listTrainingAreas } from "../../services/trainingAreaService.js";

/**
 * Visão COORDINATOR — painel filtrado pela área do coordenador,
 * com visibilidade sobre turmas e alunos sob sua responsabilidade.
 */
export default function EvalDashboardCoordinator({ activeTab, t, userProfile }) {
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listTrainingAreas().then((data) => {
      const list = data || [];
      // Filtrar pelas áreas do coordinator quando disponível
      const coordAreaId = userProfile?.area_id;
      const filtered = coordAreaId ? list.filter((a) => a.id === coordAreaId) : list;
      const display = filtered.length > 0 ? filtered : list;
      setAreas(display);
      if (display.length > 0) setSelectedArea(display[0].id);
    });
  }, [userProfile?.area_id]);

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
      a.download = `avaliacoes-coord-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const stats = computeStats(evaluations);

  // ── Minha Área ───────────────────────────────────────────────────────────────
  if (activeTab === "area-overview") {
    return (
      <div className="eval-view eval-view--coordinator">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />

        {loading ? (
          <p className="meta">A carregar…</p>
        ) : (
          <>
            <div className="eval-stats-grid">
              <div className="stat-card">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Avaliações</span>
              </div>
              <div className="stat-card stat-card--highlight">
                <span className="stat-value">{stats.average !== null ? stats.average.toFixed(1) : "—"}</span>
                <span className="stat-label">Média da Área</span>
              </div>
              <div className="stat-card stat-card--success">
                <span className="stat-value">{stats.approved}</span>
                <span className="stat-label">Aprovados</span>
              </div>
              <div className="stat-card stat-card--danger">
                <span className="stat-value">{stats.failed}</span>
                <span className="stat-label">Reprovados</span>
              </div>
            </div>
            <EvalListCompact evaluations={evaluations} t={t} />
          </>
        )}
      </div>
    );
  }

  // ── Por Turma ────────────────────────────────────────────────────────────────
  if (activeTab === "by-class") {
    const grouped = groupBy(evaluations, (ev) => ev.class_name ?? ev.course_name ?? "Turma");
    return (
      <div className="eval-view eval-view--coordinator">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
        {loading ? (
          <p className="meta">A carregar…</p>
        ) : (
          <div className="eval-breakdown">
            {Object.entries(grouped).map(([cls, items]) => {
              const s = computeStats(items);
              return (
                <div key={cls} className="breakdown-row">
                  <div className="breakdown-label">{cls}</div>
                  <div className="breakdown-meta">
                    {s.total} aval. · Média: {s.average !== null ? s.average.toFixed(1) : "—"}
                  </div>
                </div>
              );
            })}
            {Object.keys(grouped).length === 0 && (
              <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Por Aluno ────────────────────────────────────────────────────────────────
  if (activeTab === "by-student") {
    const grouped = groupBy(evaluations, (ev) => ev.student_name ?? ev.student_id ?? "Aluno");
    return (
      <div className="eval-view eval-view--coordinator">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
        {loading ? (
          <p className="meta">A carregar…</p>
        ) : (
          <div className="eval-breakdown">
            {Object.entries(grouped).map(([student, items]) => {
              const s = computeStats(items);
              return (
                <div key={student} className="breakdown-row">
                  <div className="breakdown-label">{student}</div>
                  <div className="breakdown-meta">
                    {s.total} aval. · Média:{" "}
                    <strong>{s.average !== null ? s.average.toFixed(1) : "—"}</strong>
                    {s.average !== null && (
                      <span className={s.average >= 10 ? " text-success" : " text-danger"}>
                        {s.average >= 10 ? " ✓" : " ✗"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(grouped).length === 0 && (
              <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Relatórios / Exportar ────────────────────────────────────────────────────
  if (activeTab === "export") {
    return (
      <div className="eval-view eval-view--coordinator">
        <AreaSelector areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
        <div className="eval-export-panel">
          <p className="meta">Exporte os dados da sua área em formato CSV.</p>
          <button className="btn primary" onClick={handleExport}>
            ⬇ Exportar CSV da Área
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function AreaSelector({ areas, selected, onChange, t }) {
  if (areas.length <= 1) return null;
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

function EvalListCompact({ evaluations, t }) {
  if (evaluations.length === 0)
    return <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>;
  return (
    <div className="eval-list-compact">
      {evaluations.slice(0, 20).map((ev) => (
        <div key={ev.id} className="eval-row">
          <span className="eval-row__name">{ev.student_name ?? ev.subject ?? "—"}</span>
          <span className={`score-pill score-pill--${scoreCls(ev.score)}`}>{ev.score ?? "—"}</span>
          <span className="eval-row__date">
            {ev.evaluation_date ? new Date(ev.evaluation_date).toLocaleDateString("pt-PT") : "—"}
          </span>
        </div>
      ))}
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
