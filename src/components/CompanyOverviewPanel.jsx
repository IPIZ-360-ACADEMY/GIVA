import { useMemo } from "react";

export default function CompanyOverviewPanel({
  partner,
  applications = [],
  vacancies = [],
  t = (key) => key,
}) {
  const formatDate = (value) => {
    if (!value) return "—";
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-PT");
  };

  const getDaysSince = (value) => {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
  };

  const stats = useMemo(() => {
    const pending = applications.filter((a) => a.status === "PENDING").length;
    const accepted = applications.filter((a) => a.status === "ACCEPTED").length;
    const rejected = applications.filter((a) => a.status === "REJECTED").length;
    const total = applications.length;

    const activeVacancies = vacancies.filter((v) => v.status === "OPEN").length;
    const closedVacancies = vacancies.filter((v) => v.status === "CLOSED").length;

    const totalSlots = vacancies.reduce((sum, v) => sum + (Number(v.total_slots) || 0), 0);
    const occupiedSlots = vacancies.reduce(
      (sum, v) => sum + (Number(v.total_slots) || 0) - (Number(v.available_slots) || 0),
      0
    );
    const occupancyRate = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    return {
      pending,
      accepted,
      rejected,
      total,
      activeVacancies,
      closedVacancies,
      occupiedSlots,
      totalSlots,
      occupancyRate,
    };
  }, [applications, vacancies]);

  const acceptanceRate =
    stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  const rejectionRate =
    stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0;

  const averageResolutionTime = useMemo(() => {
    const resolved = applications.filter((a) => a.reviewed_at);
    if (resolved.length === 0) return null;

    const totalMs = resolved.reduce((sum, app) => {
      const applied = new Date(app.applied_at).getTime();
      const reviewed = new Date(app.reviewed_at).getTime();
      return sum + (reviewed - applied);
    }, 0);

    const avgMs = totalMs / resolved.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24));
  }, [applications]);

  const pendingQueue = useMemo(() => {
    return [...applications]
      .filter((a) => a.status === "PENDING")
      .sort((a, b) => {
        const da = getDaysSince(a.applied_at) ?? 0;
        const db = getDaysSince(b.applied_at) ?? 0;
        return db - da;
      });
  }, [applications]);

  const activeInternships = useMemo(() => {
    return [...applications]
      .filter((a) => a.status === "ACCEPTED")
      .sort((a, b) => {
        const ta = new Date(a.accepted_at || a.reviewed_at || 0).getTime();
        const tb = new Date(b.accepted_at || b.reviewed_at || 0).getTime();
        return tb - ta;
      });
  }, [applications]);

  const recentApplications = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime())
      .slice(0, 6);
  }, [applications]);

  const performanceScore = useMemo(() => {
    const occupancy = Math.min(100, Math.max(0, stats.occupancyRate));
    const accept = Math.min(100, Math.max(0, acceptanceRate));
    const velocity = averageResolutionTime === null
      ? 60
      : Math.max(0, Math.min(100, 100 - (averageResolutionTime * 12)));
    return Math.round((occupancy * 0.35) + (accept * 0.35) + (velocity * 0.3));
  }, [stats.occupancyRate, acceptanceRate, averageResolutionTime]);

  const performanceLabel = performanceScore >= 80
    ? "Alto desempenho"
    : performanceScore >= 60
      ? "Desempenho estável"
      : performanceScore >= 40
        ? "Atenção operacional"
        : "Risco operacional";

  const getMetricColor = (value, thresholds) => {
    if (value >= thresholds.excellent) return { bg: "#dcfce7", fg: "#166534", label: "Excelente" };
    if (value >= thresholds.good) return { bg: "#cffafe", fg: "#0c4a6e", label: "Bom" };
    if (value >= thresholds.fair) return { bg: "#fef3c7", fg: "#92400e", label: "Aceitável" };
    return { bg: "#fee2e2", fg: "#991b1b", label: "Precisa melhora" };
  };

  const occupancyMetric = getMetricColor(stats.occupancyRate, {
    excellent: 80,
    good: 60,
    fair: 40,
    poor: 0,
  });

  const acceptanceMetric = getMetricColor(acceptanceRate, {
    excellent: 70,
    good: 50,
    fair: 30,
    poor: 0,
  });

  return (
    <div className="company-overview-panel">
      <div
        className="panel-card"
        style={{
          padding: "1.15rem 1.25rem",
          marginBottom: "1.15rem",
          background: "linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(255, 255, 255, 0.02))",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Visão geral de candidaturas e estágios</h3>
            <p style={{ margin: "0.35rem 0 0", opacity: 0.8 }}>
              {partner?.empresa || "Empresa"} · acompanhamento operacional do pipeline e desempenho.
            </p>
          </div>
          <div
            style={{
              borderRadius: 12,
              padding: "0.45rem 0.7rem",
              background: performanceScore >= 80 ? "#dcfce7" : performanceScore >= 60 ? "#cffafe" : "#fef3c7",
              color: performanceScore >= 80 ? "#166534" : performanceScore >= 60 ? "#0c4a6e" : "#92400e",
              fontWeight: 700,
              fontSize: "0.82rem",
            }}
          >
            Índice: {performanceScore}/100 · {performanceLabel}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #38bdf8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Candidaturas</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>application_form</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {stats.total}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
            <span style={{ padding: "0.2rem 0.5rem", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
              {stats.pending} pendentes
            </span>
            <span style={{ padding: "0.2rem 0.5rem", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
              {stats.accepted} aceites
            </span>
            <span style={{ padding: "0.2rem 0.5rem", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
              {stats.rejected} rejeitadas
            </span>
          </div>
        </div>

        {/* Taxa de Aceitação */}
        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #22c55e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Taxa de aceitação</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>trending_up</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {acceptanceRate}%
          </div>
          <div
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: 6,
              background: acceptanceMetric.bg,
              color: acceptanceMetric.fg,
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            {acceptanceMetric.label}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #0f766e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Ocupação de vagas</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>people_alt</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {stats.occupancyRate}%
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.35rem" }}>
            {stats.occupiedSlots}/{stats.totalSlots} estagiários
          </div>
          <div
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: 6,
              background: occupancyMetric.bg,
              color: occupancyMetric.fg,
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            {occupancyMetric.label}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #f59e0b" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Tempo Médio Decisão</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>schedule</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {averageResolutionTime !== null ? `${averageResolutionTime}d` : "—"}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            {averageResolutionTime !== null
              ? averageResolutionTime <= 2
                ? "Excelente velocidade"
                : averageResolutionTime <= 5
                ? "Aceitável"
                : "Considere agilizar"
              : "Sem dados"}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #3b82f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Vagas Publicadas</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>business_center</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {stats.activeVacancies}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            {stats.closedVacancies} fechadas · {stats.totalSlots} vagas totais
          </div>
        </div>

        <div className="panel-card" style={{ padding: "1.25rem", borderTop: "3px solid #ef4444" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Rejeição</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>trending_down</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {rejectionRate}%
          </div>
          <div
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: 6,
              background: rejectionRate <= 30 ? "#dcfce7" : rejectionRate <= 45 ? "#fef3c7" : "#fee2e2",
              color: rejectionRate <= 30 ? "#166534" : rejectionRate <= 45 ? "#92400e" : "#991b1b",
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            {rejectionRate <= 30 ? "Nível controlado" : rejectionRate <= 45 ? "Sob observação" : "Taxa elevada"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>
            Pipeline de candidaturas
          </h4>
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {[
              { label: "Pendentes", value: stats.pending, color: "#f59e0b" },
              { label: "Aceites", value: stats.accepted, color: "#22c55e" },
              { label: "Rejeitadas", value: stats.rejected, color: "#ef4444" },
            ].map((item) => {
              const pct = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: "0.3rem" }}>
                    <span>{item.label}</span>
                    <strong>{item.value} ({pct}%)</strong>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "rgba(148, 163, 184, 0.2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>
            Acompanhamentos prioritários
          </h4>
          <div style={{ display: "grid", gap: "0.55rem" }}>
            <div style={{ padding: "0.7rem", borderRadius: 10, background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
              <strong style={{ fontSize: "0.83rem" }}>Triagem pendente</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                {pendingQueue.filter((app) => (getDaysSince(app.applied_at) ?? 0) >= 3).length} candidatura(s) acima de 3 dias.
              </p>
            </div>
            <div style={{ padding: "0.7rem", borderRadius: 10, background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.25)" }}>
              <strong style={{ fontSize: "0.83rem" }}>Estágios em curso</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                {activeInternships.length} estagiário(s) ativo(s) com acompanhamento contínuo.
              </p>
            </div>
            <div style={{ padding: "0.7rem", borderRadius: 10, background: "rgba(14, 165, 233, 0.12)", border: "1px solid rgba(14, 165, 233, 0.25)" }}>
              <strong style={{ fontSize: "0.83rem" }}>Capacidade operacional</strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.9 }}>
                {stats.totalSlots - stats.occupiedSlots > 0
                  ? `${stats.totalSlots - stats.occupiedSlots} vaga(s) ainda disponível(is).`
                  : "Sem vagas disponíveis no momento."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>
            Estágios ativos (acompanhamento)
          </h4>
          {activeInternships.length === 0 ? (
            <p className="empty-state-text" style={{ margin: 0, textAlign: "left" }}>
              Ainda não há estagiários ativos.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {activeInternships.slice(0, 5).map((app) => {
                const daysActive = getDaysSince(app.accepted_at || app.reviewed_at);
                return (
                  <div key={app.id} style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 10, padding: "0.6rem 0.7rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "0.86rem" }}>{app.student?.full_name || "Sem nome"}</strong>
                      <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                        {daysActive === null ? "—" : `${daysActive} dia(s)`}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", opacity: 0.78, marginTop: "0.2rem" }}>
                      {app.vacancy?.title || "Sem vaga associada"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <h4 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 700 }}>
            Últimas candidaturas
          </h4>
          {recentApplications.length === 0 ? (
            <p className="empty-state-text" style={{ margin: 0, textAlign: "left" }}>
              Sem candidaturas recentes.
            </p>
          ) : (
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {recentApplications.map((app) => (
                <div key={app.id} style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 10, padding: "0.6rem 0.7rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.86rem" }}>{app.student?.full_name || "Sem nome"}</strong>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "0.15rem 0.45rem",
                        borderRadius: 999,
                        background: app.status === "PENDING" ? "#fef3c7" : app.status === "ACCEPTED" ? "#dcfce7" : "#fee2e2",
                        color: app.status === "PENDING" ? "#92400e" : app.status === "ACCEPTED" ? "#166534" : "#991b1b",
                        fontWeight: 700,
                      }}
                    >
                      {app.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", opacity: 0.78, marginTop: "0.2rem" }}>
                    {app.vacancy?.title || "Sem vaga"} · {formatDate(app.applied_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
