import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { canUseInternshipsApi, listInternships } from "../services/internshipsService.js";
import { canUsePartnersApi, listPartners } from "../services/partnersService.js";
import { canUseDocumentsApi, listDocuments } from "../services/documentsService.js";
import { canUseNotificationsApi, listNotifications } from "../services/notificationsService.js";
import { canUseJobApplicationApi, listStudentApplications } from "../services/jobApplicationService.js";
import { listTrainingAreas } from "../services/trainingAreaService.js";
import { canUseStatisticsApi, fetchStatisticsMetrics } from "../services/statisticsService.js";
import { supabase } from "../lib/supabase.js";

function percentOf(total, value) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function buildDistribution(rows, keySelector, labelSelector) {
  const total = rows.length;
  const aggregate = new Map();

  for (const row of rows) {
    const key = keySelector(row);
    const label = labelSelector(row);
    const record = aggregate.get(key) ?? { key, label, count: 0 };
    record.count += 1;
    aggregate.set(key, record);
  }

  return Array.from(aggregate.values())
    .map((item) => ({
      ...item,
      percent: percentOf(total, item.count),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label));
    });
}

function countInRollingDays(rows, fieldName, days) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const start = now - (days * dayMs);
  return rows.reduce((sum, row) => {
    const value = Date.parse(row?.[fieldName] ?? "");
    if (!Number.isFinite(value)) return sum;
    return value >= start && value <= now ? sum + 1 : sum;
  }, 0);
}

function countInPreviousRollingDays(rows, fieldName, days) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = now - (days * dayMs);
  const previousStart = currentStart - (days * dayMs);
  return rows.reduce((sum, row) => {
    const value = Date.parse(row?.[fieldName] ?? "");
    if (!Number.isFinite(value)) return sum;
    return value >= previousStart && value < currentStart ? sum + 1 : sum;
  }, 0);
}

function deltaPercent(currentValue, previousValue) {
  if (!previousValue && !currentValue) return 0;
  if (!previousValue) return 100;
  return Math.round(((currentValue - previousValue) / previousValue) * 100);
}

function fmtPercent(value, fallback = "-") {
  if (value === null || value === undefined) return fallback;
  return `${value}%`;
}

