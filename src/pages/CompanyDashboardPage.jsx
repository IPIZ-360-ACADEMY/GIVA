import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
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
import {
  insertCompanyBatchAuditRows,
  listCompanyBatchAuditRows,
} from "../services/companyBatchAuditService.js";
import CompanyProgressTimeline from "../components/CompanyProgressTimeline.jsx";
import PageHeader from "../components/PageHeader.jsx";

function getPendingDays(appliedAt) {
  if (!appliedAt) return 0;
  const started = new Date(appliedAt).getTime();
  if (!Number.isFinite(started)) return 0;
  const diffMs = Date.now() - started;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function parseSafeDate(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function getSlaMeta(days) {
  if (days >= 6) {
    return { label: "SLA crítico", color: "#b91c1c", background: "#fee2e2" };
  }
  if (days >= 3) {
    return { label: "SLA atenção", color: "#92400e", background: "#fef3c7" };
  }
  return { label: "Dentro do SLA", color: "#166534", background: "#dcfce7" };
}

export default function CompanyDashboardPage() {
  const { t, showToast } = useOutletContext();
  const { authProfile, user } = useAuth();

  const [partner, setPartner] = useState(null);
  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [actionTarget, setActionTarget] = useState(null); // { id, action: "accept"|"reject", notes: "" }
  const [publishSlots, setPublishSlots] = useState("1");
  const [publishTitle, setPublishTitle] = useState("Estagio Profissional");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [togglingVacancyId, setTogglingVacancyId] = useState(null);
  const [bootstrapCompanyName, setBootstrapCompanyName] = useState("");
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
    const p = await getMyPartner();
    setPartner(p);
    if (!p && authProfile?.displayName) {
      setBootstrapCompanyName(authProfile.displayName);
    }
    if (p?.id) {
      const apps = await listPartnerApplications(p.id);
      setApplications(apps || []);
      const publishedVacancies = await listPartnerVacancies(p.id, { includeClosed: true });
      setVacancies(publishedVacancies || []);
      const persistedAuditRows = await listCompanyBatchAuditRows(p.id, { limit: 500 });
      setBatchReportRows(persistedAuditRows || []);
    } else {
      setVacancies([]);
      setApplications([]);
      setBatchReportRows([]);
      setLastBatchSummary(null);
    }
    setLoading(false);
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
      showToast("Informe o título da vaga.", "error");
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
      showToast("Não foi possível publicar vagas.", "error");
      setPublishing(false);
      return;
    }

    showToast("Vaga publicada com sucesso.", "success");
    setPublishTitle("Estágio Profissional");
    setPublishDescription("");
    setPublishSlots("1");
    await load();
    setPublishing(false);
  }

  async function handleCreateCompanyRecord() {
    if (publishing) {
      return;
    }

    const empresa = String(bootstrapCompanyName ?? "").trim();
    const slots = Math.max(1, Number(publishSlots) || 1);
    const title = String(publishTitle ?? "").trim() || "Estágio Profissional";

    if (!empresa) {
      showToast("Informe o nome da empresa para ativar o painel.", "error");
      return;
    }

    setPublishing(true);
    const created = await createPartner({
      empresa,
      nif: "",
      setor: "tech",
      areas: [],
      vagas: 0,
      sla: "",
      responsavel: authProfile?.displayName || empresa,
      telefone: "",
      email: authProfile?.email || "",
      website: "",
      endereco: "",
      photoPreview: null,
    }).catch(() => null);

    if (!created) {
      showToast("Não foi possível criar o registo da empresa.", "error");
      setPublishing(false);
      return;
    }

    const firstVacancy = await createPartnerVacancy({
      partner_id: created.id,
      title,
      description: publishDescription,
      total_slots: slots,
    }).catch(() => null);

    if (!firstVacancy) {
      showToast("Empresa criada, mas falhou ao publicar a vaga inicial.", "error");
      setPublishing(false);
      await load();
      return;
    }

    showToast("Registo da empresa criado e vagas publicadas.", "success");
    setPublishTitle("Estágio Profissional");
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
        showToast("Não é possível fechar a vaga: existem candidaturas pendentes.", "error");
        return;
      }
    }

    setTogglingVacancyId(vacancy.id);
    const result = await updatePartnerVacancyStatus(vacancy.id, nextStatus).catch(() => null);

    if (!result) {
      showToast("Não foi possível atualizar o estado da vaga.", "error");
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
      showToast("Esta vaga não está aberta para novas aceitações.", "error");
      setActionTarget(null);
      return;
    }

    if (Number(targetVacancy.available_slots ?? 0) <= 0) {
      showToast("Esta vaga já não possui vagas disponíveis.", "error");
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
      showToast("Informe um motivo de rejeição com pelo menos 10 caracteres.", "error");
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
      showToast("Informe um motivo de rejeição com pelo menos 10 caracteres.", "error");
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
        const ok = await acceptJobApplication(app.id, "Aprovada em ação em lote.");
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
            reason: "Aprovada em ação em lote",
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
      showToast("Informe um motivo de rejeição com pelo menos 10 caracteres.", "error");
      return;
    }
    setBatchConfirmTarget({
      action,
      selectedCount: selectedPendingApps.length,
    });
  }

  function exportBatchCsv() {
    if (!batchReportRows.length) {
      showToast("Ainda não há dados para exportar.", "error");
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
        showToast("Relatório CSV copiado para a área de transferência.", "success");
      })
      .catch(() => {
        showToast("Não foi possível copiar o relatório CSV.", "error");
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
    { key: "pending", label: t("companyDashboard.tab.pending"), count: pending.length },
    { key: "accepted", label: t("companyDashboard.tab.accepted"), count: accepted.length },
    { key: "rejected", label: t("companyDashboard.tab.rejected"), count: rejected.length },
    { key: "interns", label: t("companyDashboard.interns"), count: accepted.length },
  ];

  const tabApps = { pending, accepted, rejected }[activeTab] ?? [];
  const filteredTabApps =
    vacancyFilter === "ALL"
      ? tabApps
      : tabApps.filter((app) => app.vacancy_id === vacancyFilter);
  const slaFilteredTabApps = activeTab !== "pending"
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <span className="material-icons spinning">refresh</span>
        </div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="page-container">
        <PageHeader title={t("companyDashboard.title")} description={t("companyDashboard.description")} />
        <div className="empty-state" style={{ maxWidth: 520, margin: "0 auto" }}>
          <span className="material-icons">business_center</span>
          <p>{t("companyDashboard.noPartner")}</p>
          <div className="panel-card" style={{ width: "100%", padding: "1rem", marginTop: "1rem", textAlign: "left" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Ativar conta empresarial</h3>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>Nome da empresa</span>
              <input
                type="text"
                value={bootstrapCompanyName}
                onChange={(e) => setBootstrapCompanyName(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.95rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>Título da vaga</span>
              <input
                type="text"
                value={publishTitle}
                onChange={(e) => setPublishTitle(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.95rem" }}>
              <span style={{ display: "block", fontSize: "0.85rem", opacity: 0.75, marginBottom: "0.35rem" }}>Descrição</span>
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
            <button className="btn btn-primary" type="button" onClick={handleCreateCompanyRecord} disabled={publishing}>
              {publishing ? "A processar..." : "Criar empresa e publicar vagas"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <PageHeader
        title={partner.empresa ?? t("companyDashboard.title")}
        description={t("companyDashboard.description")}
      />

      <div className="panel-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <strong>SLA de triagem (pendentes)</strong>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#dcfce7", color: "#166534", fontWeight: 600 }}>
            {Math.max(0, pending.length - pendingSlaWarning - pendingSlaCritical)} dentro do SLA
          </span>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
            {pendingSlaWarning} em atenção (3-5 dias)
          </span>
          <span style={{ fontSize: "0.78rem", borderRadius: 999, padding: "0.2rem 0.55rem", background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
            {pendingSlaCritical} críticos (6+ dias)
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", opacity: 0.78 }}>Filtro rápido:</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("all")} aria-pressed={slaQuickFilter === "all"}>Todos</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("critical")} aria-pressed={slaQuickFilter === "critical"}>Só críticos</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("warning")} aria-pressed={slaQuickFilter === "warning"}>Atenção</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSlaQuickFilter("healthy")} aria-pressed={slaQuickFilter === "healthy"}>Dentro do SLA</button>
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Publicar vagas</h3>
            <p style={{ margin: "0.25rem 0 0", opacity: 0.75, fontSize: "0.9rem" }}>
              Vagas abertas no momento: <strong>{availableSlots}</strong>
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr)", gap: "0.65rem", width: "100%", maxWidth: 460 }}>
            <label>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Título da vaga</span>
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
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.75, marginBottom: "0.25rem" }}>Descrição</span>
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

      <div className="panel-card" style={{ padding: "1rem", marginBottom: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Vagas publicadas</h3>
        {vacancies.length === 0 ? (
          <p className="empty-state-text">Nenhuma vaga publicada ainda.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {vacancies.map((vacancy) => {
              const pendingForVacancy = applications.filter(
                (app) => app.vacancy_id === vacancy.id && app.status === "PENDING"
              ).length;
              const totalSlots = Number(vacancy.total_slots ?? 0);
              const availableForVacancy = Math.max(0, Number(vacancy.available_slots ?? 0));
              const occupancy = totalSlots > 0
                ? Math.min(100, Math.round(((totalSlots - availableForVacancy) / totalSlots) * 100))
                : 0;

              return (
              <div key={vacancy.id} style={{ border: "1px solid var(--border-color, #e2e8f0)", borderRadius: 10, padding: "0.85rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <strong>{vacancy.title}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", opacity: 0.75 }}>
                      {vacancy.status} · {vacancy.available_slots}/{vacancy.total_slots} vagas
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
                  Ocupação da vaga: {occupancy}%
                </div>
                {vacancy.description && <p style={{ margin: "0.4rem 0 0", opacity: 0.8 }}>{vacancy.description}</p>}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className="panel-card kpi-card" style={{ textAlign: "center", padding: "1.25rem" }}>
            <span className="material-icons" style={{ fontSize: "2rem", marginBottom: "0.5rem", display: "block" }}>{kpi.icon}</span>
            <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.25rem" }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs-bar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: "0" }}>
        {tabs.map((tab) => (
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

      {/* Tab: Interns with timeline */}
      {activeTab === "interns" && (
        <div>
          {accepted.length === 0 ? (
            <p className="empty-state-text">{t("companyDashboard.noInterns")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {accepted.map((app) => (
                <div key={app.id} className="panel-card" style={{ padding: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    <span className="material-icons" style={{ fontSize: "2.5rem" }}>account_circle</span>
                    <span style={{ fontWeight: 600, fontSize: "1.05rem" }}>{app.student?.full_name ?? "—"}</span>
                  </div>
                  <CompanyProgressTimeline
                    studentId={app.student?.id}
                    partnerId={partner.id}
                    t={t}
                    isCompanyView={true}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Applications */}
      {activeTab !== "interns" && (
        <div>
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
                <option value="urgency">Maior urgência</option>
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
                    ? "Limpar seleção"
                    : "Selecionar visíveis"}
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
                  placeholder="Motivo de rejeição em lote (mín. 10 car.)"
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
                  Copiar relatório CSV
                </button>
              </div>

              {lastBatchSummary && (
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.8rem", opacity: 0.8 }}>
                  Último lote: {lastBatchSummary.action === "accept" ? "aceitação" : "rejeição"} · {lastBatchSummary.successCount} sucesso(s), {lastBatchSummary.skippedCount} ignorada(s), {lastBatchSummary.errorCount} erro(s) · {new Date(lastBatchSummary.processedAt).toLocaleString("pt-PT")}.
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
                      <option value="all">Ação: todas</option>
                      <option value="accept">Ação: aceitação</option>
                      <option value="reject">Ação: rejeição</option>
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
                      Limpar filtros relatório
                    </button>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: "0.88rem" }}>Relatório operacional (em tela)</strong>
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
                        Página {safeReportPage} de {reportTotalPages} · {filteredReportRows.length} registo(s)
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
                          <th style={{ textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-color, #e5e7eb)" }}>Ação</th>
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
                            <td style={{ padding: "0.35rem", borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>{row.action === "accept" ? "Aceitação" : "Rejeição"}</td>
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
                <div key={app.id} className="panel-card" style={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
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
                      <div style={{ fontWeight: 600 }}>{app.student?.full_name ?? "—"}</div>
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
                            {pendingDays} dia(s) em análise
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 140 }}>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                      {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : "—"}
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
                      <span className="btn btn-ghost btn-sm" aria-label="CV disponível">
                        CV disponível
                      </span>
                    )}
                    {hasCoverLetter && (
                      <span className="btn btn-ghost btn-sm" aria-label="Carta de apresentação disponível">
                        Carta disponível
                      </span>
                    )}
                    {hasInternshipLetter && (
                      <span className="btn btn-ghost btn-sm" aria-label="Declaração disponível">
                        Declaração disponível
                      </span>
                    )}
                  </div>
                  {activeTab === "pending" && (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-success btn-sm"
                        disabled={!!processingId || !canAccept}
                        title={canAccept ? "" : "Vaga indisponível para aceitação"}
                        onClick={() => {
                          if (!canAccept) {
                            showToast("Esta vaga não está disponível para aceitar candidaturas.", "error");
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
                placeholder={actionTarget.action === "reject" ? "Ex.: Perfil não alinhado à vaga nesta fase." : "Opcional"}
                style={{ width: "100%", resize: "vertical", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border-color, #e2e8f0)" }}
                value={actionTarget.notes}
                onChange={(e) => setActionTarget((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
            {actionTarget.action === "reject" && (actionTarget.notes || "").trim().length < 10 && (
              <p style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.78rem", color: "#b91c1c" }}>
                O motivo de rejeição deve conter pelo menos 10 caracteres.
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
              Confirmar ação em lote
            </h3>
            <p style={{ marginTop: 0, opacity: 0.82 }}>
              {batchConfirmTarget.action === "accept"
                ? `Confirma a aceitação de ${batchConfirmTarget.selectedCount} candidatura(s) selecionada(s)?`
                : `Confirma a rejeição de ${batchConfirmTarget.selectedCount} candidatura(s) selecionada(s)?`}
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
