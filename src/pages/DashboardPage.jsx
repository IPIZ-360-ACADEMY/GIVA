import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import { useAuth, useAccessProfile } from "../contexts/AuthContext.jsx";
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

function getTone(icon) {
  if (["warning", "warning_amber", "error", "notifications_active"].includes(icon)) return "danger";
  if (["trending_up", "task_alt", "sentiment_satisfied"].includes(icon)) return "success";
  if (["domain", "business_center"].includes(icon)) return "info";
  if (["person_off", "hourglass_empty"].includes(icon)) return "warning";
  return "primary";
}

function relativeTime(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - Date.parse(dateStr);
  if (!Number.isFinite(diff) || diff < 0) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Agora mesmo";
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `Há ${days} dia${days > 1 ? "s" : ""}` : new Date(dateStr).toLocaleDateString("pt-PT");
}

function DistBar({ item, tone = "primary", compact = false }) {
  return (
    <div className={`dash-dist-row${compact ? " dash-dist-row--compact" : ""}`}>
      <div className="dash-dist-label">{item.label}</div>
      <div className="dash-dist-track">
        <div className={`dash-dist-fill dash-dist-fill--${tone}`} style={{ width: `${item.percent}%` }} />
      </div>
      <div className="dash-dist-right">
        <span className={`dash-dist-pct dash-dist-pct--${tone}`}>{item.percent}%</span>
        {!compact && <span className="dash-dist-count">{item.count}</span>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { query, currentDate, showToast, t } = useOutletContext();
  const { user } = useAuth();
  const { isStudentUser: isStudentView, isAdmin: isAdminView } = useAccessProfile();

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
      {/* Hero */}
      <div className="dash-hero">
        <div className="dash-hero-inner">
          <div className="dash-hero-badge">
            <span className="material-icons-sharp">hub</span>
          </div>
          <div className="dash-hero-text">
            <h1 className="dash-hero-title">{t("dashboard.title")}</h1>
            <p className="dash-hero-sub">{t("dashboard.description")}</p>
          </div>
          <div className="dash-hero-meta">
            <span className="tag">
              <span className="material-icons-sharp">calendar_month</span>
              {currentDate}
            </span>
            <span className="tag tag-live">
              <span className="material-icons-sharp">fact_check</span>
              {t("dashboard.auditedData")}
            </span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <section className="dash-kpi-grid">
        {kpis
          .filter((item) => matchesSearch(query, item.search))
          .map((item, index) => {
            const tone = getTone(item.icon);
            const cmp = index === 0 ? comparativeKpis[0] : null;
            return (
              <article className={`dash-kpi-card dash-kpi-card--${tone}`} key={item.label}>
                <div className="dash-kpi-top">
                  <span className={`dash-kpi-icon dash-kpi-icon--${tone}`}>
                    <span className="material-icons-sharp">{item.icon}</span>
                  </span>
                  {cmp != null && (
                    <span className={`dash-kpi-delta ${cmp.delta >= 0 ? "dash-kpi-delta--up" : "dash-kpi-delta--down"}`}>
                      {cmp.delta >= 0 ? "▲" : "▼"} {Math.abs(cmp.delta)}%
                    </span>
                  )}
                </div>
                <div className="dash-kpi-value">{item.value}</div>
                <div className="dash-kpi-label">{item.label}</div>
                <p className="dash-kpi-meta">{item.meta}</p>
                <Link className="dash-kpi-link" to={item.to}>{item.action}</Link>
              </article>
            );
          })}
      </section>

      {!isStudentView && (
        <>
          <div className="dash-body-grid">
            {/* Distributions */}
            <div className="dash-col-main">
              <div className="dash-panel">
                <div className="dash-panel-head">
                  <span className="material-icons-sharp">bar_chart</span>
                  <h2>{t("dashboard.distribution")}</h2>
                  <span className="dash-panel-badge">{totalStudents} alunos</span>
                </div>
                <div className="dash-dist-columns">
                  <div className="dash-dist-col">
                    <div className="dash-dist-col-title">
                      <span className="material-icons-sharp">category</span> Por Área
                    </div>
                    {areaDistribution.length ? (
                      areaDistribution.slice(0, 7).map((item) => (
                        <DistBar key={item.key} item={item} tone="primary" />
                      ))
                    ) : (
                      <p className="meta">Sem dados de área.</p>
                    )}
                  </div>
                  <div className="dash-dist-col">
                    <div className="dash-dist-col-title">
                      <span className="material-icons-sharp">menu_book</span> Por Curso
                    </div>
                    {courseDistribution.length ? (
                      courseDistribution.slice(0, 7).map((item) => (
                        <DistBar key={item.key} item={item} tone="info" />
                      ))
                    ) : (
                      <p className="meta">Sem dados de curso.</p>
                    )}
                  </div>
                  <div className="dash-dist-col">
                    <div className="dash-dist-col-title">
                      <span className="material-icons-sharp">school</span> Por Turma
                    </div>
                    {classDistribution.length ? (
                      classDistribution.slice(0, 7).map((item) => (
                        <DistBar key={item.key} item={item} tone="accent" />
                      ))
                    ) : (
                      <p className="meta">Sem dados de turma.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar: activity + docflow */}
            <div className="dash-col-side">
              <div className="dash-panel dash-activity-panel">
                <div className="dash-panel-head">
                  <span className="material-icons-sharp">notifications</span>
                  <h2>{t("dashboard.recentActivity")}</h2>
                </div>
                <div className="dash-activity-list">
                  {recentActivity.length ? (
                    recentActivity.map((item) => (
                      <div className="dash-activity-item" key={item.id}>
                        <div className="dash-activity-dot" />
                        <div className="dash-activity-body">
                          <div className="dash-activity-title">{item.title ?? item.mensagem ?? "Notificação"}</div>
                          <div className="dash-activity-time">{relativeTime(item.createdAt ?? item.created_at)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="meta" style={{ padding: "0.75rem 0" }}>Sem atividade recente.</p>
                  )}
                </div>
                <Link to="/notificacoes" className="dash-panel-footer-link">
                  <span className="material-icons-sharp">chevron_right</span> Ver todas as atividades
                </Link>
              </div>

              <div className="dash-panel dash-docflow-panel">
                <div className="dash-panel-head">
                  <span className="material-icons-sharp">description</span>
                  <h2>{t("dashboard.inProgressDocs")}</h2>
                </div>
                <div className="dash-docflow-hero">
                  <div className="dash-docflow-count">{documentRows.length}</div>
                  <div className="dash-docflow-label">Documentos acessíveis</div>
                </div>
                {documentFlowStats.slice(0, 4).map((item, index) => (
                  <DistBar key={item.key} item={item} tone={index === 0 ? "warning" : "primary"} compact />
                ))}
                <button type="button" className="dash-panel-footer-link" onClick={() => setShowDocumentsModal(true)}>
                  <span className="material-icons-sharp">folder_open</span> Abrir documentos
                </button>
              </div>
            </div>
          </div>

          {/* Operational pulse */}
          <div className="dash-panel dash-pulse-panel">
            <div className="dash-panel-head">
              <span className="material-icons-sharp">insights</span>
              <h2>Pulso operacional de candidaturas</h2>
              <span className="dash-panel-badge">{allApplications.length} total</span>
            </div>
            <div className="dash-pulse-grid">
              <div className="dash-pulse-card">
                <div className="dash-pulse-card-title">Tendência de candidaturas</div>
                <div className="dash-pulse-bars">
                  {applicationTrend30Days.map((item, i) => (
                    <div className="dash-pulse-bar" key={item.key}>
                      <div className="dash-pulse-bar-track">
                        <div
                          className={`dash-pulse-bar-fill dash-pulse-bar-fill--${i % 2 === 0 ? "primary" : "accent"}`}
                          style={{ height: `${Math.max(item.percent, 4)}%` }}
                        />
                      </div>
                      <div className="dash-pulse-bar-label">{item.label.replace("Semana ", "S").replace("Últimos 2 dias", "Rec.")}</div>
                      <div className="dash-pulse-bar-value">{item.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="dash-pulse-card">
                <div className="dash-pulse-card-title">Pipeline de candidaturas</div>
                <div className="dash-pipeline-list">
                  {applicationStatusStats.length ? (
                    applicationStatusStats.map((item) => (
                      <div className="dash-pipeline-row" key={item.key}>
                        <span className={`dash-pipeline-dot dash-pipeline-dot--${item.key.toLowerCase()}`} />
                        <span className="dash-pipeline-label">{item.label}</span>
                        <div className="dash-pipeline-track">
                          <div
                            className={`dash-pipeline-fill dash-pipeline-fill--${item.key.toLowerCase()}`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                        <span className="dash-pipeline-value">{item.count}</span>
                      </div>
                    ))
                  ) : (
                    <p className="meta">Sem candidaturas.</p>
                  )}
                </div>
              </div>

              <div className="dash-pulse-card">
                <div className="dash-pulse-card-title">Capacidade de vagas</div>
                <div className="dash-vacancy-stat">
                  <div className="dash-vacancy-ring">
                    <div className="dash-vacancy-ring-value">{vacancyOccupancy.occupancyPercent}%</div>
                    <div className="dash-vacancy-ring-label">Ocupação</div>
                  </div>
                  <div className="dash-vacancy-details">
                    <div className="dash-vacancy-row"><span>Vagas abertas</span><strong>{vacancyOccupancy.totalOpen}</strong></div>
                    <div className="dash-vacancy-row"><span>Posições totais</span><strong>{vacancyOccupancy.totalSlots}</strong></div>
                    <div className="dash-vacancy-row dash-vacancy-row--fill"><span>Preenchidas</span><strong>{vacancyOccupancy.filledSlots}</strong></div>
                    <div className="dash-vacancy-row dash-vacancy-row--avail"><span>Disponíveis</span><strong>{vacancyOccupancy.availableSlots}</strong></div>
                  </div>
                </div>
                <div className="dash-vacancy-track">
                  <div className="dash-vacancy-fill" style={{ width: `${vacancyOccupancy.occupancyPercent}%` }} />
                </div>
              </div>

              <div className="dash-pulse-card">
                <div className="dash-pulse-card-title">Análise comparativa</div>
                <div className="dash-cmp-list">
                  {comparativeKpis.map((item) => (
                    <div className="dash-cmp-row" key={item.days}>
                      <div className="dash-cmp-period">Comparativo {item.days} dias</div>
                      <div className="dash-cmp-curr">{item.current}</div>
                      <div className={`dash-cmp-delta ${item.delta >= 0 ? "dash-cmp-delta--up" : "dash-cmp-delta--down"}`}>
                        {item.delta >= 0 ? "▲" : "▼"} {Math.abs(item.delta)}%
                      </div>
                      <div className="dash-cmp-prev">vs {item.previous} ant.</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Inteligência operacional */}
          {(filteredStatisticsCards.length > 0 || loadingStatistics) && (
            <div className="dash-panel">
              <div className="dash-panel-head">
                <span className="material-icons-sharp">psychology</span>
                <h2>Inteligência operacional</h2>
                <span className="dash-panel-badge">
                  <span className="material-icons-sharp" style={{ fontSize: "0.85rem", verticalAlign: "middle" }}>
                    {loadingStatistics ? "sync" : statisticsMetrics ? "wifi" : "storage"}
                  </span>{" "}
                  {loadingStatistics ? t("statistics.loading") : statisticsMetrics ? t("statistics.liveData") : t("statistics.period")}
                </span>
              </div>
              <div className="dash-intel-grid">
                {filteredStatisticsCards.map((item) => (
                  <article className="dash-intel-card" key={item.key}>
                    <span className="material-icons-sharp dash-intel-icon">{item.icon}</span>
                    <div className="dash-intel-value">{item.value}</div>
                    <div className="dash-intel-label">{item.label}</div>
                    {item.counts && <div className="dash-intel-counts">{item.counts}</div>}
                    <Link className="dash-intel-link" to={item.to}>{t("common.open")} →</Link>
                  </article>
                ))}
                {statisticsBreakdown.map((item) => (
                  <article className="dash-intel-card" key={item.label}>
                    <span className="material-icons dash-intel-icon" style={{ color: item.color }}>{item.icon}</span>
                    <div className="dash-intel-value">{item.value}</div>
                    <div className="dash-intel-label">{item.label}</div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Student view */}
      {isStudentView && (
        <div className="dash-body-grid">
          <div className="dash-col-main">
            <div className="dash-panel">
              <div className="dash-panel-head">
                <span className="material-icons-sharp">route</span>
                <h2>O teu progresso</h2>
              </div>
              {studentPipeline.length ? (
                <div className="dash-student-pipeline">
                  {studentPipeline.map((item) => (
                    <div className="dash-student-row" key={item.id}>
                      <span className={`dash-student-status dash-student-status--${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                      <div className="dash-student-info">
                        <strong>{item.company}</strong>
                        <span>{item.vacancy}</span>
                      </div>
                      <span className="dash-student-date">{item.appliedAt}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="meta" style={{ padding: "1rem 0" }}>
                  Sem candidaturas recentes. Atualiza o teu perfil e acompanha os teus estágios.
                </p>
              )}
            </div>
          </div>
          <div className="dash-col-side">
            <div className="dash-panel dash-activity-panel">
              <div className="dash-panel-head">
                <span className="material-icons-sharp">notifications</span>
                <h2>{t("dashboard.recentActivity")}</h2>
              </div>
              <div className="dash-activity-list">
                {recentActivity.length ? (
                  recentActivity.map((item) => (
                    <div className="dash-activity-item" key={item.id}>
                      <div className="dash-activity-dot" />
                      <div className="dash-activity-body">
                        <div className="dash-activity-title">{item.title ?? item.mensagem ?? "Notificação"}</div>
                        <div className="dash-activity-time">{relativeTime(item.createdAt ?? item.created_at)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="meta" style={{ padding: "0.75rem 0" }}>Sem atividade recente.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents modal */}
      {showDocumentsModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Lista de documentos">
          <div className="modal-content dashboard-documents-modal">
            <div className="dashboard-documents-modal-head">
              <h3>Documentos sob sua permissão</h3>
              <button type="button" className="btn ghost" onClick={() => setShowDocumentsModal(false)}>
                Fechar
              </button>
            </div>
            <DataTable
              columns={docColumns}
              rows={documentRows}
              emptyText="Nenhum documento encontrado para o seu escopo."
            />
          </div>
        </div>
      )}
    </main>
  );
}
