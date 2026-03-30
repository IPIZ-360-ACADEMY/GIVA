import { Link, useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";

const datasets = {
  weekly: [
    ["completion", "84%"],
    ["employability", "69%"],
    ["dropout", "8%"],
    ["satisfaction", "90%"]
  ],
  monthly: [
    ["completion", "88%"],
    ["employability", "71%"],
    ["dropout", "6%"],
    ["satisfaction", "92%"]
  ],
  quarterly: [
    ["completion", "91%"],
    ["employability", "74%"],
    ["dropout", "5%"],
    ["satisfaction", "94%"]
  ]
};

export default function StatisticsPage() {
  const { query, t } = useOutletContext();
  const [period, setPeriod] = useState("monthly");

  function metricLabel(key) {
    if (key === "completion") {
      return t("statistics.completion");
    }
    if (key === "employability") {
      return t("statistics.employability");
    }
    if (key === "dropout") {
      return t("statistics.dropout");
    }
    return t("statistics.satisfaction");
  }

  const stats = useMemo(
    () => datasets[period].filter((s) => matchesSearch(query, `${metricLabel(s[0])} ${s[1]}`)),
    [period, query]
  );

  function metricTarget(key) {
    if (key === "completion") return "/estagios";
    if (key === "employability") return "/parceiros";
    if (key === "dropout") return "/notificacoes";
    return "/avaliacoes";
  }

  function metricActionLabel(key) {
    return `${t("common.open")} ${metricLabel(key)}`;
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>{t("statistics.title")}</h2>
        <p>{t("statistics.description")}</p>
        <div className="header-meta">
          <span className="tag">
            <span className="material-icons-sharp">date_range</span>
            {t("statistics.period")}
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="weekly">{t("statistics.weekly")}</option>
              <option value="monthly">{t("statistics.monthly")}</option>
              <option value="quarterly">{t("statistics.quarterly")}</option>
            </select>
          </span>
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((s) => (
            <article className="stat-card" key={s[0]}>
              <div className="stat-head">
                <span>{metricLabel(s[0])}</span>
              </div>
              <h3>{s[1]}</h3>
              <div className="card-actions">
                <Link className="btn ghost" to={metricTarget(s[0])} aria-label={metricActionLabel(s[0])}>
                  {metricActionLabel(s[0])}
                </Link>
              </div>
            </article>
          ))}
      </section>
    </main>
  );
}
