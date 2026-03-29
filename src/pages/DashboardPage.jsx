import { useOutletContext } from "react-router-dom";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";

export default function DashboardPage() {
  const { query, currentDate, showToast } = useOutletContext();

  const kpis = [
    ["Estagiarios ativos", "trending_up", "243", "+8.4% vs mes anterior", "total estagiarios ativos"],
    ["Sem alocacao", "person_off", "97", "-4.1% em reducao gradual", "sem alocacao"],
    ["Parceiros ativos", "domain", "18", "+2 novas instituicoes", "parceiros ativos"],
    ["Alertas criticos", "warning", "9", "3 requerem acao imediata", "alertas criticos"]
  ];

  const docs = [
    { id: "d1", documento: "Pedido de estagio externo", tipo: "DOCX", estado: "Em revisao" },
    { id: "d2", documento: "Lista oficial de estagios TI", tipo: "PDF", estado: "Aprovado" },
    { id: "d3", documento: "Relatorio mensal de parceiro", tipo: "XLSX", estado: "Atrasado" }
  ];

  const docColumns = [
    { key: "documento", label: "Documento" },
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado" },
    {
      key: "acao",
      label: "Acao",
      render: (row) => (
        <button className="btn ghost" type="button" onClick={() => showToast(`Download iniciado: ${row.documento}`)}>
          Baixar
        </button>
      )
    }
  ];

  return (
    <main className="page page-dashboard">
      <PageHeader
        title="Centro Operacional de Estagios"
        description="Painel unico com ocupacao, risco documental e desempenho por curso, orientado para tomada de decisao rapida."
        meta={
          <>
            <span className="tag">
              <span className="material-icons-sharp">calendar_month</span>
              {currentDate}
            </span>
            <span className="tag">
              <span className="material-icons-sharp">fact_check</span>
              Dados auditados
            </span>
          </>
        }
      />

      <section className="stats-grid">
        {kpis
          .filter((item) => matchesSearch(query, item[4]))
          .map((item) => (
            <article className="stat-card" key={item[0]}>
              <div className="stat-head">
                <span>{item[0]}</span>
                <span className="material-icons-sharp">{item[1]}</span>
              </div>
              <h3>{item[2]}</h3>
              <p>{item[3]}</p>
            </article>
          ))}
      </section>

      <section className="panel-grid">
        <PanelSection title="Distribuicao por curso">
          <div className="bars">
            <div className="bar">
              <strong>TI</strong>
              <div className="line">
                <span className="p-87" />
              </div>
            </div>
            <div className="bar">
              <strong>EIE</strong>
              <div className="line line-accent">
                <span className="p-68" />
              </div>
            </div>
            <div className="bar">
              <strong>TLQB</strong>
              <div className="line">
                <span className="p-63" />
              </div>
            </div>
            <div className="bar">
              <strong>Mecanica</strong>
              <div className="line line-danger">
                <span className="p-45" />
              </div>
            </div>
          </div>
        </PanelSection>

        <PanelSection title="Atividade recente">
          <div className="list">
            <div className="list-item">
              <strong>Pedido externo validado</strong>
              <span className="meta">ha 12 minutos</span>
            </div>
            <div className="list-item">
              <strong>Lista TI publicada</strong>
              <span className="meta">ha 2 horas</span>
            </div>
            <div className="list-item">
              <strong>Ficha mensal pendente</strong>
              <span className="meta">aguarda assinatura digital</span>
            </div>
          </div>
        </PanelSection>
      </section>

      <PanelSection title="Documentos em fluxo">
        <DataTable columns={docColumns} rows={docs.filter((doc) => matchesSearch(query, `${doc.documento} ${doc.tipo} ${doc.estado}`))} />
      </PanelSection>
    </main>
  );
}
