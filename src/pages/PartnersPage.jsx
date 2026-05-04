import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { matchesSearch } from "../utils/search.js";
import { isCoordinatorRole } from "../utils/accessControl.js";
import { filterByCoordinatorScope } from "../utils/coordinationScope.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import PartnerRegisterModal from "../components/PartnerRegisterModal.jsx";
import JobApplicationModal from "../components/JobApplicationModal.jsx";
import {
  canUsePartnersApi,
  createPartner,
  deletePartner,
  getMyPartner,
  listPartners,
  updatePartner,
} from "../services/partnersService.js";
import {
  listStudentApplications,
  listPartnerApplications,
} from "../services/jobApplicationService.js";
import { listOpenVacancies } from "../services/vacanciesService.js";


function normalizePartner(raw, index) {
  return {
    id: raw?.id ?? `partner-${Date.now()}-${index}`,
    empresa: typeof raw?.empresa === "string" ? raw.empresa : "",
    nif: typeof raw?.nif === "string" ? raw.nif : "",
    setor: typeof raw?.setor === "string" ? raw.setor : "tech",
    areas: Array.isArray(raw?.areas) ? raw.areas.filter((item) => typeof item === "string") : [],
    vagas: typeof raw?.vagas === "string" || typeof raw?.vagas === "number" ? String(raw.vagas) : "",
    sla: typeof raw?.sla === "string" ? raw.sla : "",
    responsavel: typeof raw?.responsavel === "string" ? raw.responsavel : "",
    telefone: typeof raw?.telefone === "string" ? raw.telefone : "",
    email: typeof raw?.email === "string" ? raw.email : "",
    website: typeof raw?.website === "string" ? raw.website : "",
    endereco: typeof raw?.endereco === "string" ? raw.endereco : "",
    photoPreview: typeof raw?.photoPreview === "string" ? raw.photoPreview : null,
  };
}

function sectorLabel(sector, t) {
  const map = { tech: "tech", telecom: "telecom", industry: "industry", health: "health" };
  return t(`partners.sector.${map[sector] ?? "tech"}`);
}

