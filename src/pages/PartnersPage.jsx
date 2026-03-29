import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import DataTable from "../components/DataTable.jsx";

const seedPartners = [
  { empresa: "Novasoft", setor: "Tecnologia", vagas: "22", sla: "98%" },
  { empresa: "TecnoRed", setor: "Telecom", vagas: "18", sla: "93%" },
  { empresa: "FabriMetal", setor: "Industria", vagas: "7", sla: "79%" }
];

export default function PartnersPage() {
  const { query, showToast } = useOutletContext();
  const [partners, setPartners] = useState(seedPartners);
  const [form, setForm] = useState({ empresa: "", setor: "Tecnologia", vagas: "", sla: "" });

  const filtered = useMemo(
    () => partners.filter((p) => matchesSearch(query, `${p.empresa} ${p.setor} ${p.vagas} ${p.sla}`)),
    [partners, query]
  );

  const columns = [
    { key: "empresa", label: "Empresa" },
    { key: "setor", label: "Setor" },
    { key: "vagas", label: "Vagas" },
    { key: "sla", label: "SLA" }
  ];

  function onSubmit(event) {
    event.preventDefault();
    if (!form.empresa.trim()) {
      showToast("Informe o nome da empresa.", "error");
      return;
    }
    setPartners((current) => [{ ...form }, ...current]);
    setForm({ empresa: "", setor: "Tecnologia", vagas: "", sla: "" });
    showToast("Parceiro adicionado com sucesso.");
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>Ecossistema de parceiros</h2>
        <p>Mapa de instituicoes com desempenho, capacidade de absorcao e risco operacional.</p>
      </section>

      <section className="form-card">
        <h3>Novo parceiro</h3>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="p-empresa">Empresa</label>
              <input id="p-empresa" value={form.empresa} onChange={(event) => setForm((f) => ({ ...f, empresa: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="p-setor">Setor</label>
              <select id="p-setor" value={form.setor} onChange={(event) => setForm((f) => ({ ...f, setor: event.target.value }))}>
                <option>Tecnologia</option>
                <option>Telecom</option>
                <option>Industria</option>
                <option>Saude</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="p-vagas">Vagas</label>
              <input id="p-vagas" value={form.vagas} onChange={(event) => setForm((f) => ({ ...f, vagas: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="p-sla">SLA</label>
              <input id="p-sla" value={form.sla} onChange={(event) => setForm((f) => ({ ...f, sla: event.target.value }))} placeholder="95%" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">
              Guardar parceiro
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h3>Carteira de parceiros</h3>
        <DataTable columns={columns} rows={filtered} />
      </section>
    </main>
  );
}
