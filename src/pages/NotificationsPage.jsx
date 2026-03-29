import { useOutletContext } from "react-router-dom";
import { useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";

const seedNotices = [
  { id: 1, titulo: "Atraso de assinatura digital", prioridade: "Alta", lida: false },
  { id: 2, titulo: "Novo parceiro validado", prioridade: "Media", lida: false },
  { id: 3, titulo: "Avaliacao mensal pendente", prioridade: "Alta", lida: true },
  { id: 4, titulo: "Vaga urgente para mecanica", prioridade: "Alta", lida: false }
];

export default function NotificationsPage() {
  const { query, showToast } = useOutletContext();
  const [priority, setPriority] = useState("Todas");
  const [notices, setNotices] = useState(seedNotices);

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        const priorityOk = priority === "Todas" || n.prioridade === priority;
        const textOk = matchesSearch(query, `${n.titulo} ${n.prioridade}`);
        return priorityOk && textOk;
      }),
    [notices, priority, query]
  );

  function markAsRead(id) {
    setNotices((current) => current.map((notice) => (notice.id === id ? { ...notice, lida: true } : notice)));
    showToast("Notificacao marcada como lida.");
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>Central de notificacoes</h2>
        <p>Alertas operacionais e lembretes de conformidade em um unico fluxo.</p>
        <div className="header-meta">
          <span className="tag">
            <span className="material-icons-sharp">filter_list</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option>Todas</option>
              <option>Alta</option>
              <option>Media</option>
            </select>
          </span>
        </div>
      </section>

      <section className="panel">
        <h3>Fila de alertas</h3>
        <div className="list">
          {filtered.map((n) => (
            <div className="list-item" key={n.id}>
              <strong>{n.titulo}</strong>
              <span className="meta">Prioridade: {n.prioridade}</span>
              {!n.lida ? (
                <div className="form-actions">
                  <button className="btn ghost" type="button" onClick={() => markAsRead(n.id)}>
                    Marcar como lida
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