export default function PartnersPage() {
  const { query, showToast, t } = useOutletContext();
  const { user, authProfile } = useAuth();
  const userRole = String(authProfile?.role ?? authProfile?.role_name ?? "").toUpperCase();
  const isStudent = userRole === "STUDENT";
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isCoordinator = isCoordinatorRole(userRole);
  const isCompanyManager = userRole === "COMPANY";
  const canManagePartners = isSuperAdmin || isCoordinator;
  
  // Partner management
  const [partners, setPartners] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState(null);
  const [apiMode, setApiMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Job applications (Student View)
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPartnerForApp, setSelectedPartnerForApp] = useState(null);
  const [studentApplications, setStudentApplications] = useState([]);

  // Job applications (Company View)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [companyApplications, setCompanyApplications] = useState([]);
  const [applicationStatusFilter, setApplicationStatusFilter] = useState("PENDING");
  const [selectedApplicationForReview, setSelectedApplicationForReview] = useState(null);
  const [openVacanciesByPartner, setOpenVacanciesByPartner] = useState(new Map());

  const coordinatorScopeKey = useMemo(
    () => {
      const role = String(authProfile?.role ?? "").toUpperCase();
      const areaId = String(authProfile?.areaId ?? "");
      const courseIds = Array.isArray(authProfile?.courseIds) ? authProfile.courseIds.join(",") : "";
      const courseCodes = Array.isArray(authProfile?.courseCodes) ? authProfile.courseCodes.join(",") : "";
      return `${role}|${areaId}|${courseIds}|${courseCodes}`;
    },
    [
      authProfile?.role,
      authProfile?.areaId,
      Array.isArray(authProfile?.courseIds) ? authProfile.courseIds.join(",") : "",
      Array.isArray(authProfile?.courseCodes) ? authProfile.courseCodes.join(",") : "",
    ]
  );

  useEffect(() => {
    let active = true;

    async function loadPartners() {
      if (!canUsePartnersApi()) {
        setApiMode(false);
        setLoading(false);
        showToast("Supabase não configurado. Configure as variáveis VITE_SUPABASE_* para ativar parceiros.", "error");
        return;
      }

      try {
        const rows = await listPartners();
        if (!active) {
          return;
        }
        const normalizedRows = rows.map((item, index) => normalizePartner(item, index));
        const scopedRows = filterByCoordinatorScope(normalizedRows, authProfile, {
          areaKeys: ["areaId", "area_id"],
        });
        setPartners(isCoordinator ? scopedRows : normalizedRows);
        setApiMode(true);
        setLoading(false);
      } catch {
        if (!active) {
          return;
        }
        setApiMode(false);
        setLoading(false);
        showToast("Falha ao carregar parceiros na base remota.", "error");
      }
    }

    loadPartners();

    return () => {
      active = false;
    };
  }, [authProfile?.areaId, authProfile?.role, coordinatorScopeKey, isCoordinator, showToast]);

  // Load student applications (if student)
  useEffect(() => {
    async function loadStudentApplications() {
      if (!user?.id || !isStudent) {
        return;
      }
      try {
        const apps = await listStudentApplications(user.id);
        setStudentApplications(apps || []);
      } catch (error) {
        console.error("[PartnersPage] Error loading student applications:", error);
      }
    }
    loadStudentApplications();
  }, [user?.id, isStudent]);

  // Load open vacancies grouped by partner (student visibility and CTA enablement)
  useEffect(() => {
    let active = true;

    async function loadOpenVacancies() {
      if (!isStudent) {
        setOpenVacanciesByPartner(new Map());
        return;
      }

      try {
        const rows = await listOpenVacancies();
        if (!active) {
          return;
        }

        const grouped = new Map();
        for (const vacancy of rows) {
          const partnerId = vacancy?.partner_id;
          if (!partnerId) {
            continue;
          }

          const current = grouped.get(partnerId) ?? { openCount: 0, availableSlots: 0 };
          current.openCount += 1;
          current.availableSlots += Math.max(0, Number(vacancy.available_slots ?? 0));
          grouped.set(partnerId, current);
        }

        setOpenVacanciesByPartner(grouped);
      } catch (error) {
        console.error("[PartnersPage] Error loading open vacancies:", error);
        if (active) {
          setOpenVacanciesByPartner(new Map());
        }
      }
    }

    loadOpenVacancies();

    return () => {
      active = false;
    };
  }, [isStudent]);

  // Load company applications (if admin_company)
  useEffect(() => {
    async function loadCompanyApplications() {
      if (!user?.id || !isCompanyManager) {
        return;
      }
      try {
        const partner = await getMyPartner();
        if (!partner?.id) {
          setCompanyApplications([]);
          return;
        }
        const apps = await listPartnerApplications(partner.id);
        setCompanyApplications(apps || []);
      } catch (error) {
        console.error("[PartnersPage] Error loading company applications:", error);
      }
    }
    loadCompanyApplications();
  }, [user?.id, isCompanyManager]);

    const getApplicationStatusForPartner = (partnerId) => {
      const app = studentApplications.find((a) => a.partner_id === partnerId);
      return app?.status || null;
    };

    const getApplicationStatusBadgeClass = (status) => {
      const classes = {
        PENDING: "badge-pending",
        ACCEPTED: "badge-accepted",
        REJECTED: "badge-rejected",
        WITHDRAWN: "badge-withdrawn",
        COMPLETED: "badge-completed",
      };
      return classes[status] || "badge-pending";
    };

    const filteredCompanyApplications = useMemo(() => {
      return companyApplications.filter(
        (app) => app.status === applicationStatusFilter
      );
    }, [companyApplications, applicationStatusFilter]);

    const applicationCounts = useMemo(() => {
      return {
        PENDING: companyApplications.filter((a) => a.status === "PENDING").length,
        ACCEPTED: companyApplications.filter((a) => a.status === "ACCEPTED").length,
        REJECTED: companyApplications.filter((a) => a.status === "REJECTED").length,
        WITHDRAWN: companyApplications.filter((a) => a.status === "WITHDRAWN").length,
        COMPLETED: companyApplications.filter((a) => a.status === "COMPLETED").length,
      };
    }, [companyApplications]);

  const filtered = useMemo(() => {
    const baseRows = isStudent
      ? partners.filter((p) => {
          const stats = openVacanciesByPartner.get(p.id);
          const openCount = Number(stats?.openCount ?? 0);
          return openCount > 0;
        })
      : partners;

    return baseRows.filter((p) =>
      matchesSearch(
        query,
        `${p.empresa} ${p.nif} ${sectorLabel(p.setor, t)} ${p.responsavel} ${p.vagas} ${p.sla} ${(p.areas ?? []).join(" ")}`
      )
    );
  }, [isStudent, openVacanciesByPartner, partners, query, t]);

  const metrics = useMemo(() => {
    const total = partners.length;
    const totalSlots = partners.reduce((sum, item) => sum + (Number(item.vagas) || 0), 0);
    const slaValues = partners
      .map((item) => Number(String(item.sla ?? "").replace("%", "")))
      .filter((item) => Number.isFinite(item));
    const avgSla = slaValues.length
      ? `${(slaValues.reduce((sum, item) => sum + item, 0) / slaValues.length).toFixed(1)}%`
      : "0%";
    const withPhoto = partners.filter((item) => Boolean(item.photoPreview)).length;
    return { total, totalSlots, avgSla, withPhoto };
  }, [partners]);

  const editingPartner = useMemo(
    () => partners.find((item) => item.id === editingPartnerId) ?? null,
    [editingPartnerId, partners]
  );

  const columns = [
    {
      key: "empresa",
      label: t("common.company"),
      render: (row) => (
        <div className="partner-cell-company">
          {row.photoPreview ? (
            <img src={row.photoPreview} alt="" className="partner-avatar" />
          ) : (
            <span className="partner-avatar-initials" aria-hidden="true">
              {row.empresa.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{row.empresa}</strong>
            {row.responsavel && <div className="meta">{row.responsavel}</div>}
          </div>
        </div>
      ),
    },
    { key: "nif", label: t("partners.nif") },
    { key: "setor", label: t("partners.sector"), render: (row) => sectorLabel(row.setor, t) },
    { key: "vagas", label: t("partners.slots") },
    { key: "sla", label: t("partners.performance") },
    {
      key: "actions",
      label: t("common.action"),
      render: (row) => {
        const appStatus = getApplicationStatusForPartner(row.id);
        const vacancyStats = openVacanciesByPartner.get(row.id) ?? { openCount: 0, availableSlots: 0 };
        const hasOpenVacancies = Number(vacancyStats.openCount ?? 0) > 0;
        
        return (
          <div className="partner-row-actions">
            {isStudent && (
              <button
                type="button"
                className={`btn ${appStatus ? "secondary" : "primary"}`}
                onClick={() => {
                  if (hasOpenVacancies) {
                    setSelectedPartnerForApp(row);
                    setShowApplicationModal(true);
                  }
                }}
                disabled={!hasOpenVacancies}
                title={
                  hasOpenVacancies
                    ? (appStatus ? `Candidatura: ${appStatus}` : "Ver vagas e candidatar-se")
                    : "Sem vagas abertas"
                }
              >
                {hasOpenVacancies ? t("application.submit") : "Sem vagas"}
              </button>
            )}

            {isCompanyManager && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => setApplicationStatusFilter("PENDING")}
              >
                {t("partners.manageApplications") || "Gerir candidaturas"}
              </button>
            )}

            {canManagePartners && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setEditingPartnerId(row.id);
                  setShowModal(true);
                }}
              >
                {t("partners.edit")}
              </button>
            )}

            {canManagePartners && (
              <button
                type="button"
                className="btn ghost partner-delete-btn"
                onClick={async () => {
                  const message = t("partners.confirmDelete").replace("{name}", row.empresa);
                  if (!window.confirm(message)) {
                    return;
                  }
                  if (!apiMode) {
                    showToast("Operação indisponível sem ligação Supabase.", "error");
                    return;
                  }
                  try {
                    await deletePartner(row.id);
                  } catch {
                    showToast("Não foi possível remover o parceiro.", "error");
                    return;
                  }
                  setPartners((current) => current.filter((item) => item.id !== row.id));
                  showToast(t("partners.toast.deleted"));
                }}
              >
                {t("partners.delete")}
              </button>
            )}

          </div>
        );
      },
    },
  ];

  async function savePartner(data) {
    const targetId = editingPartnerId;

    if (!apiMode) {
      showToast("Operação indisponível sem ligação Supabase.", "error");
      return false;
    }

    if (targetId) {
      try {
        const updated = await updatePartner(targetId, data);
        setPartners((current) => current.map((item) => (item.id === targetId ? updated : item)));
        return true;
      } catch {
        showToast("Não foi possível atualizar o parceiro.", "error");
        return false;
      }
    }

    try {
      const created = await createPartner(data);
      setPartners((current) => [created, ...current]);
      return true;
    } catch {
      showToast("Não foi possível registar o parceiro.", "error");
      return false;
    }
  }

  return (
    <main className="page page-partners">
      <PageHeader
        title={t("partners.title")}
        description={t("partners.description")}
        meta={
          canManagePartners ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setEditingPartnerId(null);
                setShowModal(true);
              }}
            >
              <span className="material-icons-sharp" aria-hidden="true">add</span>
              {t("partners.register")}
            </button>
          ) : null
        }
      />

      <section className="partners-kpi-grid">
        <article className="partners-kpi-card">
          <span className="meta">{t("partners.metrics.total")}</span>
          <strong>{metrics.total}</strong>
        </article>
        <article className="partners-kpi-card">
          <span className="meta">{t("partners.metrics.slots")}</span>
          <strong>{metrics.totalSlots}</strong>
        </article>
        <article className="partners-kpi-card">
          <span className="meta">{t("partners.metrics.avgSla")}</span>
          <strong>{metrics.avgSla}</strong>
        </article>
        <article className="partners-kpi-card">
          <span className="meta">{t("partners.metrics.withPhoto")}</span>
          <strong>{metrics.withPhoto}</strong>
        </article>
      </section>

      <PanelSection title={t("partners.portfolio")}>
        {loading ? <p className="meta loading-state">A carregar parceiros...</p> : <DataTable columns={columns} rows={filtered} />}
      </PanelSection>

        {isCompanyManager && (
          <PanelSection title={t("partners.myApplications") || "Minhas Candidaturas"}>
            <div className="application-filters" style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "COMPLETED"].map((status) => (
                <button
                  key={status}
                  onClick={() => setApplicationStatusFilter(status)}
                  className={`btn ${applicationStatusFilter === status ? "primary" : "secondary"}`}
                  style={{ position: "relative" }}
                >
                  {t(`application.status.${status.toLowerCase()}`) || status}
                  <span style={{ marginLeft: "0.5rem", display: "inline-block", minWidth: "1.5rem", textAlign: "center", fontWeight: "bold" }}>
                    {applicationCounts[status]}
                  </span>
                </button>
              ))}
            </div>
          
            {filteredCompanyApplications.length === 0 ? (
              <p className="meta" style={{ textAlign: "center", padding: "2rem" }}>Nenhuma candidatura encontrada para este filtro.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {filteredCompanyApplications.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      border: "1px solid var(--color-border, #e0e0e0)",
                      borderRadius: "0.5rem",
                      padding: "1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.5rem" }}>
                      <div>
                        <strong>{app.student?.full_name || "Estudante Desconhecido"}</strong>
                        <div className="meta">{app.student?.email || "email@desconhecido"}</div>
                      </div>
                      <span className={`application-status-badge ${getApplicationStatusBadgeClass(app.status)}`} style={{ whiteSpace: "nowrap" }}>
                        {t(`application.status.${app.status.toLowerCase()}`) || app.status}
                      </span>
                    </div>
                    <div className="meta" style={{ fontSize: "0.85rem" }}>
                      {new Date(app.applied_at).toLocaleDateString("pt-PT")}
                    </div>
                    {(app.cv_url || app.cover_letter_url || app.internship_letter_url) && (
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {app.cv_url && (
                          <a className="btn ghost" href={app.cv_url} target="_blank" rel="noreferrer">CV</a>
                        )}
                        {app.cover_letter_url && (
                          <a className="btn ghost" href={app.cover_letter_url} target="_blank" rel="noreferrer">Carta de Apresentação</a>
                        )}
                        {app.internship_letter_url && (
                          <a className="btn ghost" href={app.internship_letter_url} target="_blank" rel="noreferrer">Carta Estágio</a>
                        )}
                      </div>
                    )}
                    {app.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => {
                          setSelectedApplicationForReview(app);
                          setShowReviewModal(true);
                        }}
                        style={{ width: "100%" }}
                      >
                        Rever
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </PanelSection>
        )}
      {showModal && (
        <PartnerRegisterModal
          onClose={() => {
            setShowModal(false);
            setEditingPartnerId(null);
          }}
          onSave={savePartner}
          showToast={showToast}
          t={t}
          mode={editingPartner ? "edit" : "create"}
          initialData={editingPartner}
        />
      )}

        {/* Job Application Modal (Student applying) */}
        {showApplicationModal && selectedPartnerForApp && (
          <JobApplicationModal
            studentId={user?.id}
            partnerId={selectedPartnerForApp.id}
            mode="student"
            existingApplications={studentApplications}
            onClose={() => {
              setShowApplicationModal(false);
              setSelectedPartnerForApp(null);
            }}
            onSuccess={() => {
              setShowApplicationModal(false);
              setSelectedPartnerForApp(null);
              showToast("Candidatura enviada com sucesso para a vaga.");
              listStudentApplications(user?.id).then((apps) => setStudentApplications(apps || []));
            }}
            t={t}
          />
        )}

        {/* Review Modal (Company reviewing applications) */}
        {showReviewModal && selectedApplicationForReview && isCompanyManager && (
          <JobApplicationModal
            applicationId={selectedApplicationForReview.id}
            partnerId={selectedApplicationForReview.partner_id}
            mode="company"
            onClose={() => {
              setShowReviewModal(false);
              setSelectedApplicationForReview(null);
            }}
            onSuccess={() => {
              setShowReviewModal(false);
              setSelectedApplicationForReview(null);
              showToast("Candidatura atualizada com sucesso!");
              getMyPartner().then((partner) => {
                if (!partner?.id) {
                  setCompanyApplications([]);
                  return;
                }
                listPartnerApplications(partner.id).then((apps) => setCompanyApplications(apps || []));
              });
            }}
            t={t}
          />
        )}
    </main>
  );
}

