import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import { evaluateApplication, listCompanyApplications } from "../services/rbacService.js";

export default function RbacCompanyApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadApplications() {
    setLoading(true);
    const rows = await listCompanyApplications();
    setApplications(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadApplications();
  }, []);

  async function handleEvaluate(applicationId, status) {
    setMessage("");
    setWorkingId(applicationId);

    const result = await evaluateApplication(applicationId, status);
    setWorkingId(null);

    if (!result) {
      setMessage("Não foi possível avaliar candidatura.");
      return;
    }

    setApplications((prev) =>
      prev.map((item) => (item.id === applicationId ? { ...item, status } : item))
    );
    setMessage("Candidatura atualizada com sucesso.");
  }

  return (
    <main className="page">
      <PageHeader
        title="Candidaturas recebidas (RBAC)"
        description="A empresa vê apenas candidaturas das suas vagas, com avaliação protegida no backend."
      />

      <PanelSection title="Lista de candidaturas">
        {message && <p className="tools-success">{message}</p>}
        {loading ? (
          <p>A carregar candidaturas...</p>
        ) : applications.length === 0 ? (
          <p>Nenhuma candidatura recebida.</p>
        ) : (
          <div className="tools-vagas-grid">
            {applications.map((app) => (
              <article key={app.id} className="tools-vaga-card">
                <h3>Candidatura {app.id.slice(0, 8)}</h3>
                <p>Vaga: {app.job_id}</p>
                <p>Aluno: {app.student_id}</p>
                <p>Estado: <strong>{app.status}</strong></p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={workingId === app.id}
                    onClick={() => handleEvaluate(app.id, "ACCEPTED")}
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={workingId === app.id}
                    onClick={() => handleEvaluate(app.id, "REJECTED")}
                  >
                    Rejeitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </PanelSection>
    </main>
  );
}
