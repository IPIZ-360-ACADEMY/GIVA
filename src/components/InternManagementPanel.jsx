import { useState, useMemo } from "react";

export default function InternManagementPanel({
  applications = [],
  trainingAreas = [],
  onAreaChange = () => {},
  onInternNoteUpdate = () => {},
  t = (key) => key,
}) {
  const [activeArea, setActiveArea] = useState(null);
  const [internNotes, setInternNotes] = useState({});
  const [expandedInternId, setExpandedInternId] = useState(null);

  // Interns aceites
  const interns = useMemo(() => {
    return applications.filter((a) => a.status === "ACCEPTED");
  }, [applications]);

  // Agrupar estagiários por área de atuação (se existir)
  const internsByArea = useMemo(() => {
    const grouped = {};

    interns.forEach((intern) => {
      const area = intern.student?.area_id || "unassigned";
      if (!grouped[area]) {
        grouped[area] = [];
      }
      grouped[area].push(intern);
    });

    return grouped;
  }, [interns]);

  // Áreas com estagiários
  const areasWithInterns = useMemo(() => {
    return trainingAreas.filter((area) => {
      const count = internsByArea[area.id]?.length || 0;
      return count > 0 || activeArea === area.id;
    });
  }, [trainingAreas, internsByArea, activeArea]);

  const handleInternNoteUpdate = (internId, note) => {
    setInternNotes((prev) => ({
      ...prev,
      [internId]: note,
    }));
    onInternNoteUpdate(internId, note);
  };

  if (interns.length === 0) {
    return (
      <div className="panel-card" style={{ padding: "2rem", textAlign: "center" }}>
        <span className="material-icons" style={{ fontSize: "3rem", opacity: 0.3, display: "block", marginBottom: "1rem" }}>
          people_alt
        </span>
        <p style={{ opacity: 0.7 }}>Nenhum estagiário aceite ainda.</p>
      </div>
    );
  }

  return (
    <div className="intern-management-panel">
      {/* Filtro por Área */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 0.85rem", fontSize: "0.95rem", fontWeight: 600 }}>
          Filtrar por Área de Atuação
        </h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`btn ${activeArea === null ? "btn-primary" : "btn-ghost"} btn-sm`}
            onClick={() => setActiveArea(null)}
          >
            Todos ({interns.length})
          </button>
          {areasWithInterns.map((area) => {
            const count = internsByArea[area.id]?.length || 0;
            return (
              <button
                key={area.id}
                type="button"
                className={`btn ${activeArea === area.id ? "btn-primary" : "btn-ghost"} btn-sm`}
                onClick={() => setActiveArea(area.id)}
              >
                {area.name} ({count})
              </button>
            );
          })}
          <button
            type="button"
            className={`btn ${activeArea === "unassigned" ? "btn-primary" : "btn-ghost"} btn-sm`}
            onClick={() => setActiveArea("unassigned")}
          >
            Sem Área ({internsByArea["unassigned"]?.length || 0})
          </button>
        </div>
      </div>

      {/* Lista de Estagiários */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {(activeArea === null
          ? interns
          : internsByArea[activeArea] || []
        ).map((intern) => {
          const isExpanded = expandedInternId === intern.id;
          const area = trainingAreas.find((a) => a.id === intern.student?.area_id);

          return (
            <div
              key={intern.id}
              className="panel-card"
              style={{
                padding: 0,
                overflow: "hidden",
                border: isExpanded ? "2px solid var(--accent-color, #3b82f6)" : "1px solid var(--border-color, #e2e8f0)",
              }}
            >
              {/* Cabeçalho do Estagiário */}
              <button
                type="button"
                onClick={() => setExpandedInternId(isExpanded ? null : intern.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  width: "100%",
                  padding: "1rem 1.25rem",
                  background: isExpanded ? "var(--surface-subtle, #f8fafc)" : "transparent",
                  border: "none",
                  borderBottom: isExpanded ? "1px solid var(--border-color, #e2e8f0)" : "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span className="material-icons" style={{ fontSize: "2rem", color: "var(--accent-color, #3b82f6)" }}>
                  person
                </span>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                    {intern.student?.full_name || "—"}
                  </div>
                  <div style={{ fontSize: "0.8rem", opacity: 0.65, marginBottom: "0.35rem" }}>
                    {intern.student?.email}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {area && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 4,
                          background: "var(--accent-color, #3b82f6)",
                          color: "#fff",
                          fontWeight: 500,
                        }}
                      >
                        {area.name}
                      </span>
                    )}
                    <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                      Vaga: {intern.vacancy?.title || "—"}
                    </span>
                    {intern.accepted_at && (
                      <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>
                        Desde {new Date(intern.accepted_at).toLocaleDateString("pt-PT")}
                      </span>
                    )}
                  </div>
                </div>

                <span className="material-icons" style={{ opacity: 0.5, transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  expand_more
                </span>
              </button>

              {/* Detalhe Expandido */}
              {isExpanded && (
                <div style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
                  {/* Informações Pessoais */}
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <h4 style={{ margin: "0", fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
                      Informações Pessoais
                    </h4>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Telefone:</strong> {intern.student?.phone || "—"}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Género:</strong> {intern.student?.gender || "—"}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Data Nascimento:</strong> {intern.student?.birthdate ? new Date(intern.student.birthdate).toLocaleDateString("pt-PT") : "—"}
                    </div>
                  </div>

                  {/* Dados da Candidatura */}
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <h4 style={{ margin: "0", fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
                      Dados da Candidatura
                    </h4>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Status:</strong> Aceite
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Data Aceição:</strong> {intern.accepted_at ? new Date(intern.accepted_at).toLocaleDateString("pt-PT") : "—"}
                    </div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Duração Esperada:</strong> {intern.vacancy?.duration || "—"}
                    </div>
                  </div>

                  {/* Notas da Empresa */}
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <label style={{ display: "block" }}>
                      <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
                        Notas da Empresa
                      </h4>
                      <textarea
                        value={internNotes[intern.id] || ""}
                        onChange={(e) => handleInternNoteUpdate(intern.id, e.target.value)}
                        placeholder="Adicione notas sobre este estagiário..."
                        rows={3}
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.85rem",
                          borderRadius: 8,
                          border: "1px solid var(--border-color, #d1d5db)",
                          fontSize: "0.8rem",
                          fontFamily: "inherit",
                        }}
                      />
                    </label>
                  </div>

                  {/* Documentos */}
                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
                      Documentos
                    </h4>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {intern.cv_url || intern.student?.cv_url ? (
                        <a
                          href={intern.cv_url || intern.student?.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          <span className="material-icons" style={{ fontSize: "1rem" }}>download</span>
                          CV
                        </a>
                      ) : (
                        <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>CV não disponível</span>
                      )}
                      {intern.cover_letter_url || intern.student?.cover_letter_url ? (
                        <a
                          href={intern.cover_letter_url || intern.student?.cover_letter_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost btn-sm"
                        >
                          <span className="material-icons" style={{ fontSize: "1rem" }}>download</span>
                          Carta
                        </a>
                      ) : (
                        <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>Carta não disponível</span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => console.log("Contactar", intern.student?.email)}
                    >
                      <span className="material-icons" style={{ fontSize: "1rem" }}>mail</span>
                      Contactar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => console.log("Avaliar", intern.id)}
                    >
                      <span className="material-icons" style={{ fontSize: "1rem" }}>star</span>
                      Avaliar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
