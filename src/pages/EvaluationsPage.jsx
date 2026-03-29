import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

const seedEvaluations = [
  { aluno: "Ana Melo", curso: "TI", nota: "9.1" },
  { aluno: "Osvaldo Mane", curso: "EIE", nota: "7.8" },
  { aluno: "Laura Pires", curso: "TLQB", nota: "5.9" }
];

export default function EvaluationsPage() {
  const { query, showToast } = useOutletContext();
  const [items, setItems] = useState(seedEvaluations);
  const [form, setForm] = useState({ aluno: "", curso: "TI", nota: "" });

  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(query, `${item.aluno} ${item.curso} ${item.nota}`)),
    [items, query]
  );

  const columns = [
    { key: "aluno", label: "Aluno" },
    { key: "curso", label: "Curso" },
    { key: "nota", label: "Nota" }
  ];

  function submitEvaluation(event) {
    event.preventDefault();
    if (!form.aluno.trim() || !form.nota.trim()) {
      showToast("Preencha aluno e nota para registar.", "error");
      return;
    }
    setItems((current) => [{ ...form }, ...current]);
    setForm({ aluno: "", curso: "TI", nota: "" });
    showToast("Avaliacao registada com sucesso.");
  }

  return (
    <main className="page">
      <PageHeader title="Painel de avaliacoes" description="Consolidado de desempenho dos estagiarios por ciclo e supervisor." />

      <PanelSection className="form-card" title="Lancar avaliacao">
        <form onSubmit={submitEvaluation}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="ev-aluno">Aluno</label>
              <input id="ev-aluno" value={form.aluno} onChange={(event) => setForm((f) => ({ ...f, aluno: event.target.value }))} />
            </div>
            <div className="form-field">
              <label htmlFor="ev-curso">Curso</label>
              <select id="ev-curso" value={form.curso} onChange={(event) => setForm((f) => ({ ...f, curso: event.target.value }))}>
                <option>TI</option>
                <option>EIE</option>
                <option>TLQB</option>
                <option>Mecanica</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="ev-nota">Nota</label>
              <input id="ev-nota" value={form.nota} onChange={(event) => setForm((f) => ({ ...f, nota: event.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">Registar</button>
          </div>
        </form>
      </PanelSection>

      <PanelSection title="Ultimos resultados">
        <DataTable columns={columns} rows={filtered} />
      </PanelSection>
    </main>
  );
}
