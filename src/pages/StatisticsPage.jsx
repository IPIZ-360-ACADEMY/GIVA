import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";

const datasets = {
  Semanal: [
    ["Taxa de conclusao", "84%"],
    ["Empregabilidade", "69%"],
    ["Evasao", "8%"],
    ["Satisfacao", "90%"]
  ],
  Mensal: [
    ["Taxa de conclusao", "88%"],
    ["Empregabilidade", "71%"],
    ["Evasao", "6%"],
    ["Satisfacao", "92%"]
  ],
  Trimestral: [
    ["Taxa de conclusao", "91%"],
    ["Empregabilidade", "74%"],
    ["Evasao", "5%"],
    ["Satisfacao", "94%"]
  ]
};

export default function StatisticsPage() {
  const { query } = useOutletContext();
  const [period, setPeriod] = useState("Mensal");

  const stats = useMemo(
    () => datasets[period].filter((s) => matchesSearch(query, s.join(" "))),
    [period, query]
  );

  return (
    <main className="page">
      <section className="page-header">
        <h2>Inteligencia operacional</h2>
        <p>Leitura consolidada de produtividade, empregabilidade e risco de evasao no programa.</p>
        <div className="header-meta">
          <span className="tag">
            <span className="material-icons-sharp">date_range</span>
            Periodo:
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option>Semanal</option>
              <option>Mensal</option>
              <option>Trimestral</option>
            </select>
          </span>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((s) => (
            <article className="stat-card" key={s[0]}>
              <div className="stat-head">
                <span>{s[0]}</span>
              </div>
              <h3>{s[1]}</h3>
            </article>
          ))}
      </section>
    </main>
  );
}
