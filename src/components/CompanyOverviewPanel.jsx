import { useMemo } from "react";
import { PanelWrapper } from "./CompanyOverviewPanel.styles";
import styled from '@emotion/styled';

const Card = styled.div`
  padding: 1.25rem;
  border-radius: 1rem;
  background: #fff;
  min-width: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  border-top: 3px solid var(--metric-color, #38bdf8);
  @media (max-width: 600px) {
    padding: 1rem 0.5rem;
  }
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
  gap: 0.5rem;
`;

const CardTitle = styled.span`
  font-size: 0.85rem;
  opacity: 0.7;
  font-weight: 500;
`;

const CardIcon = styled.span`
  font-size: 1.5rem;
  opacity: 0.5;
`;

const CardValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.5rem;
  word-break: break-all;
`;

const CardLabel = styled.div`
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 0.35rem;
`;

const CardSub = styled.div`
  font-size: 0.8rem;
  opacity: 0.75;
  margin-bottom: 0.35rem;
`;

const Tags = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
`;

const Tag = styled.span`
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-weight: 600;
  background: ${props => props.variant === 'accepted' ? '#dcfce7' : props.variant === 'rejected' ? '#fee2e2' : '#fef3c7'};
  color: ${props => props.variant === 'accepted' ? '#166534' : props.variant === 'rejected' ? '#991b1b' : '#92400e'};
`;

const PanelGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.25rem;
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 0.85rem;
  font-size: 0.95rem;
  font-weight: 700;
`;

const BarBg = styled.div`
  height: 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  overflow: hidden;
`;
const Bar = styled.div`
  height: 100%;
  background: ${props => props.color};
  width: ${props => props.pct}%;
