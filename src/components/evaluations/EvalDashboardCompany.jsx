import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../contexts/AuthContext.jsx";

/**
 * Visão COMPANY — avaliações de estágio dos estagiários da empresa.
 * Consome a tabela intern_evaluations (se disponível).
 */
export default function EvalDashboardCompany({ activeTab, t }) {
  const { authProfile } = useAuth();
  const companyId = authProfile?.id ?? null;

  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    loadInternEvaluations(companyId)
      .then((data) => setEvals(data || []))
      .finally(() => setLoading(false));
  }, [companyId]);

  const sorted = [...evals].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  );

  // ── Avaliações de Estágio ────────────────────────────────────────────────────
  if (activeTab === "intern-evals") {
    return (
      <div className="eval-view eval-view--company">
        {loading ? (
          <p className="meta">A carregar avaliações de estágio…</p>
        ) : sorted.length === 0 ? (
          <EmptyState message="Ainda não existem avaliações de estágio registadas." />
        ) : (
          <>
            <p className="eval-view__intro">
              Avaliações realizadas para os seus estagiários.
            </p>
            <div className="intern-eval-list">
              {sorted.map((ev) => (
                <InternEvalCard key={ev.id} ev={ev} t={t} />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Histórico ───────────────────────────────────────────────────────────────
  if (activeTab === "history") {
    const byIntern = groupBy(sorted, (ev) => ev.intern_name ?? ev.intern_id ?? "Estagiário");
    return (
      <div className="eval-view eval-view--company">
        {loading ? (
          <p className="meta">A carregar…</p>
        ) : Object.keys(byIntern).length === 0 ? (
          <EmptyState message="Sem histórico de avaliações." />
        ) : (
          <div className="eval-breakdown">
            {Object.entries(byIntern).map(([intern, items]) => (
              <div key={intern} className="breakdown-row">
                <div className="breakdown-label">{intern}</div>
                <div className="breakdown-meta">
                  {items.length} avaliação(ões) ·{" "}
                  Última: {items[0]?.created_at
                    ? new Date(items[0].created_at).toLocaleDateString("pt-PT")
                    : "—"}
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

function InternEvalCard({ ev, t }) {
  const ratings = [
    { key: "technical_skills", label: "Competências Técnicas" },
    { key: "communication", label: "Comunicação" },
    { key: "teamwork", label: "Trabalho em Equipa" },
    { key: "punctuality", label: "Pontualidade" },
    { key: "initiative", label: "Iniciativa" },
  ];

  return (
    <div className="intern-eval-card">
      <div className="intern-eval-card__header">
        <span className="intern-eval-card__name">
          {ev.intern_name ?? `Estagiário ${ev.intern_id ?? ""}`}
        </span>
        <span className="intern-eval-card__date">
          {ev.created_at ? new Date(ev.created_at).toLocaleDateString("pt-PT") : "—"}
        </span>
      </div>

      <div className="intern-eval-card__ratings">
        {ratings.map(({ key, label }) =>
          ev[key] != null ? (
            <div key={key} className="rating-row">
              <span className="rating-label">{label}</span>
              <RatingStars value={ev[key]} max={5} />
            </div>
          ) : null,
        )}
      </div>

      {ev.progression_stage && (
        <div className="intern-eval-card__stage">
          Fase: <span className="badge badge--stage">{ev.progression_stage}</span>
        </div>
      )}

      {ev.feedback && (
        <p className="intern-eval-card__feedback">{ev.feedback}</p>
      )}
    </div>
  );
}

function RatingStars({ value, max = 5 }) {
  return (
    <div className="rating-stars" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`star ${i < value ? "star--filled" : "star--empty"}`}>
          ★
        </span>
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

// ── Serviço interno ──────────────────────────────────────────────────────────

async function loadInternEvaluations(companyId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("intern_evaluations")
    .select(
      `id, intern_id, intern_name, technical_skills, communication, teamwork,
       punctuality, initiative, progression_stage, feedback, created_at`,
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[EvalDashboardCompany] loadInternEvaluations error:", error);
    return [];
  }
  return data || [];
}

// ── Utilidades ───────────────────────────────────────────────────────────────

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
