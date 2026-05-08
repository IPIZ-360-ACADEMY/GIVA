import { useState, useMemo } from "react";

export default function CompanyOverviewPanel({
  partner,
  applications = [],
  vacancies = [],
  t = (key) => key,
}) {
  // Estatísticas de candidaturas
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

  // Taxa de aceitação
  const acceptanceRate =
    stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;

  // Taxa de rejeição
  const rejectionRate =
    stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0;

  // Tempo médio de decisão
  const averageResolutionTime = useMemo(() => {
    const resolved = applications.filter((a) => a.reviewed_at);
    if (resolved.length === 0) return null;

    const totalMs = resolved.reduce((sum, app) => {
      const applied = new Date(app.applied_at).getTime();
      const reviewed = new Date(app.reviewed_at).getTime();
      return sum + (reviewed - applied);
    }, 0);

    const avgMs = totalMs / resolved.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24)); // em dias
  }, [applications]);

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {/* Candidaturas Totais */}
        <div className="panel-card" style={{ padding: "1.25rem" }}>
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
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Taxa Aceitação</span>
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

        {/* Ocupação de Vagas */}
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Ocupação Vagas</span>
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

        {/* Tempo Médio Decisão */}
        <div className="panel-card" style={{ padding: "1.25rem" }}>
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

        {/* Vagas Ativas */}
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Vagas Publicadas</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>business_center</span>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, marginBottom: "0.5rem" }}>
            {stats.activeVacancies}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            {stats.closedVacancies} fechadas
          </div>
        </div>

        {/* Status Geral */}
        <div className="panel-card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.85rem", opacity: 0.7, fontWeight: 500 }}>Status</span>
            <span className="material-icons" style={{ fontSize: "1.5rem", opacity: 0.5 }}>check_circle</span>
          </div>
          <div style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.5rem" }}>
            {partner?.empresa || "Empresa"}
          </div>
          <div
            style={{
              padding: "0.35rem 0.6rem",
              borderRadius: 6,
              background: stats.activeVacancies > 0 ? "#dcfce7" : "#fef3c7",
              color: stats.activeVacancies > 0 ? "#166534" : "#92400e",
              fontSize: "0.75rem",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            {stats.activeVacancies > 0 ? "Recrutando" : "Sem vagas ativas"}
          </div>
        </div>
      </div>

      {/* Gráfico de Distribuição de Candidaturas */}
      <div className="panel-card" style={{ padding: "1.25rem", marginBottom: "2rem" }}>
        <h4 style={{ margin: "0 0 1rem", fontSize: "0.95rem", fontWeight: 600 }}>
          Distribuição de Candidaturas
        </h4>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "1rem", height: "120px" }}>
          {/* Barra Pendentes */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "100%",
                height: stats.total > 0 ? `${(stats.pending / stats.total) * 100}%` : "0",
                background: "#fbbf24",
                borderRadius: "4px 4px 0 0",
                minHeight: stats.pending > 0 ? "10px" : "0",
                transition: "height 0.3s ease",
              }}
            />
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Pendentes</span>
            <strong style={{ fontSize: "0.85rem" }}>{stats.pending}</strong>
          </div>

          {/* Barra Aceites */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "100%",
                height: stats.total > 0 ? `${(stats.accepted / stats.total) * 100}%` : "0",
                background: "#34d399",
                borderRadius: "4px 4px 0 0",
                minHeight: stats.accepted > 0 ? "10px" : "0",
                transition: "height 0.3s ease",
              }}
            />
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Aceites</span>
            <strong style={{ fontSize: "0.85rem" }}>{stats.accepted}</strong>
          </div>

          {/* Barra Rejeitadas */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "100%",
                height: stats.total > 0 ? `${(stats.rejected / stats.total) * 100}%` : "0",
                background: "#f87171",
                borderRadius: "4px 4px 0 0",
                minHeight: stats.rejected > 0 ? "10px" : "0",
                transition: "height 0.3s ease",
              }}
            />
            <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>Rejeitadas</span>
            <strong style={{ fontSize: "0.85rem" }}>{stats.rejected}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