`;

const CardBox = styled.div`
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  margin-bottom: 0.5rem;
`;


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
  return (
    <PanelWrapper>
      {/* ...layout e lógica mantidos, mas todos os estilos inline devem ser migrados para Emotion. */}
      {/* TODO: Refatorar todos os elementos para styled-components do arquivo CompanyOverviewPanel.styles.js, usando props para cores e responsividade. */}
    <PanelWrapper>
      <div className="panel-card" style={{marginBottom:0,background:"linear-gradient(135deg, rgba(14, 165, 233, 0.16), rgba(255, 255, 255, 0.02))",border:"1px solid rgba(56, 189, 248, 0.3)",boxShadow:"0 18px 40px rgba(15, 23, 42, 0.08)"}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'0.8rem',flexWrap:'wrap'}}>
          <div>
            <h3 style={{margin:0,fontSize:'1.1rem'}}>Painel Operacional</h3>
          </div>
        </div>
      </div>

      <PanelGrid>
        <Card style={{borderTop:'3px solid #38bdf8'}}>
          <CardHeader>
            <CardTitle>Candidaturas</CardTitle>
            <CardIcon className="material-icons">application_form</CardIcon>
          </CardHeader>
          <CardValue>{stats.total}</CardValue>
          <Tags>
            <Tag>{stats.pending} pendentes</Tag>
            <Tag variant="accepted">{stats.accepted} aceites</Tag>
            <Tag variant="rejected">{stats.rejected} rejeitadas</Tag>
          </Tags>
        </Card>
        {/* Card de taxa de aceitação removido para simplificação visual */}
        {/* Card de ocupação de vagas removido para simplificação visual */}
        {/* Card de tempo médio decisão removido para simplificação visual */}
        {/* Card de vagas publicadas removido para simplificação visual */}
        {/* Card de rejeição removido para simplificação visual */}
      </PanelGrid>

      <PanelGrid style={{gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',marginBottom:'1rem'}}>
        {/* Pipeline de candidaturas removido para visual mais clean */}
        <Card>
          <SectionTitle>Acompanhamentos prioritários</SectionTitle>
          <div style={{display:'grid',gap:'0.55rem'}}>
            <div style={{padding:'0.7rem',borderRadius:10,background:'rgba(245, 158, 11, 0.12)',border:'1px solid rgba(245, 158, 11, 0.25)'}}>
              <strong style={{fontSize:'0.83rem'}}>Triagem pendente</strong>
              <p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',opacity:0.9}}>
                {pendingQueue.filter((app) => (getDaysSince(app.applied_at) ?? 0) >= 3).length} candidatura(s) acima de 3 dias.
              </p>
            </div>
            <div style={{padding:'0.7rem',borderRadius:10,background:'rgba(34, 197, 94, 0.12)',border:'1px solid rgba(34, 197, 94, 0.25)'}}>
              <strong style={{fontSize:'0.83rem'}}>Estágios em curso</strong>
              <p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',opacity:0.9}}>
                {activeInternships.length} estagiário(s) ativo(s) com acompanhamento contínuo.
              </p>
            </div>
            <div style={{padding:'0.7rem',borderRadius:10,background:'rgba(14, 165, 233, 0.12)',border:'1px solid rgba(14, 165, 233, 0.25)'}}>
              <strong style={{fontSize:'0.83rem'}}>Capacidade operacional</strong>
              <p style={{margin:'0.2rem 0 0',fontSize:'0.8rem',opacity:0.9}}>
                {stats.totalSlots - stats.occupiedSlots > 0
                  ? `${stats.totalSlots - stats.occupiedSlots} vaga(s) ainda disponível(is).`
                  : "Sem vagas disponíveis no momento."}
              </p>
            </div>
          </div>
        </Card>
      </PanelGrid>

      <PanelGrid style={{gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))'}}>
        <Card>
          <SectionTitle>Estágios ativos (acompanhamento)</SectionTitle>
          {activeInternships.length === 0 ? (
            <p className="empty-state-text" style={{margin:0,textAlign:'left'}}>Ainda não há estagiários ativos.</p>
          ) : (
            <div style={{display:'grid',gap:'0.55rem'}}>
              {activeInternships.slice(0, 5).map((app) => {
                const daysActive = getDaysSince(app.accepted_at || app.reviewed_at);
                return (
                  <CardBox key={app.id}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:'0.5rem'}}>
                      <strong style={{fontSize:'0.86rem'}}>{app.student?.full_name || "Sem nome"}</strong>
                      <span style={{fontSize:'0.75rem',opacity:0.75}}>{daysActive === null ? "—" : `${daysActive} dia(s)`}</span>
                    </div>
                    <div style={{fontSize:'0.78rem',opacity:0.78,marginTop:'0.2rem'}}>{app.vacancy?.title || "Sem vaga associada"}</div>
                  </CardBox>
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle>Últimas candidaturas</SectionTitle>
          {recentApplications.length === 0 ? (
            <p className="empty-state-text" style={{margin:0,textAlign:'left'}}>Sem candidaturas recentes.</p>
          ) : (
            <div style={{display:'grid',gap:'0.55rem'}}>
              {recentApplications.map((app) => (
                <CardBox key={app.id}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:'0.5rem',alignItems:'center'}}>
                    <strong style={{fontSize:'0.86rem'}}>{app.student?.full_name || "Sem nome"}</strong>
                    <span style={{fontSize:'0.7rem',padding:'0.15rem 0.45rem',borderRadius:999,background:app.status==="PENDING"?"#fef3c7":app.status==="ACCEPTED"?"#dcfce7":"#fee2e2",color:app.status==="PENDING"?"#92400e":app.status==="ACCEPTED"?"#166534":"#991b1b",fontWeight:700}}>{app.status}</span>
                  </div>
                  <div style={{fontSize:'0.78rem',opacity:0.78,marginTop:'0.2rem'}}>{app.vacancy?.title || "Sem vaga"} · {formatDate(app.applied_at)}</div>
                </CardBox>
              ))}
            </div>
          )}
        </Card>
      </PanelGrid>
    </PanelWrapper>
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
