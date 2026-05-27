import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import "../styles/company-dashboard.css";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getMyCompanyAccount } from "../services/authService.js";
import { createPartner, getMyPartner } from "../services/partnersService.js";
import {
  listPartnerApplications,
  acceptJobApplication,
  rejectJobApplication,
} from "../services/jobApplicationService.js";
import {
  createPartnerVacancy,
  listPartnerVacancies,
  updatePartnerVacancyStatus,
} from "../services/vacanciesService.js";
import { notifyEligibleStudentsForVacancyPublished } from "../services/notificationsService.js";
import {
  insertCompanyBatchAuditRows,
  listCompanyBatchAuditRows,
} from "../services/companyBatchAuditService.js";
import InternDetailPanel from "../components/InternDetailPanel.jsx";
import PageHeader from "../components/PageHeader.jsx";
import CompanyOverviewPanel from "../components/CompanyOverviewPanel.jsx";
import InternManagementPanel from "../components/InternManagementPanel.jsx";
import { listTrainingAreas } from "../services/trainingAreaService.js";
import {
  getInternPhaseMeta,
  getPendingDays,
  getSlaMeta,
  parseSafeDate,
  resolveInternAreaName,
  resolveInternSectorName,
} from "./company-dashboard/utils.js";

export default function CompanyDashboardPage() {
  const { t, showToast } = useOutletContext();
  const { authProfile, user } = useAuth();
  const publishCardRef = useRef(null);
  const vacanciesListRef = useRef(null);

  const [partner, setPartner] = useState(null);
  const [companyAccount, setCompanyAccount] = useState(null);
  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [trainingAreas, setTrainingAreas] = useState([]);
  const [activeTab, setActiveTab] = useState("vagas");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [actionTarget, setActionTarget] = useState(null); // { id, action: "accept"|"reject", notes: "" }
  const [publishSlots, setPublishSlots] = useState("1");
  const [publishTitle, setPublishTitle] = useState("Estagio Profissional");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [togglingVacancyId, setTogglingVacancyId] = useState(null);
  const [vacancyFilter, setVacancyFilter] = useState("ALL");
  const [vacancyToggleTarget, setVacancyToggleTarget] = useState(null);
  const [applicationSearch, setApplicationSearch] = useState("");
  const [applicationSort, setApplicationSort] = useState("recent");
  const [selectedApplicationIds, setSelectedApplicationIds] = useState(new Set());
  const [batchRejectReason, setBatchRejectReason] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchConfirmTarget, setBatchConfirmTarget] = useState(null);
  const [batchReportRows, setBatchReportRows] = useState([]);
  const [lastBatchSummary, setLastBatchSummary] = useState(null);
  const [internSearch, setInternSearch] = useState("");
  const [internSectorFilter, setInternSectorFilter] = useState("all");
  const [internAreaFilter, setInternAreaFilter] = useState("all");
  const [internPhaseFilter, setInternPhaseFilter] = useState("all");
  const [internSortMode, setInternSortMode] = useState("newest");
  const [expandedInternId, setExpandedInternId] = useState(null);
  const [vacancySearch, setVacancySearch] = useState("");
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState("ALL");
  const [vacancySortMode, setVacancySortMode] = useState("recent");
  const [slaQuickFilter, setSlaQuickFilter] = useState("all");
  const [reportBatchFilter, setReportBatchFilter] = useState("");
  const [reportActionFilter, setReportActionFilter] = useState("all");
  const [reportResultFilter, setReportResultFilter] = useState("all");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const reportPageSize = 8;

  useEffect(() => {
    load();
  }, []);



  useEffect(() => {
    setReportPage(1);
  }, [
    batchReportRows.length,
    reportBatchFilter,
    reportActionFilter,
    reportResultFilter,
    reportDateFrom,
    reportDateTo,
  ]);

  async function load() {
    setLoading(true);

    try {
      const [myAccount, p, areas] = await Promise.all([
        getMyCompanyAccount().catch(() => null),
        getMyPartner().catch(() => null),
        listTrainingAreas().catch(() => []),
      ]);

      setCompanyAccount(myAccount);
      setPartner(p);
      setTrainingAreas(areas || []);

      if (p?.id) {
        const [apps, publishedVacancies, persistedAuditRows] = await Promise.all([
          listPartnerApplications(p.id).catch(() => []),
          listPartnerVacancies(p.id, { includeClosed: true }).catch(() => []),
          listCompanyBatchAuditRows(p.id, { limit: 500 }).catch(() => []),
        ]);

        setApplications(apps || []);
        setVacancies(publishedVacancies || []);
        setBatchReportRows(persistedAuditRows || []);
      } else {
        setVacancies([]);
        setApplications([]);
        setBatchReportRows([]);
        setLastBatchSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishVacancies() {
    if (!partner?.id || publishing) {
      return;
    }

    const slotsToAdd = Number(publishSlots);
    if (!Number.isFinite(slotsToAdd) || slotsToAdd <= 0) {
      showToast("Informe uma quantidade valida de vagas.", "error");
      return;
    }

    const title = String(publishTitle ?? "").trim();
    if (!title) {
      showToast("Informe o tÃ­tulo da vaga.", "error");
      return;
    }

    setPublishing(true);
    const result = await createPartnerVacancy({
      partner_id: partner.id,
      title,
      description: publishDescription,
      total_slots: Math.floor(slotsToAdd),
    }).catch(() => null);

    if (!result) {
      showToast("NÃ£o foi possÃ­vel publicar vagas.", "error");
      setPublishing(false);
      return;
    }

    showToast("Vaga publicada com sucesso.", "success");
    const notifyResult = await notifyEligibleStudentsForVacancyPublished({
      vacancyId: result.id,
      actorId: user?.id ?? null,
      partnerId: partner.id,
      vacancyTitle: result.title,
      partnerName: partner.empresa,
      totalSlots: result.total_slots,
    }).catch(() => null);

    if (notifyResult?.sent > 0) {
      showToast(`NotificaÃ§Ã£o enviada para ${notifyResult.sent} aluno(s) elegÃ­vel(is).`, "success");
    }

    setPublishTitle("EstÃ¡gio Profissional");
    setPublishDescription("");
    setPublishSlots("1");
    await load();
    setPublishing(false);
  }

  async function handleToggleVacancyStatus(vacancy) {
    if (!vacancy?.id || togglingVacancyId) {
      return;
    }

    const nextStatus = vacancy.status === "OPEN" ? "CLOSED" : "OPEN";

    if (nextStatus === "CLOSED") {
      const pendingForVacancy = applications.filter(
        (app) => app.vacancy_id === vacancy.id && app.status === "PENDING"
      ).length;

      if (pendingForVacancy > 0) {
        showToast("NÃ£o Ã© possÃ­vel fechar a vaga: existem candidaturas pendentes.", "error");
        return;
      }
    }

    setTogglingVacancyId(vacancy.id);
    const result = await updatePartnerVacancyStatus(vacancy.id, nextStatus).catch(() => null);

    if (!result) {
      showToast("NÃ£o foi possÃ­vel atualizar o estado da vaga.", "error");
      setTogglingVacancyId(null);
      return;
    }

    showToast(nextStatus === "OPEN" ? "Vaga reaberta com sucesso." : "Vaga fechada com sucesso.", "success");
    await load();
    setTogglingVacancyId(null);
  }

  async function handleAccept() {
    if (!actionTarget) return;
    const targetApplication = applications.find((app) => app.id === actionTarget.id);
    const targetVacancy = vacancies.find((vacancy) => vacancy.id === targetApplication?.vacancy_id);

    if (!targetVacancy || targetVacancy.status !== "OPEN") {
      showToast("Esta vaga nÃ£o estÃ¡ aberta para novas aceitaÃ§Ãµes.", "error");
      setActionTarget(null);
      return;
    }

    if (Number(targetVacancy.available_slots ?? 0) <= 0) {
      showToast("Esta vaga jÃ¡ nÃ£o possui vagas disponÃ­veis.", "error");
      setActionTarget(null);
      return;
    }

    setProcessingId(actionTarget.id);
    const ok = await acceptJobApplication(actionTarget.id, actionTarget.notes || "");
    if (ok) {
      showToast(t("companyDashboard.toast.accepted"), "success");
      await load();
    } else {
      showToast(t("companyDashboard.toast.error"), "error");
    }
    setProcessingId(null);
    setActionTarget(null);
  }

  async function handleReject() {
    if (!actionTarget) return;
    if ((actionTarget.notes || "").trim().length < 10) {
      showToast("Informe um motivo de rejeiÃ§Ã£o com pelo menos 10 caracteres.", "error");
      return;
    }
    setProcessingId(actionTarget.id);
    const ok = await rejectJobApplication(actionTarget.id, actionTarget.notes || "");
    if (ok) {
      showToast(t("companyDashboard.toast.rejected"), "success");
      await load();
    } else {
      showToast(t("companyDashboard.toast.error"), "error");
    }
    setProcessingId(null);
    setActionTarget(null);
  }

  async function handleBatchDecision(action) {
    if (batchProcessing) return;

    const selectedPendingApps = sortedTabApps.filter((app) => selectedApplicationIds.has(app.id));
    if (!selectedPendingApps.length) {
      showToast("Selecione pelo menos uma candidatura pendente.", "error");
      return;
    }

    const rejectReason = batchRejectReason.trim();
    if (action === "reject" && rejectReason.length < 10) {
      showToast("Informe um motivo de rejeiÃ§Ã£o com pelo menos 10 caracteres.", "error");
      return;
    }

    const availabilityMap = new Map(
      vacancies.map((vacancy) => [
        vacancy.id,
        {
          status: vacancy.status,
          available: Number(vacancy.available_slots ?? 0),
        },
      ])
    );

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const processedAt = new Date().toISOString();
    const processedBy = authProfile?.displayName || authProfile?.email || "Utilizador";
    const processedById = user?.id ?? null;
    const batchId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextReportRows = [];

    setBatchProcessing(true);
    for (const app of selectedPendingApps) {
      const studentName = app.student?.full_name || "Sem nome";
      const vacancyTitle = app.vacancy?.title || "Sem vaga";
      if (action === "accept") {
        const vacancyState = availabilityMap.get(app.vacancy_id);
        if (!vacancyState || vacancyState.status !== "OPEN" || vacancyState.available <= 0) {
          skippedCount += 1;
          nextReportRows.push({
            batchId,
            processedAt,
            processedBy,
            processedById,
            action,
            studentName,
            vacancyTitle,
            result: "SKIPPED",
            reason: "Vaga fechada ou sem disponibilidade",
            applicationId: app.id,
            vacancyId: app.vacancy_id,
            partnerId: partner?.id ?? null,
          });
          continue;
        }
        const ok = await acceptJobApplication(app.id, "Aprovada em aÃ§Ã£o em lote.");
        if (ok) {
          successCount += 1;
          vacancyState.available -= 1;
          nextReportRows.push({
            batchId,
            processedAt,
            processedBy,
            processedById,
            action,
            studentName,
            vacancyTitle,
            result: "SUCCESS",
            reason: "Aprovada em aÃ§Ã£o em lote",
            applicationId: app.id,
            vacancyId: app.vacancy_id,
            partnerId: partner?.id ?? null,
          });
        } else {
          errorCount += 1;
          nextReportRows.push({
            batchId,
            processedAt,
            processedBy,
            processedById,
            action,
            studentName,
            vacancyTitle,
            result: "ERROR",
            reason: "Falha ao aceitar candidatura",
            applicationId: app.id,
            vacancyId: app.vacancy_id,
            partnerId: partner?.id ?? null,
          });
        }
      } else {
        const ok = await rejectJobApplication(app.id, rejectReason);
        if (ok) {
          successCount += 1;
          nextReportRows.push({
            batchId,
            processedAt,
            processedBy,
            processedById,
            action,
            studentName,
            vacancyTitle,
            result: "SUCCESS",
            reason: rejectReason,
            applicationId: app.id,
            vacancyId: app.vacancy_id,
            partnerId: partner?.id ?? null,
          });
        } else {
          errorCount += 1;
          nextReportRows.push({
            batchId,
            processedAt,
            processedBy,
            processedById,
            action,
            studentName,
            vacancyTitle,
            result: "ERROR",
            reason: "Falha ao rejeitar candidatura",
            applicationId: app.id,
            vacancyId: app.vacancy_id,
            partnerId: partner?.id ?? null,
          });
        }
      }
    }

    let auditPersisted = true;
    if (partner?.id && nextReportRows.length > 0 && processedById) {
      const payload = nextReportRows.map((row) => ({
        batch_id: row.batchId,
        partner_id: partner.id,
        application_id: row.applicationId,
        vacancy_id: row.vacancyId,
        processed_by: processedById,
        processed_by_name: row.processedBy,
        action: row.action,
        result: row.result,
        reason: row.reason,
        student_name: row.studentName,
        vacancy_title: row.vacancyTitle,
        processed_at: row.processedAt,
        metadata: {
          source: "company-dashboard-batch",
        },
      }));

      auditPersisted = await insertCompanyBatchAuditRows(payload);
      if (!auditPersisted) {
        showToast("Lote processado, mas falhou o registo na auditoria persistente.", "error");
      }
    }

    if (successCount > 0) {
      showToast(
        `${successCount} candidatura(s) ${action === "accept" ? "aceite(s)" : "rejeitada(s)"} em lote.`,
        "success"
      );
    }
    if (skippedCount > 0) {
      showToast(`${skippedCount} candidatura(s) ignorada(s) por vaga sem disponibilidade.`, "error");
    }
    if (errorCount > 0) {
      showToast(`${errorCount} candidatura(s) falharam durante o processamento em lote.`, "error");
    }

    await load();
    if (!auditPersisted) {
      setBatchReportRows((prev) => [...nextReportRows, ...prev].slice(0, 500));
    }
    setSelectedApplicationIds(new Set());
    setBatchRejectReason("");
    setBatchConfirmTarget(null);
    setLastBatchSummary({
      processedAt,
      processedBy,
      action,
      selected: selectedPendingApps.length,
      successCount,
      skippedCount,
      errorCount,
    });
    setBatchProcessing(false);
  }

  function requestBatchDecision(action) {
    if (batchProcessing) return;
    const selectedPendingApps = sortedTabApps.filter((app) => selectedApplicationIds.has(app.id));
    if (!selectedPendingApps.length) {
      showToast("Selecione pelo menos uma candidatura pendente.", "error");
      return;
    }
    if (action === "reject" && batchRejectReason.trim().length < 10) {
      showToast("Informe um motivo de rejeiÃ§Ã£o com pelo menos 10 caracteres.", "error");
      return;
    }
    setBatchConfirmTarget({
      action,
      selectedCount: selectedPendingApps.length,
    });
  }

  function exportBatchCsv() {
    if (!batchReportRows.length) {
      showToast("Ainda nÃ£o hÃ¡ dados para exportar.", "error");
      return;
    }

    const headers = ["data_hora", "responsavel", "acao", "candidato", "vaga", "resultado", "motivo"];
    const lines = batchReportRows.map((row) => {
      const cols = [
        new Date(row.processedAt).toLocaleString("pt-PT"),
        row.processedBy,
        row.action,
        row.studentName,
        row.vacancyTitle,
        row.result,
        row.reason,
      ];
      return cols.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";");
    });

    const csv = [headers.join(";"), ...lines].join("\n");
    navigator.clipboard
      .writeText(`\uFEFF${csv}`)
      .then(() => {
        showToast("RelatÃ³rio CSV copiado para a Ã¡rea de transferÃªncia.", "success");
      })
      .catch(() => {
        showToast("NÃ£o foi possÃ­vel copiar o relatÃ³rio CSV.", "error");
      });
  }

  const pending = applications.filter((a) => a.status === "PENDING");
  const accepted = applications.filter((a) => a.status === "ACCEPTED");
  const rejected = applications.filter((a) => a.status === "REJECTED");
  const pendingSlaWarning = pending.filter((app) => {
    const days = getPendingDays(app.applied_at);
    return days >= 3 && days <= 5;
  }).length;
  const pendingSlaCritical = pending.filter((app) => getPendingDays(app.applied_at) >= 6).length;
  const normalizedReportBatch = reportBatchFilter.trim().toLowerCase();
  const filteredReportRows = batchReportRows.filter((row) => {
    if (normalizedReportBatch) {
      const rowBatch = String(row.batchId ?? "").toLowerCase();
      if (!rowBatch.includes(normalizedReportBatch)) {
        return false;
      }
    }

    if (reportActionFilter !== "all" && row.action !== reportActionFilter) {
      return false;
    }

    if (reportResultFilter !== "all" && row.result !== reportResultFilter) {
      return false;
    }

    const rowTs = parseSafeDate(row.processedAt);
    if (reportDateFrom) {
      const fromTs = parseSafeDate(`${reportDateFrom}T00:00:00`);
      if (rowTs < fromTs) {
        return false;
      }
    }

    if (reportDateTo) {
      const toTs = parseSafeDate(`${reportDateTo}T23:59:59.999`);
      if (rowTs > toTs) {
        return false;
      }
    }

    return true;
  });

  const reportTotalPages = Math.max(1, Math.ceil(filteredReportRows.length / reportPageSize));
  const safeReportPage = Math.min(reportPage, reportTotalPages);
  const reportSliceStart = (safeReportPage - 1) * reportPageSize;
  const visibleReportRows = filteredReportRows.slice(reportSliceStart, reportSliceStart + reportPageSize);

  const availableSlots = vacancies
    .filter((vacancy) => vacancy.status === "OPEN")
    .reduce((sum, vacancy) => sum + Math.max(0, Number(vacancy.available_slots ?? 0)), 0);

  const vacancyMetrics = {
    total: vacancies.length,
    open: vacancies.filter((vacancy) => vacancy.status === "OPEN").length,
    closed: vacancies.filter((vacancy) => vacancy.status === "CLOSED").length,
    applications: applications.length,
    occupancyAvg: vacancies.length
      ? Math.round(
        vacancies.reduce((acc, vacancy) => {
          const totalSlots = Number(vacancy.total_slots ?? 0);
          const availableForVacancy = Math.max(0, Number(vacancy.available_slots ?? 0));
          const occupancy = totalSlots > 0
            ? Math.min(100, Math.round(((totalSlots - availableForVacancy) / totalSlots) * 100))
            : 0;
          return acc + occupancy;
        }, 0) / vacancies.length
      )
      : 0,
  };

  const normalizedVacancySearch = vacancySearch.trim().toLowerCase();
  const filteredVacancies = vacancies
    .filter((vacancy) => {
      if (vacancyStatusFilter !== "ALL" && vacancy.status !== vacancyStatusFilter) {
        return false;
      }
      if (!normalizedVacancySearch) return true;
      const title = String(vacancy.title ?? "").toLowerCase();
      const description = String(vacancy.description ?? "").toLowerCase();
      return title.includes(normalizedVacancySearch) || description.includes(normalizedVacancySearch);
    })
    .sort((a, b) => {
      if (vacancySortMode === "title") {
        return String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt");
      }
      if (vacancySortMode === "occupancy") {
        const totalA = Number(a.total_slots ?? 0);
        const usedA = Math.max(0, totalA - Number(a.available_slots ?? 0));
        const ratioA = totalA > 0 ? usedA / totalA : 0;
        const totalB = Number(b.total_slots ?? 0);
        const usedB = Math.max(0, totalB - Number(b.available_slots ?? 0));
        const ratioB = totalB > 0 ? usedB / totalB : 0;
        return ratioB - ratioA;
      }
      if (vacancySortMode === "slots") {
        return Number(b.available_slots ?? 0) - Number(a.available_slots ?? 0);
      }
      return parseSafeDate(b.created_at) - parseSafeDate(a.created_at);
    });

  const internRecords = accepted.map((app) => {
    const referenceDate = app.accepted_at || app.applied_at || app.created_at || null;
    const phase = getInternPhaseMeta(referenceDate);
    const areaName = resolveInternAreaName(app);
    const sectorName = resolveInternSectorName(app);
    return {
      app,
      areaName,
      sectorName,
      phase,
      referenceDate,
    };
  });

  const internSectorOptions = Array.from(new Set(internRecords.map((record) => record.sectorName))).sort((a, b) => a.localeCompare(b, "pt"));
  const internAreaOptions = Array.from(new Set(internRecords.map((record) => record.areaName))).sort((a, b) => a.localeCompare(b, "pt"));

  const filteredInternRecords = internRecords
    .filter((record) => {
      const search = internSearch.trim().toLowerCase();
      if (search) {
        const fullName = String(record.app.student?.full_name ?? "").toLowerCase();
        const email = String(record.app.student?.email ?? "").toLowerCase();
        const vacancyTitle = String(record.app.vacancy?.title ?? "").toLowerCase();
        if (!fullName.includes(search) && !email.includes(search) && !vacancyTitle.includes(search)) {
          return false;
        }
      }

      if (internSectorFilter !== "all" && record.sectorName !== internSectorFilter) {
        return false;
      }
      if (internAreaFilter !== "all" && record.areaName !== internAreaFilter) {
        return false;
      }
      if (internPhaseFilter !== "all" && record.phase.tone !== internPhaseFilter) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (internSortMode === "name") {
        return String(a.app.student?.full_name ?? "").localeCompare(String(b.app.student?.full_name ?? ""), "pt");
      }
      if (internSortMode === "phase") {
        return b.phase.days - a.phase.days;
      }
      if (internSortMode === "oldest") {
        return parseSafeDate(a.referenceDate) - parseSafeDate(b.referenceDate);
      }
      return parseSafeDate(b.referenceDate) - parseSafeDate(a.referenceDate);
    });

  const internsBySector = filteredInternRecords.reduce((acc, record) => {
    if (!acc[record.sectorName]) acc[record.sectorName] = [];
    acc[record.sectorName].push(record);
    return acc;
  }, {});

  const sectorEntries = Object.entries(internsBySector).sort((a, b) => a[0].localeCompare(b[0], "pt"));

  const kpis = [
    { label: t("companyDashboard.kpi.pending"), value: pending.length, icon: "hourglass_empty" },
    { label: t("companyDashboard.kpi.accepted"), value: accepted.length, icon: "check_circle" },
    { label: t("companyDashboard.kpi.active"), value: accepted.length, icon: "work" },
    {
      label: t("companyDashboard.kpi.slots"),
      value: availableSlots,
      icon: "business_center",
    },
  ];

  const tabs = [
    { key: "hub", label: "OperaÃ§Ãµes", count: 0 },
    { key: "vacancies", label: "Vagas", count: vacancies.length },
    { key: "management", label: "GestÃ£o EstagiÃ¡rios", count: accepted.length },
    { key: "pending", label: t("companyDashboard.tab.pending"), count: pending.length },
    { key: "accepted", label: t("companyDashboard.tab.accepted"), count: accepted.length },
    { key: "rejected", label: t("companyDashboard.tab.rejected"), count: rejected.length },
    { key: "interns", label: t("companyDashboard.interns"), count: accepted.length },
  ];

  const operationalCards = [
    {
      key: "vacancies",
      title: "Vagas",
      icon: "business_center",
      eyebrow: `${vacancies.length} vaga(s)`,
      description: "Gerir publicaÃ§Ã£o, ediÃ§Ã£o operacional, estado e ocupaÃ§Ã£o de cada vaga da empresa.",
      stats: [
        `${availableSlots} vaga(s) aberta(s)`,
        `${vacancies.filter((vacancy) => vacancy.status === "OPEN").length} em recrutamento`,
      ],
    },
    {
      key: "pending",
      title: "Candidaturas",
      icon: "description",
      eyebrow: `${pending.length} pendente(s)`,
      description: "Triar candidatos, aceitar ou rejeitar, aplicar filtros, aÃ§Ãµes em lote e controlar SLA.",
      stats: [
        `${pendingSlaCritical} crÃ­tica(s)`,
        `${pendingSlaWarning} em atenÃ§Ã£o`,
      ],
    },
    {
      key: "interns",
      title: "EstagiÃ¡rios",
      icon: "groups",
      eyebrow: `${accepted.length} ativo(s)`,
      description: "Acompanhar cada estudante com detalhe, por Ã¡rea, estado do estÃ¡gio, datas e evoluÃ§Ã£o contratual.",
      stats: [
        `${accepted.length} em acompanhamento`,
        `${trainingAreas.length} Ã¡rea(s) disponÃ­vel(eis)`,
      ],
    },
    {
      key: "management",
      title: "OrganizaÃ§Ã£o",
      icon: "dashboard_customize",
      eyebrow: "Painel operacional",
      description: "Ver agrupamentos por setor, Ã¡rea de atuaÃ§Ã£o e apoiar a gestÃ£o diÃ¡ria dos estÃ¡gios em curso.",
      stats: [
        `${accepted.length} perfil(is) para organizar`,
        `${applications.length} candidatura(s) total`,
      ],
    },
    {
      key: "overview",
      title: "Indicadores",
      icon: "monitoring",
      eyebrow: "VisÃ£o geral",
      description: "Concentrar KPIs, taxa de ocupaÃ§Ã£o, ritmo de decisÃ£o e saÃºde operacional do pipeline.",
      stats: [
        `${accepted.length} aceite(s)`,
        `${rejected.length} rejeitada(s)`,
      ],
    },
  ];

  const tabApps = activeTab === "candidaturas" ? pending
    : activeTab === "candidaturas-aceites" ? accepted
    : activeTab === "candidaturas-rejeitadas" ? rejected
    : [];
  const filteredTabApps =
    vacancyFilter === "ALL"
      ? tabApps
      : tabApps.filter((app) => app.vacancy_id === vacancyFilter);
  const slaFilteredTabApps = activeTab !== "candidaturas"
    ? filteredTabApps
    : filteredTabApps.filter((app) => {
      const days = getPendingDays(app.applied_at);
      if (slaQuickFilter === "critical") return days >= 6;
      if (slaQuickFilter === "warning") return days >= 3 && days <= 5;
      if (slaQuickFilter === "healthy") return days < 3;
      return true;
    });
  const normalizedSearch = applicationSearch.trim().toLowerCase();
  const searchableTabApps = normalizedSearch
    ? slaFilteredTabApps.filter((app) => {
      const fullName = String(app.student?.full_name ?? "").toLowerCase();
      const email = String(app.student?.email ?? "").toLowerCase();
      const vacancyTitle = String(app.vacancy?.title ?? "").toLowerCase();
      return fullName.includes(normalizedSearch) || email.includes(normalizedSearch) || vacancyTitle.includes(normalizedSearch);
    })
    : slaFilteredTabApps;
  const sortedTabApps = [...searchableTabApps].sort((a, b) => {
    if (applicationSort === "oldest") {
      return parseSafeDate(a.applied_at) - parseSafeDate(b.applied_at);
    }
    if (applicationSort === "urgency") {
      return getPendingDays(b.applied_at) - getPendingDays(a.applied_at);
    }
    return parseSafeDate(b.applied_at) - parseSafeDate(a.applied_at);
  });
  const hasCompanyAccountProfile = Boolean(companyAccount?.id);

  if (partner) {
    const slaCounts = {
      healthy: pending.filter((app) => getPendingDays(app.applied_at) < 3).length,
      warning: pending.filter((app) => { const d = getPendingDays(app.applied_at); return d >= 3 && d <= 5; }).length,
      critical: pending.filter((app) => getPendingDays(app.applied_at) >= 6).length,
    };

    return (
      <div className="page-container company-page">
        {/* â”€â”€ Company header â”€â”€ */}
        <header className="company-dashboard-header">
          <div className="company-dashboard-header__info">
            <h1 className="company-dashboard-header__name">{partner.empresa ?? t("companyDashboard.title")}</h1>
            <p className="company-dashboard-header__sub">Painel operacional &middot; {new Date().toLocaleDateString("pt-PT")}</p>
          </div>
          <div className="company-dashboard-kpis">
            {[
              { label: "Pendentes", value: pending.length, icon: "hourglass_empty" },
              { label: "Aceites", value: accepted.length, icon: "check_circle" },
              { label: "EstagiÃ¡rios ativos", value: accepted.length, icon: "groups" },
              { label: "Vagas abertas", value: availableSlots, icon: "business_center" },
            ].map((kpi) => (
              <div key={kpi.label} className="company-kpi-chip">
                <span className="material-icons" aria-hidden="true">{kpi.icon}</span>
                <div>
                  <strong>{kpi.value}</strong>
                  <small>{kpi.label}</small>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* â”€â”€ Tab navigation â”€â”€ */}
        <nav className="company-tab-nav" aria-label="SecÃ§Ãµes do painel">
          {[
            { key: "vagas", label: "Vagas", icon: "business_center", badge: vacancies.length },
            { key: "candidaturas", label: "Pendentes", icon: "hourglass_empty", badge: pending.length },
            { key: "candidaturas-aceites", label: "Aceites", icon: "check_circle", badge: accepted.length },
            { key: "candidaturas-rejeitadas", label: "Rejeitadas", icon: "cancel", badge: rejected.length },
            { key: "estagios", label: "EstagiÃ¡rios", icon: "groups", badge: accepted.length },
            { key: "relatorios", label: "RelatÃ³rios", icon: "bar_chart", badge: 0 },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={`company-tab-btn${activeTab === tab.key ? " company-tab-btn--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="material-icons" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge > 0 && <span className="company-tab-badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        {/* â•â•â•â•â•â•â•â•â•â• TAB: VAGAS â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "vagas" && (
          <div className="company-tab-content" role="tabpanel">
            <div className="company-vagas-layout">
              {/* Publish form */}
              <section className="panel-card company-publish-panel" ref={publishCardRef}>
                <div className="company-section-header">
                  <span className="material-icons" aria-hidden="true">add_circle_outline</span>
                  <div>
                    <h2>Publicar nova vaga</h2>
                    <p>{availableSlots} vaga(s) abertas no momento</p>
                  </div>
                </div>
                <div className="company-publish-form">
                  <label htmlFor="vacancy-title">
                    <span>TÃ­tulo da vaga</span>
                    <input
                      id="vacancy-title"
                      aria-label="Titulo da vaga"
                      type="text"
                      value={publishTitle}
                      onChange={(e) => setPublishTitle(e.target.value)}
                    />
                  </label>
                  <label htmlFor="vacancy-description">
                    <span>DescriÃ§Ã£o</span>
                    <textarea
                      id="vacancy-description"
                      aria-label="Descricao"
                      rows={3}
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                    />
                  </label>
                  <label htmlFor="vacancy-quantity">
                    <span>Quantidade de vagas</span>
                    <input
                      id="vacancy-quantity"
                      aria-label="Quantidade"
                      type="number"
                      min="1"
                      step="1"
                      value={publishSlots}
                      onChange={(e) => setPublishSlots(e.target.value)}
                    />
                  </label>
                  <button className="btn btn-primary" type="button" disabled={publishing} onClick={handlePublishVacancies}>
                    {publishing ? "A publicar..." : "Publicar vaga"}
                  </button>
                </div>
              </section>

              {/* Metrics strip */}
              <div className="company-vacancy-metrics-grid">
                {[
                  { label: "Total", value: vacancyMetrics.total, icon: "list_alt" },
                  { label: "Em recrutamento", value: vacancyMetrics.open, icon: "work_outline" },
                  { label: "Encerradas", value: vacancyMetrics.closed, icon: "lock_outline" },
                  { label: "OcupaÃ§Ã£o mÃ©dia", value: `${vacancyMetrics.occupancyAvg}%`, icon: "percent" },
                ].map((m) => (
                  <div key={m.label} className="company-metric-card">
                    <span className="material-icons" aria-hidden="true">{m.icon}</span>
                    <strong>{m.value}</strong>
                    <small>{m.label}</small>
                  </div>
                ))}
              </div>
            </div>

            {/* Vacancies list */}
            <section className="panel-card" ref={vacanciesListRef} style={{ marginTop: "1.25rem" }}>
              <div className="company-section-header company-section-header--space">
                <h2>Vagas publicadas</h2>
                <div className="company-filter-row">
                  <input
                    type="search"
                    placeholder="Pesquisar vaga..."
                    value={vacancySearch}
                    onChange={(e) => setVacancySearch(e.target.value)}
                    aria-label="Pesquisar vaga"
                  />
                  <select value={vacancyStatusFilter} onChange={(e) => setVacancyStatusFilter(e.target.value)} aria-label="Estado da vaga">
                    <option value="ALL">Todos os estados</option>
                    <option value="OPEN">Abertas</option>
                    <option value="CLOSED">Encerradas</option>
                  </select>
                </div>
              </div>
              {filteredVacancies.length === 0 ? (
                <p className="empty-state-text">Nenhuma vaga encontrada.</p>
              ) : (
                <div className="company-vacancies-list">
                  {filteredVacancies.map((vacancy) => {
                    const pendingForVacancy = applications.filter(
                      (app) => app.vacancy_id === vacancy.id && app.status === "PENDING"
                    ).length;
                    const totalSlots = Number(vacancy.total_slots ?? 0);
                    const availableForVacancy = Math.max(0, Number(vacancy.available_slots ?? 0));
                    const occupancy = totalSlots > 0
                      ? Math.min(100, Math.round(((totalSlots - availableForVacancy) / totalSlots) * 100))
                      : 0;
                    return (
                      <div key={vacancy.id} className="company-vacancy-row">
                        <div className="company-vacancy-row__header">
                          <div className="company-vacancy-row__meta">
                            <strong className="company-vacancy-row__title">{vacancy.title}</strong>
                            <span className={`company-status-badge company-status-badge--${vacancy.status === "OPEN" ? "open" : "closed"}`}>
                              {vacancy.status === "OPEN" ? "Aberta" : "Encerrada"}
                            </span>
                            {pendingForVacancy > 0 && (
                              <span className="company-status-badge company-status-badge--warn">
                                {pendingForVacancy} pendente(s)
                              </span>
                            )}
                          </div>
                          <div className="company-vacancy-row__actions">
                            <span className="company-vacancy-row__slots">{availableForVacancy}/{totalSlots} livres</span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={togglingVacancyId === vacancy.id}
                              onClick={() => setVacancyToggleTarget(vacancy)}
                            >
                              {togglingVacancyId === vacancy.id
                                ? "A processar..."
                                : vacancy.status === "OPEN"
                                ? "Fechar vaga"
                                : "Reabrir vaga"}
                            </button>
                          </div>
                        </div>
                        <div className="company-vacancy-row__progress">
                          <div className="company-progress-bar">
                            <div
                              className="company-progress-bar__fill"
                              style={{ width: `${occupancy}%` }}
                              role="progressbar"
                              aria-valuenow={occupancy}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <span>{occupancy}% ocupada</span>
                        </div>
                        {vacancy.description && (
                          <p className="company-vacancy-row__desc">{vacancy.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• TAB: CANDIDATURAS â•â•â•â•â•â•â•â•â•â• */}
        {(activeTab === "candidaturas" || activeTab === "candidaturas-aceites" || activeTab === "candidaturas-rejeitadas") && (
          <div className="company-tab-content" role="tabpanel">
            {activeTab === "candidaturas" && (
              <div className="company-sla-strip">
                <strong>SLA de triagem</strong>
                <span className="sla-chip sla-chip--healthy">{slaCounts.healthy} no prazo</span>
                <span className="sla-chip sla-chip--warning">{slaCounts.warning} em atenÃ§Ã£o (3â€“5d)</span>
                <span className="sla-chip sla-chip--critical">{slaCounts.critical} crÃ­ticos (6+d)</span>
                <div className="sla-filter-btns">
                  {[
                    { key: "all", label: "Todos" },
                    { key: "healthy", label: "No prazo" },
                    { key: "warning", label: "AtenÃ§Ã£o" },
                    { key: "critical", label: "CrÃ­ticos" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`btn btn-ghost btn-sm${slaQuickFilter === f.key ? " btn-active" : ""}`}
                      aria-pressed={slaQuickFilter === f.key}
                      onClick={() => setSlaQuickFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="company-filter-row">
              <input
                type="search"
                placeholder="Pesquisar candidato ou vaga..."
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                aria-label="Pesquisar candidatura"
              />
              <select value={applicationSort} onChange={(e) => setApplicationSort(e.target.value)} aria-label="Ordenar por">
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="urgency">Por urgÃªncia</option>
              </select>
              <select value={vacancyFilter} onChange={(e) => setVacancyFilter(e.target.value)} aria-label="Filtrar por vaga">
                <option value="ALL">Todas as vagas</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>{v.title}</option>
                ))}
              </select>
            </div>

            {activeTab === "candidaturas" && selectedApplicationIds.size > 0 && (
              <div className="company-batch-bar">
                <span>{selectedApplicationIds.size} selecionada(s)</span>
                <input
                  type="text"
                  placeholder="Motivo de rejeiÃ§Ã£o (mÃ­n. 10 car.)"
                  value={batchRejectReason}
                  onChange={(e) => setBatchRejectReason(e.target.value)}
                  aria-label="Motivo de rejeiÃ§Ã£o em lote"
                />
                <button type="button" className="btn btn-primary btn-sm" disabled={batchProcessing} onClick={() => requestBatchDecision("accept")}>
                  Aceitar selecionadas
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={batchProcessing} onClick={() => requestBatchDecision("reject")}>
                  Rejeitar selecionadas
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedApplicationIds(new Set())}>
                  Limpar seleÃ§Ã£o
                </button>
              </div>
            )}

            {sortedTabApps.length === 0 ? (
              <p className="empty-state-text">Nenhuma candidatura encontrada.</p>
            ) : (
              <div className="company-applications-list">
                {sortedTabApps.map((app) => {
                  const days = getPendingDays(app.applied_at);
                  const slaMeta = getSlaMeta(days);
                  const isSelected = selectedApplicationIds.has(app.id);
                  return (
                    <div key={app.id} className={`company-application-card${isSelected ? " company-application-card--selected" : ""}`}>
                      <div className="company-application-card__header">
                        {activeTab === "candidaturas" && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            aria-label={`Selecionar candidatura de ${app.student?.full_name ?? "aluno"}`}
                            onChange={() => {
                              setSelectedApplicationIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(app.id)) next.delete(app.id);
                                else next.add(app.id);
                                return next;
                              });
                            }}
                          />
                        )}
                        <div className="company-application-card__identity">
                          <strong>{app.student?.full_name ?? "Sem nome"}</strong>
                          <small>{app.student?.email ?? "â€”"}</small>
                        </div>
                        <span className="company-application-card__vacancy">{app.vacancy?.title ?? "Sem vaga"}</span>
                        {activeTab === "candidaturas" && (
                          <span className="sla-chip" style={{ color: slaMeta.color, background: slaMeta.background }}>
                            {days}d Â· {slaMeta.label}
                          </span>
                        )}
                        {activeTab === "candidaturas" && (
                          <div className="company-application-card__actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={processingId === app.id}
                              onClick={() => setActionTarget({ id: app.id, action: "accept", notes: "" })}
                            >
                              Aceitar
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={processingId === app.id}
                              onClick={() => setActionTarget({ id: app.id, action: "reject", notes: "" })}
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• TAB: ESTAGIÃRIOS â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "estagios" && (
          <div className="company-tab-content" role="tabpanel">
            {expandedInternId ? (
              <div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: "1rem" }}
                  onClick={() => setExpandedInternId(null)}
                >
                  â† Voltar Ã  lista
                </button>
                <InternDetailPanel
                  application={accepted.find((app) => app.id === expandedInternId)}
                  onClose={() => setExpandedInternId(null)}
                  t={t}
                  showToast={showToast}
                />
              </div>
            ) : (
              <div>
                <div className="company-filter-row">
                  <input
                    type="search"
                    placeholder="Pesquisar estagiÃ¡rio..."
                    value={internSearch}
                    onChange={(e) => setInternSearch(e.target.value)}
                    aria-label="Pesquisar estagiÃ¡rio"
                  />
                  <select value={internSectorFilter} onChange={(e) => setInternSectorFilter(e.target.value)} aria-label="Setor">
                    <option value="all">Todos os setores</option>
                    {internSectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={internAreaFilter} onChange={(e) => setInternAreaFilter(e.target.value)} aria-label="Ãrea">
                    <option value="all">Todas as Ã¡reas</option>
                    {internAreaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <select value={internSortMode} onChange={(e) => setInternSortMode(e.target.value)} aria-label="Ordenar">
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="name">Por nome</option>
                    <option value="phase">Por fase</option>
                  </select>
                </div>
                {filteredInternRecords.length === 0 ? (
                  <p className="empty-state-text">Nenhum estagiÃ¡rio ativo.</p>
                ) : (
                  <div className="company-interns-grid">
                    {filteredInternRecords.map(({ app, areaName, sectorName, phase }) => (
                      <div key={app.id} className="company-intern-card">
                        <div className="company-intern-card__header">
                          <strong>{app.student?.full_name ?? "Sem nome"}</strong>
                          <span className={`company-phase-badge company-phase-badge--${phase.tone}`}>{phase.label}</span>
                        </div>
                        <div className="company-intern-card__meta">
                          <small>{areaName}</small>
                          <small>{sectorName}</small>
                          <small>{phase.days} dias</small>
                        </div>
                        <div className="company-intern-card__actions">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpandedInternId(app.id)}>
                            Ver detalhe
                          </button>
                          {app.student?.email && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => { window.location.assign(`mailto:${app.student.email}`); }}
                            >
                              Contactar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â• TAB: RELATÃ“RIOS â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "relatorios" && (
          <div className="company-tab-content" role="tabpanel">
            <section className="panel-card">
              <div className="company-section-header company-section-header--space">
                <h2>RelatÃ³rio de decisÃµes em lote</h2>
                <button type="button" className="btn btn-ghost btn-sm" onClick={exportBatchCsv}>
                  Exportar CSV
                </button>
              </div>
              <div className="company-filter-row">
                <input
                  type="text"
                  placeholder="ID de lote..."
                  value={reportBatchFilter}
                  onChange={(e) => setReportBatchFilter(e.target.value)}
                  aria-label="Filtrar por ID de lote"
                />
                <select value={reportActionFilter} onChange={(e) => setReportActionFilter(e.target.value)} aria-label="AÃ§Ã£o">
                  <option value="all">Todas as aÃ§Ãµes</option>
                  <option value="accept">Aceitar</option>
                  <option value="reject">Rejeitar</option>
                </select>
                <select value={reportResultFilter} onChange={(e) => setReportResultFilter(e.target.value)} aria-label="Resultado">
                  <option value="all">Todos</option>
                  <option value="SUCCESS">Sucesso</option>
                  <option value="SKIPPED">Ignorado</option>
                  <option value="ERROR">Erro</option>
                </select>
                <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} aria-label="Data de inÃ­cio" />
                <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} aria-label="Data de fim" />
              </div>
              {visibleReportRows.length === 0 ? (
                <p className="empty-state-text">Sem registo de lotes ainda.</p>
              ) : (
                <div>
                  <table className="company-report-table">
                    <thead>
                      <tr>
                        <th>Data/hora</th>
                        <th>ResponsÃ¡vel</th>
                        <th>AÃ§Ã£o</th>
                        <th>Candidato</th>
                        <th>Vaga</th>
                        <th>Resultado</th>
                        <th>Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleReportRows.map((row, idx) => (
                        <tr key={`${row.batchId}-${idx}`}>
                          <td>{new Date(row.processedAt).toLocaleString("pt-PT")}</td>
                          <td>{row.processedBy}</td>
                          <td>{row.action}</td>
                          <td>{row.studentName}</td>
                          <td>{row.vacancyTitle}</td>
                          <td>
                            <span className={`company-status-badge company-status-badge--${row.result.toLowerCase()}`}>
                              {row.result}
                            </span>
                          </td>
                          <td>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reportTotalPages > 1 && (
                    <div className="company-pagination">
                      <button type="button" className="btn btn-ghost btn-sm" disabled={safeReportPage <= 1} onClick={() => setReportPage(safeReportPage - 1)}>Anterior</button>
                      <span>{safeReportPage} / {reportTotalPages}</span>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={safeReportPage >= reportTotalPages} onClick={() => setReportPage(safeReportPage + 1)}>Seguinte</button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* â”€â”€ Modal: aceitar / rejeitar candidatura â”€â”€ */}
        {actionTarget && (
          <div
            className="modal-overlay"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={(e) => { if (e.target === e.currentTarget) setActionTarget(null); }}
          >
            <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 480 }}>
              <h3>{actionTarget.action === "accept" ? "Confirmar aceitaÃ§Ã£o" : "Confirmar rejeiÃ§Ã£o"}</h3>
              {actionTarget.action === "accept" ? (
                <p>Confirma a aceitaÃ§Ã£o desta candidatura?</p>
              ) : (
                <div>
                  <p>Motivo da rejeiÃ§Ã£o (mÃ­n. 10 caracteres):</p>
                  <textarea
                    rows={3}
                    value={actionTarget.notes}
                    onChange={(e) => setActionTarget((prev) => ({ ...prev, notes: e.target.value }))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border-color, #d1d5db)" }}
                    aria-label="Motivo de rejeiÃ§Ã£o"
                  />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setActionTarget(null)}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={!!processingId}
                  onClick={actionTarget.action === "accept" ? handleAccept : handleReject}
                >
                  {processingId === actionTarget.id ? "A processar..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Modal: confirmar lote â”€â”€ */}
        {batchConfirmTarget && (
          <div
            className="modal-overlay"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={(e) => { if (e.target === e.currentTarget) setBatchConfirmTarget(null); }}
          >
            <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 460 }}>
              <h3>Confirmar aÃ§Ã£o em lote</h3>
              <p>
                Vai {batchConfirmTarget.action === "accept" ? "aceitar" : "rejeitar"}{" "}
                {batchConfirmTarget.selectedCount} candidatura(s). Esta operaÃ§Ã£o nÃ£o pode ser revertida.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setBatchConfirmTarget(null)}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={batchProcessing}
                  onClick={() => handleBatchDecision(batchConfirmTarget.action)}
                >
                  {batchProcessing ? "A processar..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ Modal: fechar / reabrir vaga â”€â”€ */}
        {vacancyToggleTarget && (
          <div
            className="modal-overlay"
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setVacancyToggleTarget(null);
              }
            }}
          >
            <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 460 }}>
              <h3>
                {vacancyToggleTarget.status === "OPEN" ? "Fechar vaga" : "Reabrir vaga"}
              </h3>
              <p style={{ marginTop: 0, opacity: 0.8 }}>
                {vacancyToggleTarget.status === "OPEN"
                  ? `Confirma o fecho da vaga "${vacancyToggleTarget.title}"?`
                  : `Confirma a reabertura da vaga "${vacancyToggleTarget.title}"?`}
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setVacancyToggleTarget(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={togglingVacancyId === vacancyToggleTarget.id}
                  onClick={async () => {
                    const target = vacancyToggleTarget;
                    setVacancyToggleTarget(null);
                    await handleToggleVacancyStatus(target);
                  }}
                >
                  {togglingVacancyId === vacancyToggleTarget.id ? "A processar..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  if (loading) {
    return (
      <div className="page-container company-page">
        <PageHeader
          title={partner?.empresa ?? t("companyDashboard.title")}
          description={t("companyDashboard.description")}
        />
        <div className="loading-state">
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem", fontWeight: 700 }}>Painel da empresa</h2>
          <span className="material-icons spinning">refresh</span>
        </div>
      </div>
    );
  }

  if (!partner && !hasCompanyAccountProfile) {
    return (
      <div className="page-container company-page">
        <PageHeader title={t("companyDashboard.title")} description={t("companyDashboard.description")} />
        <div className="empty-state company-onboarding-empty" style={{ maxWidth: 760, margin: "0 auto" }}>
          <span className="material-icons">business_center</span>
          <p style={{ marginBottom: 0 }}>{t("companyDashboard.noPartner")}</p>
          <div className="panel-card company-hero-card" style={{ width: "100%", padding: "1rem", marginTop: "0.85rem", textAlign: "left", background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(255,255,255,0.02))", border: "1px solid rgba(14,165,233,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>O que terÃ¡ no seu painel</h3>
                <p style={{ margin: "0.3rem 0 0", opacity: 0.78 }}>VisÃ£o geral de candidaturas, estÃ¡gios ativos, desempenho e acompanhamentos.</p>
              </div>
              <span className="company-hero-chip" style={{ fontSize: "0.78rem", padding: "0.3rem 0.6rem", borderRadius: 999, background: "rgba(14,165,233,0.14)", color: "#075985", fontWeight: 700 }}>
                painel responsivo
              </span>
            </div>
            <div className="company-feature-grid" style={{ display: "grid", gap: "0.55rem", marginTop: "0.85rem" }}>
              <div className="company-feature-item" style={{ borderRadius: 12, padding: "0.7rem", border: "1px solid var(--border-color, #1f2937)" }}>
                <strong style={{ fontSize: "0.84rem" }}>VisÃ£o geral de candidaturas</strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
                  Entradas pendentes, aceites, rejeitadas e tempo mÃ©dio de decisÃ£o.
                </p>
              </div>
              <div className="company-feature-item" style={{ borderRadius: 12, padding: "0.7rem", border: "1px solid var(--border-color, #1f2937)" }}>
                <strong style={{ fontSize: "0.84rem" }}>EstÃ¡gios ativos e desempenho</strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
                  OcupaÃ§Ã£o de vagas, acompanhamento de estagiÃ¡rios e indicadores operacionais.
                </p>
              </div>
              <div className="company-feature-item" style={{ borderRadius: 12, padding: "0.7rem", border: "1px solid var(--border-color, #1f2937)" }}>
                <strong style={{ fontSize: "0.84rem" }}>Recursos de gestÃ£o</strong>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
                  AÃ§Ãµes em lote, filtros de SLA e acompanhamento individual dos estagiÃ¡rios.
                </p>
              </div>
            </div>
          </div>
          <div className="panel-card company-editor-card" style={{ width: "100%", padding: "1rem", marginTop: "1rem", textAlign: "left", borderRadius: 12, background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem" }}>ConfiguraÃ§Ã£o de empresa necessÃ¡ria</h3>
            <p style={{ margin: "0 0 1rem", opacity: 0.85, fontSize: "0.9rem" }}>
              Para completa integraÃ§Ã£o e gestÃ£o operacional, preencha os dados da sua empresa nas ConfiguraÃ§Ãµes do Perfil.
            </p>
            <Link className="btn btn-primary" to="/config/perfil">
              Completar dados da empresa
            </Link>
          </div>
          <div className="panel-card company-publish-card" style={{ width: "100%", padding: "1rem", marginTop: "1rem", textAlign: "left" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Publicar a primeira vaga</h3>
            <label style={{ display: "block", marginBottom: "0.95rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>TÃ­tulo da vaga</span>
              <input
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.95rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>DescriÃ§Ã£o</span>
              <textarea
                rows={3}
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.95rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>Vagas iniciais para publicar</span>
              <input
                type="number"
                min="1"
                step="1"
                value={publishSlots}
                onChange={(e) => setPublishSlots(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <button className="btn btn-primary" type="button" onClick={handlePublishVacancies} disabled={publishing}>
              {publishing ? "A processar..." : "Criar empresa e publicar vagas"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!partner && hasCompanyAccountProfile) {
    const operationalCompanyName = companyAccount?.empresa || authProfile?.displayName || t("companyDashboard.title");

    return (
      <div className="page-container company-page">
        <PageHeader
          title={operationalCompanyName}
          description={t("companyDashboard.description")}
        />

        <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 700 }}>Painel da empresa</h2>

        <div className="panel-card company-sync-banner" style={{ marginBottom: "1rem", border: "1px solid rgba(14, 165, 233, 0.28)", background: "linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(255,255,255,0.02))" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <strong style={{ display: "block", marginBottom: "0.25rem" }}>Conta empresarial ativa</strong>
              <p style={{ margin: 0, opacity: 0.9 }}>
                O painel operacional serÃ¡ usado para vagas, candidaturas e acompanhamento dos estagiÃ¡rios. Dados da empresa ficam nas ConfiguraÃ§Ãµes do Perfil.
              </p>
            </div>
            <Link className="btn btn-secondary" to="/config/perfil">
              Abrir configuraÃ§Ãµes
            </Link>
          </div>
        </div>

        <CompanyOverviewPanel
          partner={{ empresa: operationalCompanyName }}
          applications={[]}
          vacancies={[]}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className="page-container company-page">
      <PageHeader
        title={partner.empresa ?? t("companyDashboard.title")}
        description={t("companyDashboard.description")}
      />

      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Painel da empresa</h2>
      </div>
      <section className="company-operations-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {operationalCards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`company-operation-card${activeTab === card.key ? " company-operation-card--active" : ""}`}
            onClick={() => setActiveTab(card.key)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
              <div>
                <span className="company-operation-card__eyebrow">{card.eyebrow}</span>
                <h3 style={{ margin: "0.35rem 0 0", fontSize: "1rem" }}>{card.title}</h3>
              </div>
              <span className="material-icons">{card.icon}</span>
            </div>
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.88rem", opacity: 0.84, textAlign: "left" }}>{card.description}</p>
            <div className="company-operation-card__stats">
              {card.stats.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </button>
        ))}
      </section>

      {activeTab !== "hub" && (
        <div className="company-module-nav" style={{ display: "flex", flexDirection: "column", gap: "0.9rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>Painel da empresa</h2>
              <p style={{ margin: "0.2rem 0 0", opacity: 0.76, fontSize: "0.9rem" }}>
                NavegaÃ§Ã£o pronta para alternar entre vagas, candidaturas, estagiÃ¡rios e indicadores operacionais.
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setActiveTab("hub")}>Voltar aos cards</button>
          </div>

          <div className="tabs-bar" style={{ display: "flex", gap: "0.5rem", marginBottom: "0", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: "0" }}>
            {tabs.filter((tab) => tab.key !== "hub").map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-btn${activeTab === tab.key ? " tab-btn--active" : ""}`}
                style={{
                  padding: "0.5rem 1rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom: activeTab === tab.key ? "2px solid var(--accent-color, #3b82f6)" : "2px solid transparent",
                  fontWeight: activeTab === tab.key ? 600 : 400,
                  color: activeTab === tab.key ? "var(--accent-color, #3b82f6)" : "inherit",
                  marginBottom: "-1px",
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ marginLeft: "0.4rem", background: "var(--accent-color, #3b82f6)", color: "#fff", borderRadius: "999px", padding: "0 0.4rem", fontSize: "0.7rem" }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab !== "hub" && (
      <div className="panel-card company-sla-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <strong>SLA de triagem (pendentes)</strong>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
            {Math.max(0, pending.length - pendingSlaWarning - pendingSlaCritical)} dentro do SLA
          </span>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
            {pendingSlaWarning} em atenÃ§Ã£o (3-5 dias)
          </span>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
            {pendingSlaCritical} crÃ­ticos (6+ dias)
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", opacity: 0.78 }}>Filtro rÃ¡pido:</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("all")} aria-pressed={slaQuickFilter === "all"}>Todos</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("critical")} aria-pressed={slaQuickFilter === "critical"}>SÃ³ crÃ­ticos</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("warning")} aria-pressed={slaQuickFilter === "warning"}>AtenÃ§Ã£o</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("healthy")} aria-pressed={slaQuickFilter === "healthy"}>Dentro do SLA</button>
          </div>
        </div>
      </div>
      )}

      {activeTab === "vacancies" && (
      <div className="panel-card company-publish-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Publicar vagas</h3>
            <p style={{ margin: "0.25rem 0 0", opacity: 0.75, fontSize: "0.9rem" }}>
              Vagas abertas no momento: <strong>{availableSlots}</strong>
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr)", gap: "0.65rem", width: "100%", maxWidth: 460 }}>
            <label>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>TÃ­tulo da vaga</span>
              <input
                id="vacancy-title"
                aria-label="Titulo da vaga"
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>DescriÃ§Ã£o</span>
              <textarea
                id="vacancy-description"
                aria-label="Descricao"
                rows={3}
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Quantidade</span>
              <input
                id="vacancy-quantity"
                aria-label="Quantidade"
                type="number"
                min="1"
                step="1"
                value={publishSlots}
                onChange={(e) => setPublishSlots(e.target.value)}
                style={{ width: 110, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <button className="btn btn-primary" type="button" disabled={publishing} onClick={handlePublishVacancies}>
              {publishing ? "A processar..." : "Publicar vagas"}
            </button>
          </div>
        </div>
      </div>
      )}

      {activeTab === "vacancies" && (
      <div className="company-vacancy-kpi-grid" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", marginBottom: "1rem" }}>
        <article className="panel-card" style={{ padding: "0.9rem" }}>
          <small style={{ opacity: 0.72 }}>Vagas ativas</small>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{vacancyMetrics.open}</div>
        </article>
        <article className="panel-card" style={{ padding: "0.9rem" }}>
          <small style={{ opacity: 0.72 }}>Vagas encerradas</small>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{vacancyMetrics.closed}</div>
        </article>
        <article className="panel-card" style={{ padding: "0.9rem" }}>
          <small style={{ opacity: 0.72 }}>Candidaturas ligadas</small>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{vacancyMetrics.applications}</div>
        </article>
        <article className="panel-card" style={{ padding: "0.9rem" }}>
          <small style={{ opacity: 0.72 }}>OcupaÃ§Ã£o mÃ©dia</small>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{vacancyMetrics.occupancyAvg}%</div>
        </article>
      </div>
      )}

      {activeTab === "vacancies" && (
      <div className="panel-card company-vacancies-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Vagas publicadas</h3>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "0.95rem" }}>
          <label>
            <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Pesquisar vaga</span>
            <input
              type="text"
              value={vacancySearch}
              onChange={(e) => setVacancySearch(e.target.value)}
              placeholder="TÃ­tulo ou descriÃ§Ã£o"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
            />
          </label>

          <label>
            <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Estado</span>
            <select
              value={vacancyStatusFilter}
              onChange={(e) => setVacancyStatusFilter(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
            >
              <option value="ALL">Todas</option>
              <option value="OPEN">Abertas</option>
              <option value="CLOSED">Encerradas</option>
            </select>
          </label>

          <label>
            <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Ordenar</span>
            <select
              value={vacancySortMode}
              onChange={(e) => setVacancySortMode(e.target.value)}
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
            >
              <option value="recent">Mais recentes</option>
              <option value="occupancy">Maior ocupaÃ§Ã£o</option>
              <option value="slots">Mais vagas disponÃ­veis</option>
              <option value="title">TÃ­tulo (A-Z)</option>
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setVacancySearch("");
                setVacancyStatusFilter("ALL");
                setVacancySortMode("recent");
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>

        {filteredVacancies.length === 0 ? (
          <p className="empty-state-text">Nenhuma vaga publicada ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {filteredVacancies.map((vacancy) => {
              const pendingForVacancy = applications.filter(
                (app) => app.vacancy_id === vacancy.id && app.status === "PENDING"
              ).length;
              const acceptedForVacancy = applications.filter(
                (app) => app.vacancy_id === vacancy.id && app.status === "ACCEPTED"
              ).length;
              const rejectedForVacancy = applications.filter(
                (app) => app.vacancy_id === vacancy.id && app.status === "REJECTED"
              ).length;
              const totalSlots = Number(vacancy.total_slots ?? 0);
              const availableForVacancy = Math.max(0, Number(vacancy.available_slots ?? 0));
              const occupancy = totalSlots > 0
                ? Math.min(100, Math.round(((totalSlots - availableForVacancy) / totalSlots) * 100))
                : 0;

              return (
              <div key={vacancy.id} className="company-dashboard-vacancy-row" style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 10, padding: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <strong>{vacancy.title}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                      {vacancy.status} Â· {vacancy.available_slots}/{vacancy.total_slots} vagas
                    </span>
                    {pendingForVacancy > 0 && (
                      <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.45rem", borderRadius: 999, background: "#fff7ed", color: "#b45309", fontWeight: 600 }}>
                        {pendingForVacancy} pendente(s)
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setVacancyFilter(vacancy.id);
                        setActiveTab("pending");
                      }}
                    >
                      Ver candidaturas
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={togglingVacancyId === vacancy.id}
                      onClick={() => setVacancyToggleTarget(vacancy)}
                    >
                      {togglingVacancyId === vacancy.id
                        ? "A processar..."
                        : vacancy.status === "OPEN"
                        ? "Fechar vaga"
                        : "Reabrir vaga"}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: "0.45rem", fontSize: "0.78rem", opacity: 0.72 }}>
                  OcupaÃ§Ã£o da vaga: {occupancy}%
                </div>
                <div style={{ marginTop: "0.45rem", height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                  <div style={{ width: `${occupancy}%`, height: "100%", background: "linear-gradient(90deg, #0ea5e9, #0284c7)" }} />
                </div>
                <div style={{ marginTop: "0.55rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  <span className="company-operation-card__stats" style={{ marginTop: 0 }}>
                    <span>{pendingForVacancy} pendente(s)</span>
                  </span>
                  <span className="company-operation-card__stats" style={{ marginTop: 0 }}>
                    <span>{acceptedForVacancy} aceite(s)</span>
                  </span>
                  <span className="company-operation-card__stats" style={{ marginTop: 0 }}>
                    <span>{rejectedForVacancy} rejeitada(s)</span>
                  </span>
                </div>
                {vacancy.description && <p style={{ margin: "0.4rem 0 0", opacity: 0.8 }}>{vacancy.description}</p>}
              </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* KPIs */}
      {activeTab !== "hub" && (
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="panel-card kpi-card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <span className="material-icons" style={{ fontSize: "2rem", marginBottom: "0.5rem", display: "block" }}>{kpi.icon}</span>
            <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.25rem" }}>{kpi.label}</div>
          </div>
        ))}
      </div>
      )}

      {/* Tab: VisÃ£o Geral */}
      {activeTab === "overview" && (
        <CompanyOverviewPanel
          partner={partner}
          applications={applications}
          vacancies={vacancies}
          t={t}
        />
      )}

      {/* Tab: GestÃ£o de EstagiÃ¡rios */}
      {activeTab === "management" && (
        <InternManagementPanel
          applications={applications}
          trainingAreas={trainingAreas}
            partner={partner}
            showToast={showToast}
          t={t}
        />
      )}

      {/* Tab: Interns with timeline */}
        {/* Tab: EstagiÃ¡rios â€” acompanhamento individual rico */}
        {activeTab === "interns" && (
          <div className="company-dashboard-internships">
            {accepted.length === 0 ? (
              <p className="empty-state-text">{t("companyDashboard.noInterns")}</p>
            ) : (
              <>
                {/* Pesquisa de estagiÃ¡rios */}
                <div style={{ marginBottom: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
                  <input
                    type="text"
                    value={internSearch}
                    onChange={(e) => setInternSearch(e.target.value)}
                    placeholder="Pesquisar estagiÃ¡rio por nome ou e-mail..."
                    style={{ width: "100%", minWidth: 220, padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                  />
                  <select
                    value={internSectorFilter}
                    onChange={(e) => setInternSectorFilter(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                  >
                    <option value="all">Todos os setores</option>
                    {internSectorOptions.map((sector) => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                  <select
                    value={internAreaFilter}
                    onChange={(e) => setInternAreaFilter(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                  >
                    <option value="all">Todas as Ã¡reas</option>
                    {internAreaOptions.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                  </select>
                  <select
                    value={internPhaseFilter}
                    onChange={(e) => setInternPhaseFilter(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                  >
                    <option value="all">Todas as fases</option>
                    <option value="onboarding">Fase de integraÃ§Ã£o</option>
                    <option value="active">EstÃ¡gio em desenvolvimento</option>
                    <option value="contract">Potencial contratual</option>
                  </select>
                  <select
                    value={internSortMode}
                    onChange={(e) => setInternSortMode(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                  >
                    <option value="newest">InÃ­cio mais recente</option>
                    <option value="oldest">InÃ­cio mais antigo</option>
                    <option value="phase">Maior tempo de estÃ¡gio</option>
                    <option value="name">Nome (A-Z)</option>
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                    <button
                      className="btn ghost"
                      onClick={() => {
                        setInternSearch("");
                        setInternSectorFilter("all");
                        setInternAreaFilter("all");
                        setInternPhaseFilter("all");
                        setInternSortMode("newest");
                      }}
                    >
                      Limpar
                    </button>
                    <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>
                      {filteredInternRecords.length} estagiÃ¡rio(s)
                    </span>
                  </div>
                </div>

                {/* Cards de estagiÃ¡rios */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {sectorEntries.map(([sectorName, records]) => (
                    <section key={sectorName} className="panel-card" style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", flexWrap: "wrap", alignItems: "center", marginBottom: "0.7rem" }}>
                        <h3 style={{ margin: 0, fontSize: "1rem" }}>{sectorName}</h3>
                        <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#e0f2fe", color: "#075985", fontWeight: 700 }}>
                          {records.length} estagiÃ¡rio(s)
                        </span>
                      </div>

                      <div style={{ overflowX: "auto", marginBottom: "0.75rem" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "0.45rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>EstagiÃ¡rio</th>
                              <th style={{ textAlign: "left", padding: "0.45rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Ãrea</th>
                              <th style={{ textAlign: "left", padding: "0.45rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>InÃ­cio</th>
                              <th style={{ textAlign: "left", padding: "0.45rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Fase</th>
                              <th style={{ textAlign: "left", padding: "0.45rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>SituaÃ§Ã£o</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.map((record) => (
                              <tr key={`row-${record.app.id}`}>
                                <td style={{ padding: "0.45rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
                                  <strong>{record.app.student?.full_name ?? "â€”"}</strong>
                                  <div style={{ fontSize: "0.75rem", opacity: 0.7 }}>{record.app.student?.email ?? ""}</div>
                                </td>
                                <td style={{ padding: "0.45rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{record.areaName}</td>
                                <td style={{ padding: "0.45rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
                                  {record.referenceDate ? new Date(record.referenceDate).toLocaleDateString("pt-AO") : "â€”"}
                                </td>
                                <td style={{ padding: "0.45rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
                                  <span style={{ fontSize: "0.74rem", borderRadius: 999, padding: "0.12rem 0.45rem", background: record.phase.tone === "contract" ? "#ede9fe" : record.phase.tone === "active" ? "#dcfce7" : "#e0f2fe", color: record.phase.tone === "contract" ? "#5b21b6" : record.phase.tone === "active" ? "#166534" : "#075985", fontWeight: 700 }}>
                                    {record.phase.label}
                                  </span>
                                </td>
                                <td style={{ padding: "0.45rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
                                  {record.phase.days} dia(s) de estÃ¡gio
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                        {records.map((record) => {
                          const app = record.app;
                          const isExpanded = expandedInternId === app.id;
                          return (
                            <div key={app.id} className={`panel-card company-dashboard-intern-card${isExpanded ? " company-dashboard-intern-card--expanded" : ""}`} style={{ padding: 0, overflow: "hidden" }}>
                          {/* CabeÃ§alho do card â€” clicÃ¡vel para expandir */}
                          <button
                            type="button"
                            onClick={() => setExpandedInternId(isExpanded ? null : app.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "0.85rem",
                              width: "100%", padding: "1rem 1.25rem",
                              background: isExpanded ? "var(--surface-subtle, #f8fafc)" : "transparent",
                              border: "none", borderBottom: isExpanded ? "1px solid var(--border-color, #e2e8f0)" : "none",
                              cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <span className="material-icons" style={{ fontSize: "2rem", color: "var(--accent-color, #3b82f6)", flexShrink: 0 }}>account_circle</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700 }}>{app.student?.full_name ?? "â€”"} Â· {record.areaName}</div>
                              <div style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                                {app.student?.email ?? ""}
                                {app.vacancy?.title ? ` Â· ${app.vacancy.title}` : ""}
                                {app.accepted_at ? ` Â· Aceite: ${new Date(app.accepted_at).toLocaleDateString("pt-AO")}` : ""}
                              </div>
                            </div>
                            <span className="material-icons" style={{ opacity: 0.5, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>
                              expand_more
                            </span>
                          </button>

                          {/* Painel de detalhe expandÃ­vel */}
                          {isExpanded && (
                            <div style={{ padding: "1.25rem" }}>
                              <InternDetailPanel
                                app={app}
                                partnerId={partner.id}
                                isCompanyView={true}
                                t={t}
                              />
                            </div>
                          )}
                        </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      {/* Tab: Applications */}
      {activeTab !== "interns" && (
        <div className="company-dashboard-applications">
          <div style={{ marginBottom: "1rem", display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label>
              <span style={{ display: "block", fontSize: "0.82rem", opacity: 0.75, marginBottom: "0.35rem" }}>
                Filtrar candidaturas por vaga
              </span>
              <select
                value={vacancyFilter}
                onChange={(e) => setVacancyFilter(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              >
                <option value="ALL">Todas as vagas</option>
                {vacancies.map((vacancy) => (
                  <option key={vacancy.id} value={vacancy.id}>
                    {vacancy.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={{ display: "block", fontSize: "0.82rem", opacity: 0.75, marginBottom: "0.35rem" }}>
                Procurar candidato
              </span>
              <input
                type="text"
                value={applicationSearch}
                onChange={(e) => setApplicationSearch(e.target.value)}
                placeholder="Nome, email ou vaga"
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>

            <label>
              <span style={{ display: "block", fontSize: "0.82rem", opacity: 0.75, marginBottom: "0.35rem" }}>
                Ordenar por
              </span>
              <select
                value={applicationSort}
                onChange={(e) => setApplicationSort(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="urgency">Maior urgÃªncia</option>
              </select>
            </label>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setVacancyFilter("ALL");
                  setApplicationSearch("");
                  setApplicationSort("recent");
                }}
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {activeTab === "pending" && (
            <div className="panel-card" style={{ padding: "0.9rem", marginBottom: "0.85rem" }}>
              <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const visibleIds = sortedTabApps.map((app) => app.id);
                    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedApplicationIds.has(id));
                    if (allSelected) {
                      setSelectedApplicationIds(new Set());
                    } else {
                      setSelectedApplicationIds(new Set(visibleIds));
                    }
                  }}
                >
                  {sortedTabApps.length > 0 && sortedTabApps.every((app) => selectedApplicationIds.has(app.id))
                    ? "Limpar seleÃ§Ã£o"
                    : "Selecionar visÃ­veis"}
                </button>

                <span style={{ fontSize: "0.82rem", opacity: 0.8 }}>
                  {sortedTabApps.filter((app) => selectedApplicationIds.has(app.id)).length} selecionada(s)
                </span>

                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  disabled={batchProcessing || sortedTabApps.every((app) => !selectedApplicationIds.has(app.id))}
                  onClick={() => requestBatchDecision("accept")}
                >
                  {batchProcessing ? "A processar..." : "Aceitar selecionadas"}
                </button>

                <input
                  type="text"
                  value={batchRejectReason}
                  onChange={(e) => setBatchRejectReason(e.target.value)}
                  placeholder="Motivo de rejeiÃ§Ã£o em lote (mÃ­n. 10 car.)"
                  style={{ minWidth: 260, padding: "0.4rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                />

                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={
                    batchProcessing
                    || batchRejectReason.trim().length < 10
                    || sortedTabApps.every((app) => !selectedApplicationIds.has(app.id))
                  }
                  onClick={() => requestBatchDecision("reject")}
                >
                  {batchProcessing ? "A processar..." : "Rejeitar selecionadas"}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={exportBatchCsv}
                  disabled={!batchReportRows.length}
                >
                  Copiar relatÃ³rio CSV
                </button>
              </div>

              {lastBatchSummary && (
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.8rem", opacity: 0.8 }}>
                  Ãšltimo lote: {lastBatchSummary.action === "accept" ? "aceitaÃ§Ã£o" : "rejeiÃ§Ã£o"} Â· {lastBatchSummary.successCount} sucesso(s), {lastBatchSummary.skippedCount} ignorada(s), {lastBatchSummary.errorCount} erro(s) Â· {new Date(lastBatchSummary.processedAt).toLocaleString("pt-PT")}.
                </p>
              )}

              {batchReportRows.length > 0 && (
                <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border-color, #e5e7eb)", paddingTop: "0.8rem" }}>
                  <div
                    style={{
                      display: "grid",
                      gap: "0.55rem",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      marginBottom: "0.7rem",
                    }}
                  >
                    <input
                      type="text"
                      value={reportBatchFilter}
                      placeholder="Filtrar por Batch ID"
                      onChange={(e) => setReportBatchFilter(e.target.value)}
                      style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                    />
                    <select
                      value={reportActionFilter}
                      onChange={(e) => setReportActionFilter(e.target.value)}
                      style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                    >
                      <option value="all">AÃ§Ã£o: todas</option>
                      <option value="accept">AÃ§Ã£o: aceitaÃ§Ã£o</option>
                      <option value="reject">AÃ§Ã£o: rejeiÃ§Ã£o</option>
                    </select>
                    <select
                      value={reportResultFilter}
                      onChange={(e) => setReportResultFilter(e.target.value)}
                      style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                    >
                      <option value="all">Resultado: todos</option>
                      <option value="SUCCESS">Resultado: sucesso</option>
                      <option value="SKIPPED">Resultado: ignorado</option>
                      <option value="ERROR">Resultado: erro</option>
                    </select>
                    <input
                      type="date"
                      value={reportDateFrom}
                      onChange={(e) => setReportDateFrom(e.target.value)}
                      style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                    />
                    <input
                      type="date"
                      value={reportDateTo}
                      onChange={(e) => setReportDateTo(e.target.value)}
                      style={{ padding: "0.45rem 0.65rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setReportBatchFilter("");
                        setReportActionFilter("all");
                        setReportResultFilter("all");
                        setReportDateFrom("");
                        setReportDateTo("");
                      }}
                    >
                      Limpar filtros relatÃ³rio
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.88rem" }}>RelatÃ³rio operacional (em tela)</strong>
                    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={safeReportPage <= 1}
                        onClick={() => setReportPage((prev) => Math.max(1, prev - 1))}
                      >
                        Anterior
                      </button>
                      <span style={{ fontSize: "0.78rem", opacity: 0.8 }}>
                        PÃ¡gina {safeReportPage} de {reportTotalPages} Â· {filteredReportRows.length} registo(s)
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={safeReportPage >= reportTotalPages}
                        onClick={() => setReportPage((prev) => Math.min(reportTotalPages, prev + 1))}
                      >
                        Seguinte
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto", marginTop: "0.65rem" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Data</th>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Batch</th>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>AÃ§Ã£o</th>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Candidato</th>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Resultado</th>
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleReportRows.map((row, index) => (
                          <tr key={`${row.processedAt}-${row.studentName}-${index}`}>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{new Date(row.processedAt).toLocaleString("pt-PT")}</td>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)", fontFamily: "monospace", fontSize: "0.74rem" }}>{String(row.batchId ?? "-").slice(0, 8)}</td>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{row.action === "accept" ? "AceitaÃ§Ã£o" : "RejeiÃ§Ã£o"}</td>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{row.studentName}</td>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{row.result}</td>
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{row.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {sortedTabApps.length === 0 ? (
            <p className="empty-state-text">{t("companyDashboard.noApplications")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {sortedTabApps.map((app) => {
                const pendingDays = getPendingDays(app.applied_at);
                const sla = getSlaMeta(pendingDays);
                const appVacancy = vacancies.find((vacancy) => vacancy.id === app.vacancy_id);
                const canAccept = appVacancy?.status === "OPEN" && Number(appVacancy?.available_slots ?? 0) > 0;
                const hasCv = Boolean(app.cv_url || app.student?.cv_url);
                const hasCoverLetter = Boolean(app.cover_letter_url || app.student?.cover_letter_url);
                const hasInternshipLetter = Boolean(app.internship_letter_url || app.student?.internship_letter_url);

                return (
                <div key={app.id} className={`panel-card company-dashboard-app-card company-dashboard-app-card--${activeTab === "pending" ? "pending" : activeTab === "accepted" ? "accepted" : "rejected"}`} style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  {activeTab === "pending" && (
                    <input
                      type="checkbox"
                      checked={selectedApplicationIds.has(app.id)}
                      onChange={(e) => {
                        setSelectedApplicationIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(app.id);
                          else next.delete(app.id);
                          return next;
                        });
                      }}
                      aria-label={`Selecionar candidatura de ${app.student?.full_name ?? "candidato"}`}
                    />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 200 }}>
                    <span className="material-icons" style={{ fontSize: "2.5rem" }}>account_circle</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{app.student?.full_name ?? "â€”"}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>{app.student?.email ?? ""}</div>
                      {app.vacancy?.title && (
                        <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>Vaga: {app.vacancy.title}</div>
                      )}
                      {activeTab === "pending" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.75rem", borderRadius: 999, padding: "0.15rem 0.5rem", fontWeight: 600, color: sla.color, background: sla.background }}>
                            {sla.label}
                          </span>
                          <span style={{ fontSize: "0.75rem", opacity: 0.78 }}>
                            {pendingDays} dia(s) em anÃ¡lise
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 140 }}>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "â€”"}
                    </div>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        display: "inline-flex",
                        width: "fit-content",
                        borderRadius: 999,
                        padding: "0.15rem 0.5rem",
                        fontWeight: 600,
                        background: activeTab === "pending" ? "#fef3c7" : activeTab === "accepted" ? "#dcfce7" : "#fee2e2",
                        color: activeTab === "pending" ? "#92400e" : activeTab === "accepted" ? "#166534" : "#991b1b",
                      }}
                    >
                      {activeTab === "pending" ? "Pendente" : activeTab === "accepted" ? "Aceite" : "Rejeitada"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                    {hasCv && (
                      <span className="btn btn-ghost btn-sm" aria-label="CV disponÃ­vel">
                        CV disponÃ­vel
                      </span>
                    )}
                    {hasCoverLetter && (
                      <span className="btn btn-ghost btn-sm" aria-label="Carta de apresentaÃ§Ã£o disponÃ­vel">
                        Carta disponÃ­vel
                      </span>
                    )}
                    {hasInternshipLetter && (
                      <span className="btn btn-ghost btn-sm" aria-label="DeclaraÃ§Ã£o disponÃ­vel">
                        DeclaraÃ§Ã£o disponÃ­vel
                      </span>
                    )}
                  </div>
                  {activeTab === "pending" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={!!processingId || !canAccept}
                        title={canAccept ? "" : "Vaga indisponÃ­vel para aceitaÃ§Ã£o"}
                        onClick={() => {
                          if (!canAccept) {
                            showToast("Esta vaga nÃ£o estÃ¡ disponÃ­vel para aceitar candidaturas.", "error");
                            return;
                          }
                          setActionTarget({ id: app.id, action: "accept", notes: "" });
                        }}
                      >
                        <span className="material-icons" style={{ fontSize: "1rem" }}>check</span>
                        {t("companyDashboard.accept")}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={!!processingId}
                        onClick={() => setActionTarget({ id: app.id, action: "reject", notes: "" })}
                      >
                        <span className="material-icons" style={{ fontSize: "1rem" }}>close</span>
                        {t("companyDashboard.reject")}
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation modal */}
      {actionTarget && (
        <div
          className="modal-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setActionTarget(null); }}
        >
          <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 420 }}>
            <h3 style={{ marginBottom: "1rem" }}>
              {actionTarget.action === "accept" ? t("companyDashboard.accept") : t("companyDashboard.reject")}
            </h3>
            <label style={{ display: "block", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7, display: "block", marginBottom: "0.4rem" }}>
                {actionTarget.action === "accept" ? t("companyDashboard.acceptNotes") : t("companyDashboard.rejectReason")}
              </span>
              <textarea
                rows={3}
                placeholder={actionTarget.action === "reject" ? "Ex.: Perfil nÃ£o alinhado Ã  vaga nesta fase." : "Opcional"}
                style={{ width: "100%", resize: "vertical", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border-color, #e2e8f0)" }}
                value={actionTarget.notes}
                onChange={(e) => setActionTarget((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
            {actionTarget.action === "reject" && (actionTarget.notes || "").trim().length < 10 && (
              <p style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "#b91c1c" }}>
                O motivo de rejeiÃ§Ã£o deve conter pelo menos 10 caracteres.
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn-ghost" onClick={() => setActionTarget(null)}>
                {t("companyDashboard.cancel")}
              </button>
              <button
                className={`btn ${actionTarget.action === "accept" ? "btn-success" : "btn-danger"}`}
                disabled={!!processingId || (actionTarget.action === "reject" && (actionTarget.notes || "").trim().length < 10)}
                onClick={actionTarget.action === "accept" ? handleAccept : handleReject}
              >
                {processingId ? "..." : t("companyDashboard.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {vacancyToggleTarget && (
        <div
          className="modal-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setVacancyToggleTarget(null);
            }
          }}
        >
          <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 460 }}>
            <h3 style={{ marginBottom: "0.75rem" }}>
              {vacancyToggleTarget.status === "OPEN" ? "Fechar vaga" : "Reabrir vaga"}
            </h3>
            <p style={{ marginTop: 0, opacity: 0.8 }}>
              {vacancyToggleTarget.status === "OPEN"
                ? `Confirma o fecho da vaga \"${vacancyToggleTarget.title}\"?`
                : `Confirma a reabertura da vaga \"${vacancyToggleTarget.title}\"?`}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button className="btn btn-ghost" type="button" onClick={() => setVacancyToggleTarget(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={togglingVacancyId === vacancyToggleTarget.id}
                onClick={async () => {
                  const target = vacancyToggleTarget;
                  setVacancyToggleTarget(null);
                  await handleToggleVacancyStatus(target);
                }}
              >
                {togglingVacancyId === vacancyToggleTarget.id ? "A processar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchConfirmTarget && (
        <div
          className="modal-overlay"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setBatchConfirmTarget(null);
            }
          }}
        >
          <div className="modal-content panel-card" style={{ padding: "2rem", width: "100%", maxWidth: 460 }}>
            <h3 style={{ marginBottom: "0.75rem" }}>
              Confirmar aÃ§Ã£o em lote
            </h3>
            <p style={{ marginTop: 0, opacity: 0.82 }}>
              {batchConfirmTarget.action === "accept"
                ? `Confirma a aceitaÃ§Ã£o de ${batchConfirmTarget.selectedCount} candidatura(s) selecionada(s)?`
                : `Confirma a rejeiÃ§Ã£o de ${batchConfirmTarget.selectedCount} candidatura(s) selecionada(s)?`}
            </p>
            {batchConfirmTarget.action === "reject" && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.84rem", opacity: 0.85 }}>
                Motivo aplicado: {batchRejectReason}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn btn-ghost" type="button" onClick={() => setBatchConfirmTarget(null)}>
                Cancelar
              </button>
              <button
                className={`btn ${batchConfirmTarget.action === "accept" ? "btn-success" : "btn-danger"}`}
                type="button"
                disabled={batchProcessing}
                onClick={() => handleBatchDecision(batchConfirmTarget.action)}
              >
                {batchProcessing ? "A processar..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
