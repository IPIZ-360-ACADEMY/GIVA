import { Link, useOutletContext } from "react-router-dom";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

export default function DashboardPage() {
  const { query, currentDate, showToast, t } = useOutletContext();

  const kpis = [
    {
      label: t("dashboard.kpi.active"),
      icon: "trending_up",
      value: "243",
      meta: t("dashboard.kpi.activeMeta"),
      search: "total estagiarios ativos",
      to: "/estagios",
      action: `${t("common.open")} ${t("nav.internships")}`,
    },
    {
      label: t("dashboard.kpi.unassigned"),
      icon: "person_off",
      value: "97",
      meta: t("dashboard.kpi.unassignedMeta"),
      search: "sem alocacao",
      to: "/turmas",
      action: `${t("common.open")} ${t("nav.classes")}`,
    },
    {
      label: t("dashboard.kpi.partners"),
      icon: "domain",
      value: "18",
      meta: t("dashboard.kpi.partnersMeta"),
      search: "parceiros ativos",
      to: "/parceiros",
      action: `${t("common.open")} ${t("nav.partners")}`,
    },
    {
      label: t("dashboard.kpi.critical"),
      icon: "warning",
      value: "9",
      meta: t("dashboard.kpi.criticalMeta"),
      search: "alertas criticos",
      to: "/notificacoes",
      action: `${t("common.open")} ${t("nav.notifications")}`,
    }
  ];

  const docs = [
    { id: "d1", documento: t("dashboard.doc1"), tipo: "DOCX", estado: t("common.inReview") },
    { id: "d2", documento: t("dashboard.doc2"), tipo: "PDF", estado: t("common.approved") },
    { id: "d3", documento: t("dashboard.doc3"), tipo: "XLSX", estado: t("common.delayed") }
  ];

  const docColumns = [
    { key: "documento", label: t("common.document") },
    { key: "tipo", label: t("common.type") },
    { key: "estado", label: t("common.status") },
    {
      key: "acao",
      label: t("common.action"),
      render: (row) => (
        <button className="btn ghost" type="button" onClick={() => showToast(t("dashboard.toast.download").replace("{name}", row.documento))}>
          {t("common.download")}
        </button>
      )
    }
  ];

  return (
    <main className="page page-dashboard">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        meta={
          <>
            <span className="tag">
              <span className="material-icons-sharp">calendar_month</span>
              {currentDate}
            </span>
            <span className="tag">
              <span className="material-icons-sharp">fact_check</span>
              {t("dashboard.auditedData")}
            </span>
          </>
        }
      />

      <section className="stats-grid">
        {kpis
          .filter((item) => matchesSearch(query, item.search))
          .map((item) => (
            <article className="stat-card" key={item.label}>
              <div className="stat-head">
                <span>{item.label}</span>
                <span className="material-icons-sharp">{item.icon}</span>
              </div>
              <h3>{item.value}</h3>
              <p>{item.meta}</p>
              <div className="card-actions">
                <Link className="btn ghost" to={item.to} aria-label={`${item.action}`}>
                  {item.action}
                </Link>
              </div>
            </article>
          ))}
      </section>

      <section className="panel-grid">
        <PanelSection title={t("dashboard.distribution")}>
          <div className="bars">
            <div className="bar">
              <strong>TI</strong>
              <div className="line">
                <span className="p-87" />
              </div>
            </div>
            <div className="bar">
              <strong>EIE</strong>
              <div className="line line-accent">
                <span className="p-68" />
              </div>
            </div>
            <div className="bar">
              <strong>TLQB</strong>
              <div className="line">
                <span className="p-63" />
              </div>
            </div>
            <div className="bar">
              <strong>Mecanica</strong>
              <div className="line line-danger">
                <span className="p-45" />
              </div>
            </div>
          </div>
        </PanelSection>

        <PanelSection title={t("dashboard.recentActivity")}>
          <div className="list">
            <div className="list-item">
              <strong>{t("dashboard.activityOne")}</strong>
              <span className="meta">{t("dashboard.activityOneTime")}</span>
            </div>
            <div className="list-item">
              <strong>{t("dashboard.activityTwo")}</strong>
              <span className="meta">{t("dashboard.activityTwoTime")}</span>
            </div>
            <div className="list-item">
              <strong>{t("dashboard.activityThree")}</strong>
              <span className="meta">{t("dashboard.activityThreeTime")}</span>
            </div>
          </div>
        </PanelSection>
      </section>

      <PanelSection title={t("dashboard.inProgressDocs")}>
        <DataTable columns={docColumns} rows={docs.filter((doc) => matchesSearch(query, `${doc.documento} ${doc.tipo} ${doc.estado}`))} />
      </PanelSection>
    </main>
  );
}
