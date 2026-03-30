import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

const seedDocs = [
  { titulo: "docManual", tipo: "PDF", versao: "v2.4", estado: "published" },
  { titulo: "docChecklist", tipo: "DOCX", versao: "v1.8", estado: "review" },
  { titulo: "docReport", tipo: "XLSX", versao: "v3.0", estado: "pending" }
];

function stateLabel(state, copy) {
  if (state === "published") {
    return copy.published;
  }
  if (state === "pending") {
    return copy.pending;
  }
  return copy.review;
}

function titleLabel(key, t) {
  if (key === "docManual") {
    return t("documents.docManual");
  }
  if (key === "docChecklist") {
    return t("documents.docChecklist");
  }
  if (key === "docReport") {
    return t("documents.docReport");
  }
  return key;
}

export default function DocumentsPage() {
  const { query, showToast, t } = useOutletContext();
  const copy = {
    review: t("common.inReview"),
    published: t("common.approved"),
    pending: t("common.pending")
  };
  const [docs, setDocs] = useState(seedDocs);
  const [form, setForm] = useState({ titulo: "", tipo: "PDF", versao: "v1.0" });

  const filteredDocs = useMemo(
    () =>
      docs.filter((d) => matchesSearch(query, `${titleLabel(d.titulo, t)} ${d.tipo} ${d.versao} ${stateLabel(d.estado, copy)}`)),
    [docs, query]
  );

  const columns = [
    { key: "titulo", label: t("documents.titleLabel"), render: (row) => titleLabel(row.titulo, t) },
    { key: "tipo", label: t("common.type") },
    { key: "versao", label: t("documents.version") },
    { key: "estado", label: t("common.status"), render: (row) => stateLabel(row.estado, copy) }
  ];

  function submitDoc(event) {
    event.preventDefault();
    if (!form.titulo.trim()) {
      showToast(t("documents.toast.titleRequired"), "error");
      return;
    }
    setDocs((current) => [{ ...form, estado: "review" }, ...current]);
    setForm({ titulo: "", tipo: "PDF", versao: "v1.0" });
    showToast(t("documents.toast.submitted"));
  }

  return (
    <main className="page">
      <PageHeader title={t("documents.title")} description={t("documents.description")} />

      <PanelSection className="form-card" title={t("documents.submit") }>
        <form onSubmit={submitDoc}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="doc-title">{t("documents.titleLabel")}</label>
              <input id="doc-title" value={form.titulo} onChange={(event) => setForm((f) => ({ ...f, titulo: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="doc-type">{t("common.type")}</label>
              <select id="doc-type" value={form.tipo} onChange={(event) => setForm((f) => ({ ...f, tipo: event.target.value }))}>
                <option>PDF</option>
                <option>DOCX</option>
                <option>XLSX</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="doc-version">{t("documents.version")}</label>
              <input id="doc-version" value={form.versao} onChange={(event) => setForm((f) => ({ ...f, versao: event.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">
              {t("documents.send")}
            </button>
          </div>
        </form>
      </PanelSection>

      <PanelSection title={t("documents.library")}>
        <DataTable columns={columns} rows={filteredDocs} />
      </PanelSection>
    </main>
  );
}
