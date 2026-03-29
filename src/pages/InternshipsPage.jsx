import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

const initialRows = [
  { aluno: "Ana Melo", curso: "TI", empresa: "Novasoft", status: "Ativo" },
  { aluno: "Osvaldo Mane", curso: "EIE", empresa: "TecnoRed", status: "Acompanhamento" },
  { aluno: "Laura Pires", curso: "TLQB", empresa: "BioHealth", status: "Risco" }
];

export default function InternshipsPage() {
  const { query, showToast } = useOutletContext();
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [rows] = useState(initialRows);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const statusOk = statusFilter === "Todos" || row.status === statusFilter;
        const textOk = matchesSearch(query, `${row.aluno} ${row.curso} ${row.empresa} ${row.status}`);
        return statusOk && textOk;
      }),
    [query, rows, statusFilter]
  );

  const columns = [
    { key: "aluno", label: "Aluno" },
    { key: "curso", label: "Curso" },
    { key: "empresa", label: "Empresa" },
    { key: "status", label: "Status" },
    {
      key: "acao",
      label: "Acao",
      render: (row) => (
        <button className="btn ghost" type="button" onClick={() => showToast(`Acompanhamento aberto: ${row.aluno}`)}>
          Detalhes
        </button>
      )
    }
  ];

  return (
    <main className="page">
      <PageHeader
        title="Operacao de estagios ativos"
        description="Gestao central de vagas, acompanhamentos semanais e cumprimento de prazos pedagogicos."
        meta={
          <span className="tag">
            <span className="material-icons-sharp">filter_alt</span>
            Filtro:
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>Todos</option>
              <option>Ativo</option>
              <option>Acompanhamento</option>
              <option>Risco</option>
            </select>
          </span>
        }
      />

      <PanelSection title="Lista prioritaria de acompanhamento">
        <DataTable columns={columns} rows={filtered} />
      </PanelSection>
    </main>
  );
}
