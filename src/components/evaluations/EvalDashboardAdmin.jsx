import { useState, useEffect } from "react";
import {
  listEvaluationsByType,
  exportEvaluationsReport,
} from "../../services/evaluationService.js";
import { listTrainingAreas } from "../../services/trainingAreaService.js";

/**
 * Visão SUPER_ADMIN / ADMIN — painel completo com todas as áreas,
 * filtros avançados, estatísticas e exportação.
 */
export default function EvalDashboardAdmin({ activeTab, t }) {
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [filterType, setFilterType] = useState("ALL");

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
    const listPromise =
      filterType === "ALL"
        ? Promise.all([
            listEvaluationsByType(selectedArea, "INDIVIDUAL"),
            listEvaluationsByType(selectedArea, "GROUP"),
          ]).then(([individual, group]) => [...(individual || []), ...(group || [])])
        : listEvaluationsByType(selectedArea, filterType).then((data) => data || []);

    listPromise
      .then((data) => {
        const list = [...(data || [])].sort(
          (a, b) => new Date(b.evaluation_date ?? 0) - new Date(a.evaluation_date ?? 0)
        );
        setEvaluations(list);
        setStats(computeStats(list));
      })
      .finally(() => setLoading(false));
  }, [selectedArea, filterType]);

  async function handleExport() {
    const data = await exportEvaluationsReport(selectedArea, "csv");
    if (data) {
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avaliacoes-admin-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ── Visão Geral ─────────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="eval-view eval-view--admin">
        <div className="eval-filters">
          <AreaFilter areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
          <TypeFilter value={filterType} onChange={setFilterType} t={t} />
        </div>

        {loading ? (
          <SkeletonStats />
        ) : (
          <StatsCards stats={stats} />
        )}

        <EvalTable evaluations={evaluations} loading={loading} t={t} />
      </div>
    );
  }

  // ── Por Área ─────────────────────────────────────────────────────────────────
  if (activeTab === "by-area") {
    return (
      <div className="eval-view eval-view--admin">
        <div className="eval-filters">
          <AreaFilter areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
        </div>
        <AreaBreakdown evaluations={evaluations} loading={loading} t={t} />
      </div>
    );
  }

  // ── Por Turma ────────────────────────────────────────────────────────────────
  if (activeTab === "by-class") {
    return (
      <div className="eval-view eval-view--admin">
        <div className="eval-filters">
          <AreaFilter areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
          <TypeFilter value={filterType} onChange={setFilterType} t={t} />
        </div>
        <ClassBreakdown evaluations={evaluations} loading={loading} t={t} />
      </div>
    );
  }

  // ── Por Aluno ────────────────────────────────────────────────────────────────
  if (activeTab === "by-student") {
    return (
      <div className="eval-view eval-view--admin">
        <div className="eval-filters">
          <AreaFilter areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
        </div>
        <StudentBreakdown evaluations={evaluations} loading={loading} t={t} />
      </div>
    );
  }

  // ── Exportar ─────────────────────────────────────────────────────────────────
  if (activeTab === "export") {
    return (
      <div className="eval-view eval-view--admin">
        <div className="eval-export-panel">
          <p className="meta">
            Exporte todos os registos de avaliação em formato CSV para análise externa.
          </p>
          <div className="eval-filters">
            <AreaFilter areas={areas} selected={selectedArea} onChange={setSelectedArea} t={t} />
          </div>
          <button className="btn primary" onClick={handleExport}>
            ⬇ Exportar CSV
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Sub-componentes ─────────────────────────────────────────────────────────

function AreaFilter({ areas, selected, onChange, t }) {
  if (areas.length === 0) return null;
  return (
    <div className="filter-group">
      <label className="filter-label">
        {t ? t("evaluation.selectArea") : "Área"}
      </label>
      <select
        className="filter-select"
        value={selected || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {areas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function TypeFilter({ value, onChange, t }) {
  return (
    <div className="filter-group">
      <label className="filter-label">Tipo</label>
      <select
        className="filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="ALL">Todos</option>
        <option value="INDIVIDUAL">{t ? t("evaluation.type.individual") : "Individual"}</option>
        <option value="GROUP">{t ? t("evaluation.type.group") : "Grupo"}</option>
      </select>
    </div>
  );
}

function StatsCards({ stats }) {
  if (!stats) return null;
  return (
    <div className="eval-stats-grid">
      <div className="stat-card">
        <span className="stat-value">{stats.total}</span>
        <span className="stat-label">Total de Avaliações</span>
      </div>
      <div className="stat-card stat-card--highlight">
        <span className="stat-value">{stats.average !== null ? stats.average.toFixed(1) : "—"}</span>
        <span className="stat-label">Média Geral</span>
      </div>
      <div className="stat-card stat-card--success">
        <span className="stat-value">{stats.approved}</span>
        <span className="stat-label">Aprovados (≥ 10)</span>
      </div>
      <div className="stat-card stat-card--danger">
        <span className="stat-value">{stats.failed}</span>
        <span className="stat-label">Reprovados (&lt; 10)</span>
      </div>
      <div className="stat-card">
        <span className="stat-value">{stats.final}</span>
        <span className="stat-label">Notas Finais</span>
      </div>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="eval-stats-grid">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="stat-card stat-card--skeleton" />
      ))}
    </div>
  );
}

function EvalTable({ evaluations, loading, t }) {
  if (loading) return <p className="meta">A carregar avaliações…</p>;
  if (evaluations.length === 0)
    return <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>;

  return (
    <div className="eval-table-wrapper">
      <table className="eval-table">
        <thead>
          <tr>
            <th>Aluno / Sujeito</th>
            <th>Tipo</th>
            <th>Nota</th>
            <th>Data</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((ev) => (
            <tr key={ev.id}>
              <td>{ev.student_name ?? ev.subject ?? ev.student_id ?? "—"}</td>
              <td>
                <span className={`badge badge--type-${(ev.evaluation_type ?? "").toLowerCase()}`}>
                  {ev.evaluation_type}
                </span>
              </td>
              <td>
                <ScorePill score={ev.score} />
              </td>
              <td>
                {ev.evaluation_date
                  ? new Date(ev.evaluation_date).toLocaleDateString("pt-PT")
                  : "—"}
              </td>
              <td>
                {ev.is_final ? (
                  <span className="badge badge--final">Final</span>
                ) : (
                  <span className="badge badge--draft">Provisória</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AreaBreakdown({ evaluations, loading, t }) {
  if (loading) return <p className="meta">A carregar…</p>;
  if (evaluations.length === 0)
    return <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>;

  const grouped = groupBy(evaluations, (ev) => ev.training_area_name ?? ev.training_area_id ?? "Sem área");
  return (
    <div className="eval-breakdown">
      {Object.entries(grouped).map(([area, items]) => {
        const s = computeStats(items);
        return (
          <div key={area} className="breakdown-row">
            <div className="breakdown-label">{area}</div>
            <div className="breakdown-bar-wrap">
              <div
                className="breakdown-bar"
                style={{ width: `${Math.min(100, (s.average ?? 0) * 5)}%` }}
              />
            </div>
            <div className="breakdown-meta">
              {s.total} aval. · Média: {s.average !== null ? s.average.toFixed(1) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClassBreakdown({ evaluations, loading, t }) {
  if (loading) return <p className="meta">A carregar…</p>;
  if (evaluations.length === 0)
    return <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>;

  const grouped = groupBy(evaluations, (ev) => ev.class_name ?? ev.course_name ?? "Turma desconhecida");
  return (
    <div className="eval-breakdown">
      {Object.entries(grouped).map(([cls, items]) => {
        const s = computeStats(items);
        return (
          <div key={cls} className="breakdown-row">
            <div className="breakdown-label">{cls}</div>
            <div className="breakdown-meta">
              {s.total} aval. · Média: {s.average !== null ? s.average.toFixed(1) : "—"} · Aprovados: {s.approved}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentBreakdown({ evaluations, loading, t }) {
  if (loading) return <p className="meta">A carregar…</p>;
  if (evaluations.length === 0)
    return <p className="meta">{t ? t("common.noData") : "Sem dados."}</p>;

  const grouped = groupBy(evaluations, (ev) => ev.student_name ?? ev.student_id ?? "Aluno desconhecido");
  return (
    <div className="eval-breakdown">
      {Object.entries(grouped).map(([student, items]) => {
        const s = computeStats(items);
        return (
          <div key={student} className="breakdown-row">
            <div className="breakdown-label">{student}</div>
            <div className="breakdown-meta">
              {s.total} aval. · Média: {s.average !== null ? s.average.toFixed(1) : "—"}
              {s.average !== null && (
                <span className={s.average >= 10 ? " text-success" : " text-danger"}>
                  {s.average >= 10 ? " ✓ Aprovado" : " ✗ Reprovado"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScorePill({ score }) {
  if (score == null) return <span>—</span>;
  const cls = score >= 18 ? "excellent" : score >= 14 ? "good" : score >= 10 ? "pass" : "fail";
  return <span className={`score-pill score-pill--${cls}`}>{score}</span>;
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function computeStats(list) {
  if (!list || list.length === 0) return { total: 0, average: null, approved: 0, failed: 0, final: 0 };
  const scores = list.map((e) => Number(e.score)).filter((s) => !Number.isNaN(s));
  const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return {
    total: list.length,
    average,
    approved: scores.filter((s) => s >= 10).length,
    failed: scores.filter((s) => s < 10).length,
    final: list.filter((e) => e.is_final).length,
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
