import { useState, useEffect } from "react";
import {
  getStudentEvaluations,
  getStudentAverageGrade,
} from "../../services/evaluationService.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

/**
 * Visão STUDENT — histórico pessoal de avaliações com linha do tempo.
 */
export default function EvalDashboardStudent({ activeTab, t }) {
  const { authProfile } = useAuth();
  const studentId = authProfile?.id ?? null;

  const [evaluations, setEvaluations] = useState([]);
  const [average, setAverage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      getStudentEvaluations(studentId),
      getStudentAverageGrade(studentId),
    ])
      .then(([evals, avg]) => {
        setEvaluations(evals || []);
        setAverage(avg ?? null);
      })
      .finally(() => setLoading(false));
  }, [studentId]);

  const sorted = [...evaluations].sort(
    (a, b) => new Date(b.evaluation_date) - new Date(a.evaluation_date),
  );

  // ── Minhas Avaliações ────────────────────────────────────────────────────────
  if (activeTab === "mine") {
    return (
      <div className="eval-view eval-view--student">
        {loading ? (
          <StudentSkeleton />
        ) : (
          <>
            <StudentSummaryBanner average={average} total={evaluations.length} t={t} />
            {sorted.length === 0 ? (
              <EmptyState message="Ainda não tens avaliações registadas." />
            ) : (
              <div className="student-eval-list">
                {sorted.map((ev) => (
                  <StudentEvalCard key={ev.id} ev={ev} t={t} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Histórico / Linha do tempo ───────────────────────────────────────────────
  if (activeTab === "history") {
    const chronological = [...evaluations].sort(
      (a, b) => new Date(a.evaluation_date) - new Date(b.evaluation_date),
    );
    return (
      <div className="eval-view eval-view--student">
        {loading ? (
          <StudentSkeleton />
        ) : chronological.length === 0 ? (
          <EmptyState message="Sem histórico de avaliações." />
        ) : (
          <div className="eval-timeline">
            {chronological.map((ev, idx) => (
              <div key={ev.id} className={`timeline-entry ${idx % 2 === 0 ? "left" : "right"}`}>
                <div className="timeline-date">
                  {ev.evaluation_date
                    ? new Date(ev.evaluation_date).toLocaleDateString("pt-PT")
                    : "—"}
                </div>
                <div className={`timeline-card score-border--${scoreCls(ev.score)}`}>
                  <div className="timeline-card__header">
                    <span className="timeline-card__subject">
                      {ev.subject ?? ev.training_area_name ?? "Avaliação"}
                    </span>
                    <span className={`score-pill score-pill--${scoreCls(ev.score)}`}>
                      {ev.score ?? "—"}
                    </span>
                  </div>
                  {ev.feedback && (
                    <p className="timeline-card__feedback">{ev.feedback}</p>
                  )}
                  {ev.is_final && (
                    <span className="badge badge--final">Nota Final</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function StudentSummaryBanner({ average, total, t }) {
  const cls = average == null ? "unknown" : scoreCls(average);
  return (
    <div className={`student-summary-banner banner--${cls}`}>
      <div className="banner-stat">
        <span className="banner-stat__value">{total}</span>
        <span className="banner-stat__label">Avaliações</span>
      </div>
      <div className="banner-stat banner-stat--main">
        <span className="banner-stat__value">
          {average !== null ? Number(average).toFixed(1) : "—"}
        </span>
        <span className="banner-stat__label">Média Geral</span>
      </div>
      <div className="banner-stat">
        <span className={`banner-status banner-status--${average !== null && average >= 10 ? "pass" : "fail"}`}>
          {average !== null ? (average >= 10 ? "Aprovado" : "Reprovado") : "—"}
        </span>
      </div>
    </div>
  );
}

function StudentEvalCard({ ev, t }) {
  return (
    <div className={`eval-card eval-card--${scoreCls(ev.score)}`}>
      <div className="eval-card__top">
        <span className="eval-card__subject">
          {ev.subject ?? ev.training_area_name ?? "Avaliação"}
        </span>
        <span className={`score-pill score-pill--${scoreCls(ev.score)}`}>
          {ev.score ?? "—"} <span className="score-denom">/ 20</span>
        </span>
      </div>
      <div className="eval-card__meta">
        <span>
          {ev.evaluation_date
            ? new Date(ev.evaluation_date).toLocaleDateString("pt-PT")
            : "—"}
        </span>
        {ev.is_final && <span className="badge badge--final">Final</span>}
        {ev.evaluation_type && (
          <span className={`badge badge--type-${ev.evaluation_type.toLowerCase()}`}>
            {ev.evaluation_type}
          </span>
        )}
      </div>
      {ev.feedback && <p className="eval-card__feedback">{ev.feedback}</p>}
    </div>
  );
}

function StudentSkeleton() {
  return (
    <div className="student-skeleton">
      <div className="skeleton-banner" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton-card" />
      ))}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="eval-empty-state">
      <div className="eval-empty-state__icon">📋</div>
      <p className="meta">{message}</p>
    </div>
  );
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function scoreCls(score) {
  if (score == null) return "unknown";
  const n = Number(score);
  if (n >= 18) return "excellent";
  if (n >= 14) return "good";
  if (n >= 10) return "pass";
  return "fail";
}
