import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

const seedDocs = [
  { titulo: "Manual do estagiario", tipo: "PDF", versao: "v2.4", estado: "Publicado" },
  { titulo: "Checklist de supervisao", tipo: "DOCX", versao: "v1.8", estado: "Em revisao" },
  { titulo: "Relatorio consolidado", tipo: "XLSX", versao: "v3.0", estado: "Pendente" }
];

export default function DocumentsPage() {
  const { query, showToast } = useOutletContext();
  const [docs, setDocs] = useState(seedDocs);
  const [form, setForm] = useState({ titulo: "", tipo: "PDF", versao: "v1.0" });

  const filteredDocs = useMemo(
    () => docs.filter((d) => matchesSearch(query, `${d.titulo} ${d.tipo} ${d.versao} ${d.estado}`)),
    [docs, query]
  );

  const columns = [
    { key: "titulo", label: "Titulo" },
    { key: "tipo", label: "Tipo" },
    { key: "versao", label: "Versao" },
    { key: "estado", label: "Estado" }
  ];

  function submitDoc(event) {
    event.preventDefault();
    if (!form.titulo.trim()) {
      showToast("Informe o titulo do documento.", "error");
      return;
    }
    setDocs((current) => [{ ...form, estado: "Em revisao" }, ...current]);
    setForm({ titulo: "", tipo: "PDF", versao: "v1.0" });
    showToast("Documento submetido para revisao.");
  }

  return (
    <main className="page">
      <PageHeader title="Centro documental" description="Controla versoes, revisoes e conformidade dos documentos do ciclo de estagio." />

      <PanelSection className="form-card" title="Submeter documento">
        <form onSubmit={submitDoc}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="doc-title">Titulo</label>
              <input id="doc-title" value={form.titulo} onChange={(event) => setForm((f) => ({ ...f, titulo: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="doc-type">Tipo</label>
              <select id="doc-type" value={form.tipo} onChange={(event) => setForm((f) => ({ ...f, tipo: event.target.value }))}>
                <option>PDF</option>
                <option>DOCX</option>
                <option>XLSX</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="doc-version">Versao</label>
              <input id="doc-version" value={form.versao} onChange={(event) => setForm((f) => ({ ...f, versao: event.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">
              Enviar
            </button>
          </div>
        </form>
      </PanelSection>

      <PanelSection title="Biblioteca de documentos">
        <DataTable columns={columns} rows={filteredDocs} />
      </PanelSection>
    </main>
  );
}
