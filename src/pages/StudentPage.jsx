import { useOutletContext } from "react-router-dom";
import { useState } from "react";
import { matchesSearch } from "../utils/search.js";

const studentTimeline = ["Inicio de estagio", "Primeira avaliacao", "Pendencia atual"];

export default function StudentPage() {
  const { query, showToast } = useOutletContext();
  const [note, setNote] = useState("");

  function saveNote(event) {
    event.preventDefault();
    if (!note.trim()) {
      showToast("Escreva uma nota antes de guardar.", "error");
      return;
    }
    showToast("Nota de acompanhamento guardada.");
    setNote("");
  }

  return (
    <main className="page">
      <section className="page-header">
        <h2>Ficha do estagiario</h2>
        <p>Acompanhamento de desempenho, presencas, competencias e progresso documental.</p>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h3>Competencias avaliadas</h3>
          <div className="bars">
            <div className="bar">
              <strong>Analise</strong>
              <div className="line"><span className="p-87" /></div>
            </div>
            <div className="bar">
              <strong>Comunicacao</strong>
              <div className="line line-accent"><span className="p-68" /></div>
            </div>
            <div className="bar">
              <strong>Autonomia</strong>
              <div className="line"><span className="p-63" /></div>
            </div>
          </div>
        </article>

        <article className="form-card">
          <h3>Nota rapida do coordenador</h3>
          <form onSubmit={saveNote}>
            <div className="form-field">
              <label htmlFor="student-note">Observacao</label>
              <textarea id="student-note" rows="4" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">Guardar nota</button>
            </div>
          </form>
        </article>
      </section>

      <section className="panel">
        <h3>Linha do tempo</h3>
        <div className="list">
          {studentTimeline
            .filter((item) => matchesSearch(query, item))
            .map((item) => (
              <div className="list-item" key={item}>
                <strong>{item}</strong>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
