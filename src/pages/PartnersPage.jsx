import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import PartnerRegisterModal from "../components/PartnerRegisterModal.jsx";

const seedPartners = [
  {
    empresa: "Novasoft",
    nif: "5400000001 LA",
    setor: "tech",
    areas: ["software", "hardware"],
    vagas: "22",
    sla: "98%",
    responsavel: "João Silva",
    telefone: "+244 923 111 000",
    email: "geral@novasoft.ao",
    website: "https://novasoft.ao",
    endereco: "Rua da Missão 45, Luanda",
    photoPreview: null,
  },
  {
    empresa: "TecnoRed",
    nif: "5400000002 LA",
    setor: "telecom",
    areas: ["networks", "telecom"],
    vagas: "18",
    sla: "93%",
    responsavel: "Maria Ferreira",
    telefone: "+244 924 222 000",
    email: "rh@tecnored.ao",
    website: "https://tecnored.ao",
    endereco: "Av. 4 de Fevereiro 120, Luanda",
    photoPreview: null,
  },
  {
    empresa: "FabriMetal",
    nif: "5400000003 LA",
    setor: "industry",
    areas: ["manufacturing", "construction"],
    vagas: "7",
    sla: "79%",
    responsavel: "Carlos Neto",
    telefone: "+244 925 333 000",
    email: "info@fabrimetal.ao",
    website: "",
    endereco: "Zona Industrial de Viana, Luanda",
    photoPreview: null,
  },
];

const STORAGE_KEY = "giva.partners";

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

function readStoredPartners() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedPartners.map((item, index) => normalizePartner(item, index));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return seedPartners.map((item, index) => normalizePartner(item, index));
    }
    return parsed.map((item, index) => normalizePartner(item, index));
  } catch {
    return seedPartners.map((item, index) => normalizePartner(item, index));
  }
}

function sectorLabel(sector, t) {
  const map = { tech: "tech", telecom: "telecom", industry: "industry", health: "health" };
  return t(`partners.sector.${map[sector] ?? "tech"}`);
}

export default function PartnersPage() {
  const { query, showToast, t } = useOutletContext();
  const [partners, setPartners] = useState(readStoredPartners);
  const [showModal, setShowModal] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
  }, [partners]);

  const filtered = useMemo(
    () =>
      partners.filter((p) =>
        matchesSearch(
          query,
          `${p.empresa} ${p.nif} ${sectorLabel(p.setor, t)} ${p.responsavel} ${p.vagas} ${p.sla} ${(p.areas ?? []).join(" ")}`
        )
      ),
    [partners, query, t]
  );

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
      render: (row) => (
        <div className="partner-row-actions">
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
          <button
            type="button"
            className="btn ghost partner-delete-btn"
            onClick={() => {
              const message = t("partners.confirmDelete").replace("{name}", row.empresa);
              if (!window.confirm(message)) {
                return;
              }
              setPartners((current) => current.filter((item) => item.id !== row.id));
              showToast(t("partners.toast.deleted"));
            }}
          >
            {t("partners.delete")}
          </button>
        </div>
      ),
    },
  ];

  function savePartner(data) {
    if (editingPartnerId) {
      setPartners((current) => current.map((item) => (item.id === editingPartnerId ? { ...data, id: item.id } : item)));
      return;
    }
    setPartners((current) => [{ ...data, id: `partner-${Date.now()}` }, ...current]);
  }

  return (
    <main className="page">
      <PageHeader
        title={t("partners.title")}
        description={t("partners.description")}
        meta={
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
        <DataTable columns={columns} rows={filtered} />
      </PanelSection>

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
    </main>
  );
}

