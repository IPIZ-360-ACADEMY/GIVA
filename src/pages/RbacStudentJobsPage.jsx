import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import { applyToJob, listStudentJobs } from "../services/rbacService.js";

export default function RbacStudentJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [message, setMessage] = useState("");

  async function loadJobs() {
    setLoading(true);
    const rows = await listStudentJobs();
    setJobs(rows);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleApply(jobId) {
    setMessage("");
    setSubmittingId(jobId);
    const result = await applyToJob(jobId);
    setSubmittingId(null);

    if (!result) {
      setMessage("Não foi possível submeter candidatura. Verifique se pertence ao curso da vaga.");
      return;
    }

    setMessage("Candidatura submetida com sucesso.");
  }

  return (
    <main className="page">
      <PageHeader
        title="Vagas por curso (RBAC)"
        description="Apenas vagas do seu curso são exibidas pelo backend com RLS."
      />

      <PanelSection title="Vagas disponíveis">
        {message && <p className="tools-success">{message}</p>}
        {loading ? (
          <p>A carregar vagas...</p>
        ) : jobs.length === 0 ? (
          <p>Sem vagas disponíveis para o seu curso.</p>
        ) : (
          <div className="tools-vagas-grid">
            {jobs.map((job) => (
              <article key={job.id} className="tools-vaga-card">
                <h3>{job.title}</h3>
                <p>{job.description || "Sem descrição"}</p>
                <small>Curso: {job.course_id}</small>
                <div style={{ marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={submittingId === job.id}
                    onClick={() => handleApply(job.id)}
                  >
                    {submittingId === job.id ? "A submeter..." : "Candidatar"}
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