export default function DashboardPage() {
  const { query, currentDate, showToast, t } = useOutletContext();
  const { authProfile, user, userProfile } = useAuth();
  const role = String(authProfile?.role ?? "").toUpperCase();
  const isStudentView = role === "STUDENT" || userProfile?.type === "student";
  const isAdminView = role === "SUPER_ADMIN" || role === "ADMIN_1";

  const [internships, setInternships] = useState([]);
  const [partners, setPartners] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [trainingAreas, setTrainingAreas] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [allVacancies, setAllVacancies] = useState([]);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [statisticsMetrics, setStatisticsMetrics] = useState(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);

  useEffect(() => {
    let active = true;
    const isTestMode = import.meta.env.MODE === "test";

    async function loadData() {
      if (isTestMode) {
        if (active) {
          setInternships([]);
          setPartners([]);
          setDocuments([]);
          setNotifications([]);
          setMyApplications([]);
          setTrainingAreas([]);
        }
        return;
      }

      try {
        const [internshipsRows, partnersRows, documentsRows, notificationsRows, areaRows] = await Promise.all([
          canUseInternshipsApi() ? listInternships() : Promise.resolve([]),
          isAdminView && canUsePartnersApi() ? listPartners() : Promise.resolve([]),
          canUseDocumentsApi() ? listDocuments() : Promise.resolve([]),
          canUseNotificationsApi() ? listNotifications() : Promise.resolve([]),
          listTrainingAreas().catch(() => []),
        ]);

        const [{ data: applicationRows }, { data: vacancyRows }] = await Promise.all([
          canUseJobApplicationApi() && !isStudentView
            ? supabase
                .from("job_applications")
                .select("id, status, applied_at, reviewed_at, vacancy_id")
                .order("applied_at", { ascending: true })
            : Promise.resolve({ data: [] }),
          !isStudentView
            ? supabase
                .from("partner_vacancies")
                .select("id, status, total_slots, filled_slots, created_at")
                .order("created_at", { ascending: true })
            : Promise.resolve({ data: [] }),
        ]);

        let appsRows = [];
        if (isStudentView && user?.id && canUseJobApplicationApi()) {
          appsRows = await listStudentApplications(user.id);
        }

        if (!active) {
          return;
        }

        setInternships(internshipsRows);
        setPartners(partnersRows);
        setDocuments(documentsRows);
        setNotifications(notificationsRows);
        setMyApplications(appsRows);
        setTrainingAreas(areaRows ?? []);
        setAllApplications(applicationRows ?? []);
        setAllVacancies(vacancyRows ?? []);
      } catch {
        if (active) {
          setInternships([]);
          setPartners([]);
          setDocuments([]);
          setNotifications([]);
          setMyApplications([]);
          setTrainingAreas([]);
          setAllApplications([]);
          setAllVacancies([]);
          showToast("Falha ao carregar indicadores do dashboard.", "error");
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [showToast, isAdminView, isStudentView, user]);

  useEffect(() => {
    const isTestMode = import.meta.env.MODE === "test";
    if (isTestMode || !canUseStatisticsApi()) return;

    let active = true;
    setLoadingStatistics(true);
    fetchStatisticsMetrics()
      .then((metrics) => {
        if (!active) return;
        setStatisticsMetrics(metrics);
      })
      .catch(() => {
        if (!active) return;
        setStatisticsMetrics(null);
      })
      .finally(() => {
        if (active) setLoadingStatistics(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeInternships = internships.filter((item) => item.status === "active").length;
  const unassignedInternships = internships.filter((item) => !String(item.empresa ?? "").trim()).length;
  const criticalNotices = notifications.filter((item) => item.prioridade === "high" && !item.lida).length;
  const myPendingApps = myApplications.filter((a) => a.status === "PENDING").length;
  const myAcceptedApps = myApplications.filter((a) => a.status === "ACCEPTED").length;
  const inFlowDocuments = documents.filter((doc) => ["review", "pending"].includes(String(doc.estado ?? "").toLowerCase())).length;

  const documentFlowStats = useMemo(() => {
    const total = documents.length;
    const byStatus = {
      pending: 0,
      review: 0,
      published: 0,
      archived: 0,
      other: 0,
    };

    for (const doc of documents) {
      const status = String(doc.estado ?? "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
        byStatus[status] += 1;
      } else {
        byStatus.other += 1;
      }
    }

    const labels = {
      pending: "Pendente",
      review: "Em revisão",
      published: "Publicado",
      archived: "Arquivado",
      other: "Outros",
    };

    return Object.entries(byStatus)
      .map(([key, count]) => ({
        key,
        label: labels[key],
        count,
        percent: percentOf(total, count),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [documents]);

  const areasById = useMemo(() => {
    const map = new Map();
    for (const area of trainingAreas) {
      map.set(area.id, area);
    }
    return map;
  }, [trainingAreas]);

  // KPIs vary by role
  const kpis = useMemo(() => {
    if (isStudentView) {
      const interestedCompaniesCount = new Set(
        myApplications
          .filter((app) => ["PENDING", "ACCEPTED"].includes(String(app.status ?? "").toUpperCase()))
          .map((app) => String(app.partner?.empresa ?? "").trim())
          .filter(Boolean)
      ).size;

      return [
        {
          label: "Estágios ativos",
          icon: "person",
          value: String(myAcceptedApps),
          meta: "Situação atual dos teus estágios",
          search: "estagio ativo",
          to: "/estagios",
          action: `${t("common.open")} ${t("nav.internships")}`,
        },
        {
          label: "Candidaturas pendentes",
          icon: "hourglass_empty",
          value: String(myPendingApps),
          meta: "A aguardar resposta",
          search: "candidatura pendente",
          to: "/estagios",
          action: `${t("common.open")} ${t("nav.internships")}`,
        },
        {
          label: "Empresas interessadas",
          icon: "business_center",
          value: String(interestedCompaniesCount),
          meta: "Empresas com candidatura em andamento",
          search: "empresas interessadas",
          to: "/estagios",
          action: `${t("common.open")} ${t("nav.internships")}`,
        },
        {
          label: t("dashboard.kpi.critical"),
          icon: "notifications_active",
          value: String(criticalNotices),
          meta: t("dashboard.kpi.criticalMeta"),
          search: "alertas",
          to: "/notificacoes",
          action: `${t("common.open")} ${t("nav.notifications")}`,
        },
        {
          label: "Documentos em fluxo",
          icon: "description",
          value: String(inFlowDocuments),
          meta: "Pendentes de revisão/publicação",
          search: "documentos fluxo",
          to: "/documentos",
          action: `${t("common.open")} ${t("nav.documents")}`,
        },
      ];
    }

    return [
      {
        label: t("dashboard.kpi.active"),
        icon: "trending_up",
        value: String(activeInternships),
        meta: t("dashboard.kpi.activeMeta"),
        search: "total estagiarios ativos",
        to: "/estagios",
        action: `${t("common.open")} ${t("nav.internships")}`,
      },
      {
        label: t("dashboard.kpi.unassigned"),
        icon: "person_off",
        value: String(unassignedInternships),
        meta: t("dashboard.kpi.unassignedMeta"),
        search: "sem alocacao",
        to: "/turmas",
        action: `${t("common.open")} ${t("nav.classes")}`,
      },
      {
        label: t("dashboard.kpi.partners"),
        icon: "domain",
        value: String(partners.length),
        meta: t("dashboard.kpi.partnersMeta"),
        search: "parceiros ativos",
        to: "/parceiros",
        action: `${t("common.open")} ${t("nav.partners")}`,
      },
      {
        label: t("dashboard.kpi.critical"),
        icon: "warning",
        value: String(criticalNotices),
        meta: t("dashboard.kpi.criticalMeta"),
        search: "alertas criticos",
        to: "/notificacoes",
        action: `${t("common.open")} ${t("nav.notifications")}`,
      },
      {
        label: "Documentos em fluxo",
        icon: "description",
        value: String(inFlowDocuments),
        meta: "Pendentes de revisão/publicação",
        search: "documentos fluxo",
        to: "/documentos",
        action: `${t("common.open")} ${t("nav.documents")}`,
      },
    ];
  }, [
    isStudentView,
    myAcceptedApps,
    myPendingApps,
    myApplications,
    activeInternships,
    unassignedInternships,
    partners.length,
    criticalNotices,
    inFlowDocuments,
    t,
  ]);

  const areaDistribution = useMemo(
    () =>
      buildDistribution(
        internships,
        (row) => String(row.areaId ?? "no-area"),
        (row) => {
          const area = areasById.get(row.areaId);
          if (area?.name) return area.name;
          if (area?.code) return area.code;
          return "Sem área";
        }
      ),
    [internships, areasById]
  );

  const courseDistribution = useMemo(
    () =>
      buildDistribution(
        internships,
        (row) => String(row.curso ?? "N/D"),
        (row) => String(row.curso ?? "N/D").trim() || "N/D"
      ),
    [internships]
  );

  const classDistribution = useMemo(
    () =>
      buildDistribution(
        internships,
        (row) => `${String(row.turma ?? "N/D")}::${String(row.anoLetivo ?? "N/D")}`,
        (row) => {
          const turma = String(row.turma ?? "N/D").trim() || "N/D";
          const ano = String(row.anoLetivo ?? "N/D").trim() || "N/D";
          return `${turma} (${ano})`;
        }
      ),
    [internships]
  );

  const applicationStatusStats = useMemo(() => {
    const total = allApplications.length;
    const byStatus = {
      PENDING: 0,
      ACCEPTED: 0,
      REJECTED: 0,
      WITHDRAWN: 0,
      other: 0,
    };

    for (const app of allApplications) {
      const status = String(app.status ?? "").toUpperCase();
      if (Object.prototype.hasOwnProperty.call(byStatus, status)) {
        byStatus[status] += 1;
      } else {
        byStatus.other += 1;
      }
    }

    const labels = {
      PENDING: "Pendentes",
      ACCEPTED: "Aceites",
      REJECTED: "Rejeitadas",
      WITHDRAWN: "Retiradas",
      other: "Outras",
    };

    return Object.entries(byStatus)
      .map(([key, count]) => ({
        key,
        label: labels[key],
        count,
        percent: percentOf(total, count),
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [allApplications]);

  const applicationTrend30Days = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    const startMs = start.setHours(0, 0, 0, 0);

    const buckets = [
      { key: "w1", label: "Semana 1", count: 0 },
      { key: "w2", label: "Semana 2", count: 0 },
      { key: "w3", label: "Semana 3", count: 0 },
      { key: "w4", label: "Semana 4", count: 0 },
      { key: "w5", label: "Últimos 2 dias", count: 0 },
    ];

    for (const app of allApplications) {
      const appliedAt = Date.parse(app.applied_at ?? "");
      if (!Number.isFinite(appliedAt) || appliedAt < startMs) {
        continue;
      }
      const diffDays = Math.floor((appliedAt - startMs) / (1000 * 60 * 60 * 24));
      const index = diffDays >= 28 ? 4 : Math.floor(diffDays / 7);
      buckets[index].count += 1;
    }

    const peak = Math.max(...buckets.map((item) => item.count), 1);
    return buckets.map((item) => ({
      ...item,
      percent: percentOf(peak, item.count),
    }));
  }, [allApplications]);

  const vacancyOccupancy = useMemo(() => {
    const openVacancies = allVacancies.filter((vacancy) => String(vacancy.status ?? "").toUpperCase() === "OPEN");
    const totalSlots = openVacancies.reduce((sum, item) => sum + Number(item.total_slots ?? 0), 0);
    const filledSlots = openVacancies.reduce((sum, item) => sum + Number(item.filled_slots ?? 0), 0);
    const occupancyPercent = percentOf(totalSlots || 1, filledSlots);

    return {
      totalOpen: openVacancies.length,
      totalSlots,
      filledSlots,
      availableSlots: Math.max(0, totalSlots - filledSlots),
      occupancyPercent,
    };
  }, [allVacancies]);

  const comparativeKpis = useMemo(() => {
    const sourceRows = isStudentView ? myApplications : allApplications;
    const fieldName = "applied_at";

    const windows = [7, 30, 90].map((days) => {
      const current = countInRollingDays(sourceRows, fieldName, days);
      const previous = countInPreviousRollingDays(sourceRows, fieldName, days);
      return {
        days,
        current,
        previous,
        delta: deltaPercent(current, previous),
      };
    });

    return windows;
  }, [isStudentView, myApplications, allApplications]);

  const studentPipeline = useMemo(() => {
    if (!isStudentView) return [];

    return myApplications
      .slice()
      .sort((a, b) => Date.parse(b.applied_at ?? "") - Date.parse(a.applied_at ?? ""))
      .slice(0, 6)
      .map((app) => ({
        id: app.id,
        company: app.partner?.empresa ?? "Empresa",
        vacancy: app.vacancy?.title ?? "Vaga",
        status: String(app.status ?? "PENDING").toUpperCase(),
        appliedAt: app.applied_at ? new Date(app.applied_at).toLocaleDateString("pt-PT") : "-",
      }));
  }, [isStudentView, myApplications]);

  const recentActivity = notifications.slice(0, 3);
  const totalStudents = internships.length;

  const documentRows = useMemo(
    () => documents.filter((doc) => matchesSearch(query, `${doc.titulo} ${doc.tipo} ${doc.estado}`)),
    [documents, query]
  );

  const statisticsCards = useMemo(() => [
    {
      key: "completion",
      label: t("statistics.completion"),
      value: fmtPercent(statisticsMetrics?.completion, "88%"),
      icon: "task_alt",
      to: "/estagios",
      counts: statisticsMetrics
        ? `${statisticsMetrics.counts.active + statisticsMetrics.counts.completed} / ${statisticsMetrics.counts.total} ${t("statistics.ofTotal")}`
        : null,
    },
    {
      key: "employability",
      label: t("statistics.employability"),
      value: fmtPercent(statisticsMetrics?.employability, "71%"),
      icon: "trending_up",
      to: "/parceiros",
      counts: statisticsMetrics
        ? `${statisticsMetrics.counts.accepted} ${t("statistics.applications")} ${t("statistics.kpi.accepted").toLowerCase()}`
        : null,
    },
    {
      key: "dropout",
      label: t("statistics.dropout"),
      value: fmtPercent(statisticsMetrics?.dropout, "6%"),
      icon: "warning_amber",
      to: "/notificacoes",
      counts: statisticsMetrics
        ? `${statisticsMetrics.counts.risk} ${t("statistics.internships")} ${t("statistics.kpi.risk").toLowerCase()}`
        : null,
    },
    {
      key: "satisfaction",
      label: t("statistics.satisfaction"),
      value: statisticsMetrics?.satisfaction !== null ? fmtPercent(statisticsMetrics?.satisfaction, "92%") : "92%",
      icon: "sentiment_satisfied",
      to: "/avaliacoes",
      counts: null,
    },
  ], [statisticsMetrics, t]);

  const filteredStatisticsCards = useMemo(
    () => statisticsCards.filter((item) => matchesSearch(query, `${item.label} ${item.value}`)),
    [statisticsCards, query]
  );

  const statisticsBreakdown = statisticsMetrics?.counts ? [
    { label: t("statistics.kpi.active"), value: statisticsMetrics.counts.active, icon: "work", color: "#3b82f6" },
    { label: t("statistics.kpi.completed"), value: statisticsMetrics.counts.completed, icon: "task_alt", color: "#22c55e" },
    { label: t("statistics.kpi.risk"), value: statisticsMetrics.counts.risk, icon: "warning", color: "#f59e0b" },
    { label: t("statistics.kpi.accepted"), value: statisticsMetrics.counts.accepted, icon: "handshake", color: "#8b5cf6" },
  ] : [];

  const topArea = areaDistribution[0]?.label ?? "Sem área";
  const topCourse = courseDistribution[0]?.label ?? "Sem curso";
  const topClass = classDistribution[0]?.label ?? "Sem turma";

  const docColumns = [
    { key: "titulo", label: t("common.document") },
    { key: "tipo", label: t("common.type") },
    { key: "estado", label: t("common.status") },
    {
      key: "updatedAt",
      label: "Atualização",
      render: (row) => (row.updatedAt ? new Date(row.updatedAt).toLocaleString("pt-PT") : "-")
    },
    {
      key: "acao",
      label: t("common.action"),
      render: (row) => (
        <button className="btn ghost" type="button" onClick={() => showToast(t("dashboard.toast.download").replace("{name}", row.titulo))}>
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

      <section className="stats-grid dashboard-kpis">
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

      {!isStudentView && (
      <>
      <PanelSection
        title={t("statistics.title")}
        className="panel dashboard-panel"
        actions={(
          <span className="tag">
            <span className="material-icons-sharp">
              {loadingStatistics ? "sync" : statisticsMetrics ? "wifi" : "storage"}
            </span>
            {loadingStatistics ? t("statistics.loading") : statisticsMetrics ? t("statistics.liveData") : t("statistics.period")}
          </span>
        )}
      >
        <section className="stats-grid">
          {filteredStatisticsCards.map((item) => (
            <article className="stat-card" key={item.key}>
              <div className="stat-head">
                <span>{item.label}</span>
                <span className="material-icons-sharp">{item.icon}</span>
              </div>
              <h3>{item.value}</h3>
              {item.counts && <p className="meta" style={{ fontSize: "0.8rem", opacity: 0.65, marginTop: "0.25rem" }}>{item.counts}</p>}
              <div className="card-actions">
                <Link className="btn ghost" to={item.to} aria-label={`${t("common.open")} ${item.label}`}>
                  {t("common.open")} {item.label}
                </Link>
              </div>
            </article>
          ))}
        </section>

        {statisticsBreakdown.length > 0 && (
          <section className="panel-grid" style={{ marginTop: "1.5rem" }}>
            <div className="panel" style={{ padding: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 600 }}>
                {t("statistics.internships")} - {t("statistics.liveData")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1rem" }}>
                {statisticsBreakdown.map((item) => (
                  <div key={item.label} style={{ textAlign: "center", padding: "1rem", borderRadius: 8, background: "var(--surface-color, #f8fafc)" }}>
                    <span className="material-icons" style={{ color: item.color, fontSize: "1.75rem", display: "block" }}>{item.icon}</span>
                    <strong style={{ fontSize: "1.5rem", display: "block", lineHeight: 1.2 }}>{item.value}</strong>
                    <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </PanelSection>

      <section className="stats-grid dashboard-kpis dashboard-kpis-secondary">
        <article className="stat-card">
          <div className="stat-head">
            <span>Alunos registados</span>
            <span className="material-icons-sharp">groups</span>
          </div>
          <h3>{totalStudents}</h3>
          <p>Base total para distribuição estatística.</p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Área com maior peso</span>
            <span className="material-icons-sharp">donut_large</span>
          </div>
          <h3>{topArea}</h3>
          <p>{areaDistribution[0]?.percent ?? 0}% da base de alunos.</p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Curso dominante</span>
            <span className="material-icons-sharp">menu_book</span>
          </div>
          <h3>{topCourse}</h3>
          <p>{courseDistribution[0]?.percent ?? 0}% da base de alunos.</p>
        </article>
        <article className="stat-card">
          <div className="stat-head">
            <span>Turma dominante</span>
            <span className="material-icons-sharp">school</span>
          </div>
          <h3>{topClass}</h3>
          <p>{classDistribution[0]?.percent ?? 0}% da base de alunos.</p>
        </article>
        {role !== "STUDENT" && (
          <article className="stat-card">
            <div className="stat-head">
              <span>Taxa de ocupação das vagas</span>
              <span className="material-icons-sharp">query_stats</span>
            </div>
            <h3>{vacancyOccupancy.occupancyPercent}%</h3>
            <p>
              {vacancyOccupancy.filledSlots}/{vacancyOccupancy.totalSlots} posições abertas preenchidas.
            </p>
          </article>
        )}
        {comparativeKpis.map((item) => (
          <article className="stat-card" key={`cmp-${item.days}`}>
            <div className="stat-head">
              <span>Comparativo {item.days} dias</span>
              <span className="material-icons-sharp">insights</span>
            </div>
            <h3>{item.current}</h3>
            <p>
              {item.delta >= 0 ? "+" : ""}{item.delta}% vs período anterior ({item.previous}).
            </p>
          </article>
        ))}
      </section>
      </>
      )}

      {isStudentView && (
        <section className="panel-grid dashboard-panels">
          <PanelSection title="O teu progresso" className="panel dashboard-panel">
            {studentPipeline.length ? (
              <div className="list">
                {studentPipeline.map((item) => (
                  <div className="list-item" key={item.id}>
                    <strong>{item.company} - {item.vacancy}</strong>
                    <span className="meta">{item.status} · {item.appliedAt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta">Sem candidaturas recentes. Atualiza o teu perfil e acompanha os teus estágios.</p>
            )}
          </PanelSection>

          <PanelSection title={t("dashboard.recentActivity")} className="panel dashboard-panel">
            <div className="list">
              {recentActivity.length ? (
                recentActivity.map((item) => (
                  <div className="list-item" key={item.id}>
                    <strong>{item.title}</strong>
                    <span className="meta">{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-PT") : "-"}</span>
                  </div>
                ))
              ) : (
                <p className="meta">Sem atividade recente.</p>
              )}
            </div>
          </PanelSection>
        </section>
      )}

      {!isStudentView && (
      <section className="panel-grid dashboard-panels">
        {role !== "STUDENT" && (
          <PanelSection title="Pulso operacional de candidaturas" className="panel dashboard-panel">
            <div className="dashboard-distribution-grid">
              <section className="dashboard-distribution-card">
                <h3>Tendência de candidaturas (30 dias)</h3>
                <p className="meta">Evolução semanal das submissões recentes</p>
                <div className="bars">
                  {applicationTrend30Days.map((item, index) => (
                    <div className="bar" key={item.key}>
                      <strong>{item.label}</strong>
                      <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                        <span style={{ width: `${item.percent}%` }} />
                      </div>
                      <small className="meta">{item.count} candidatura(s)</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="dashboard-distribution-card">
                <h3>Pipeline de estado das candidaturas</h3>
                <p className="meta">Distribuição global por estado atual</p>
                <div className="bars">
                  {applicationStatusStats.length ? (
                    applicationStatusStats.map((item, index) => (
                      <div className="bar" key={item.key}>
                        <strong>{item.label}</strong>
                        <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                          <span style={{ width: `${item.percent}%` }} />
                        </div>
                        <small className="meta">{item.count} candidatura(s) · {item.percent}%</small>
                      </div>
                    ))
                  ) : (
                    <p className="meta">Sem candidaturas para calcular o pipeline.</p>
                  )}
                </div>
              </section>

              <section className="dashboard-distribution-card">
                <h3>Capacidade de vagas abertas</h3>
                <p className="meta">Estado atual das vagas publicadas por empresas</p>
                <div className="list">
                  <div className="list-item">
                    <strong>Vagas abertas</strong>
                    <span className="meta">{vacancyOccupancy.totalOpen}</span>
                  </div>
                  <div className="list-item">
                    <strong>Posições totais</strong>
                    <span className="meta">{vacancyOccupancy.totalSlots}</span>
                  </div>
                  <div className="list-item">
                    <strong>Preenchidas</strong>
                    <span className="meta">{vacancyOccupancy.filledSlots}</span>
                  </div>
                  <div className="list-item">
                    <strong>Disponíveis</strong>
                    <span className="meta">{vacancyOccupancy.availableSlots}</span>
                  </div>
                </div>
              </section>
            </div>
          </PanelSection>
        )}

        <PanelSection title={t("dashboard.distribution")} className="panel dashboard-panel">
          <div className="dashboard-distribution-grid">
            <section className="dashboard-distribution-card">
              <h3>Distribuição por Área</h3>
              <p className="meta">Percentagem global por área de formação</p>
              <div className="bars">
                {areaDistribution.length ? (
                  areaDistribution.slice(0, 8).map((item, index) => (
                    <div className="bar" key={item.key}>
                      <strong>{item.label}</strong>
                      <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                        <span style={{ width: `${item.percent}%` }} />
                      </div>
                      <small className="meta">{item.count} aluno(s) · {item.percent}%</small>
                    </div>
                  ))
                ) : (
                  <p className="meta">Sem dados de área ainda.</p>
                )}
              </div>
            </section>

            <section className="dashboard-distribution-card">
              <h3>Distribuição por Curso</h3>
              <p className="meta">Percentagem geral por curso</p>
              <div className="bars">
                {courseDistribution.length ? (
                  courseDistribution.slice(0, 8).map((item, index) => (
                    <div className="bar" key={item.key}>
                      <strong>{item.label}</strong>
                      <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                        <span style={{ width: `${item.percent}%` }} />
                      </div>
                      <small className="meta">{item.count} aluno(s) · {item.percent}%</small>
                    </div>
                  ))
                ) : (
                  <p className="meta">Sem dados de curso ainda.</p>
                )}
              </div>
            </section>

            <section className="dashboard-distribution-card">
              <h3>Distribuição por Turma</h3>
              <p className="meta">Percentagem geral por turma</p>
              <div className="bars">
                {classDistribution.length ? (
                  classDistribution.slice(0, 8).map((item, index) => (
                    <div className="bar" key={item.key}>
                      <strong>{item.label}</strong>
                      <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                        <span style={{ width: `${item.percent}%` }} />
                      </div>
                      <small className="meta">{item.count} aluno(s) · {item.percent}%</small>
                    </div>
                  ))
                ) : (
                  <p className="meta">Sem dados de turma ainda.</p>
                )}
              </div>
            </section>
          </div>
        </PanelSection>

        <PanelSection title={t("dashboard.recentActivity")} className="panel dashboard-panel">
          <div className="list">
            {recentActivity.length ? (
              recentActivity.map((item) => (
                <div className="list-item" key={item.id}>
                  <strong>{item.title}</strong>
                  <span className="meta">{item.createdAt ? new Date(item.createdAt).toLocaleString("pt-PT") : "-"}</span>
                </div>
              ))
            ) : (
              <p className="meta">Sem atividade recente.</p>
            )}
          </div>
        </PanelSection>
      </section>
      )}

      <PanelSection title={t("dashboard.inProgressDocs")} className="panel dashboard-documents">
        <div className="dashboard-documents-summary">
          <p className="meta">
            Documentos acessíveis segundo as suas permissões: <strong>{documentRows.length}</strong>
          </p>
          <button type="button" className="btn primary" onClick={() => setShowDocumentsModal(true)}>
            <span className="material-icons-sharp">folder_open</span>
            Ver documentos
          </button>
        </div>
        <div className="bars" style={{ marginTop: "0.8rem" }}>
          {documentFlowStats.length ? (
            documentFlowStats.map((item, index) => (
              <div className="bar" key={item.key}>
                <strong>{item.label}</strong>
                <div className={`line ${index % 2 === 1 ? "line-accent" : ""}`}>
                  <span style={{ width: `${item.percent}%` }} />
                </div>
                <small className="meta">{item.count} documento(s) · {item.percent}%</small>
              </div>
            ))
          ) : (
            <p className="meta">Sem documentos para calcular fluxo.</p>
          )}
        </div>
      </PanelSection>

      {showDocumentsModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Lista de documentos">
          <div className="modal-content dashboard-documents-modal">
            <div className="dashboard-documents-modal-head">
              <h3>Documentos sob sua permissão</h3>
              <button type="button" className="btn ghost" onClick={() => setShowDocumentsModal(false)}>
                Fechar
              </button>
            </div>
            <DataTable columns={docColumns} rows={documentRows} emptyText="Nenhum documento encontrado para o seu escopo." />
          </div>
        </div>
      )}
    </main>
  );
}
