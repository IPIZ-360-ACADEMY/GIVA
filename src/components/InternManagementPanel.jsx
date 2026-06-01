import { useEffect, useMemo, useState } from "react";
import {
  PanelCard,
  PanelHeader,
  PanelTitle,
  PanelIcon,
  PanelValue,
  PanelLabel,
  PanelSub,
  PanelTags,
  PanelTag,
  PanelGrid,
  PanelSectionTitle,
  PanelBox
} from "./PanelEmotionStyles";
import { createStudentNote, listStudentNotes } from "../services/studentNotesService.js";
import {
  createFollowupLog,
  upsertEvaluation,
  RECOMMENDATION_LABELS,
} from "../services/internFollowupService.js";
import { getCompanyProgress } from "../services/companyProgressService.js";

function normalizeKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getDefaultEvaluationType(stage) {
  const normalized = String(stage ?? "").trim().toUpperCase();
  if (["COMPLETED", "TERMINATED"].includes(normalized)) {
    return "FINAL";
  }

  if (["INTERNSHIP", "FIXED_TERM_CONTRACT", "PERMANENT_CONTRACT"].includes(normalized)) {
    return "MIDTERM";
  }

  return null;
}

function RatingPicker({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: "0.15rem", flexWrap: "wrap" }}>
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          className="btn btn-ghost btn-sm"
          style={{
            minWidth: 36,
            padding: "0.35rem 0.5rem",
            borderColor: score <= value ? "#f59e0b" : undefined,
            color: score <= value ? "#b45309" : undefined,
            background: score <= value ? "rgba(245, 158, 11, 0.12)" : undefined,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function InternManagementPanel({
  applications = [],
  trainingAreas = [],
  partner = null,
  showToast = () => {},
  t = (key) => key,
}) {
  const [activeArea, setActiveArea] = useState(null);
  const [internNotes, setInternNotes] = useState({});
  const [progressByInternId, setProgressByInternId] = useState({});
  const [evaluationDrafts, setEvaluationDrafts] = useState({});
  const [activeEvaluationId, setActiveEvaluationId] = useState(null);
  const [loadingSupplemental, setLoadingSupplemental] = useState(false);
  const [savingInternId, setSavingInternId] = useState(null);
  const [expandedInternId, setExpandedInternId] = useState(null);

  // Interns aceites
  const interns = useMemo(() => {
    return applications.filter((a) => a.status === "ACCEPTED");
  }, [applications]);

  useEffect(() => {
    let cancelled = false;

    async function loadSupplementalData() {
      if (interns.length === 0) {
        setInternNotes({});
        setProgressByInternId({});
        setEvaluationDrafts({});
        return;
      }

      setLoadingSupplemental(true);

      try {
        const [noteRows, progressEntries] = await Promise.all([
          listStudentNotes().catch(() => []),
          partner?.id
            ? Promise.all(
                interns.map(async (intern) => {
                  const studentId = intern.student?.id;
                  if (!studentId) {
                    return [intern.id, null];
                  }

                  const progress = await getCompanyProgress(studentId, partner.id).catch(() => null);
                  return [intern.id, progress];
                })
              )
            : Promise.resolve([]),
        ]);

        if (cancelled) {
          return;
        }

        const latestNoteByStudent = {};
        for (const row of noteRows) {
          const key = normalizeKey(row.student_name);
          if (key && latestNoteByStudent[key] === undefined) {
            latestNoteByStudent[key] = String(row.note ?? "").trim();
          }
        }

        const nextNotes = {};
        for (const intern of interns) {
          const studentName = normalizeKey(intern.student?.full_name ?? intern.student?.name ?? "");
          nextNotes[intern.id] = latestNoteByStudent[studentName] ?? "";
        }

        setInternNotes(nextNotes);
        setProgressByInternId(Object.fromEntries(progressEntries.filter(Boolean)));
      } finally {
        if (!cancelled) {
          setLoadingSupplemental(false);
        }
      }
    }

    loadSupplementalData();

    return () => {
      cancelled = true;
    };
  }, [interns, partner?.id]);

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
  };

  async function handleSaveNote(intern) {
    const studentName = String(intern.student?.full_name ?? intern.student?.name ?? "Aluno").trim() || "Aluno";
    const note = String(internNotes[intern.id] ?? "").trim();

    if (!note) {
      showToast("Escreva uma nota antes de guardar.", "error");
      return;
    }

    setSavingInternId(intern.id);

    try {
      await createStudentNote({ studentName, note });
      showToast("Nota guardada com sucesso.", "success");
    } catch (error) {
      showToast(error?.message || "Não foi possível guardar a nota.", "error");
    } finally {
      setSavingInternId(null);
    }
  }

  async function handleContactIntern(intern) {
    const progress = progressByInternId[intern.id];
    const studentId = intern.student?.id;
    const studentName = String(intern.student?.full_name ?? intern.student?.name ?? "Aluno").trim() || "Aluno";
    const note = String(internNotes[intern.id] ?? "").trim();
    const today = new Date().toISOString().slice(0, 10);

    setSavingInternId(intern.id);

    try {
      if (progress?.id && partner?.id && studentId) {
        const result = await createFollowupLog({
          company_progress_id: progress.id,
          partner_id: partner.id,
          student_id: studentId,
          period_start: today,
          period_end: today,
          attendance_present: 0,
          attendance_absent: 0,
          attendance_justified: 0,
          activities: "Contacto registado pela empresa",
          supervisor_notes: note || "Contacto inicial guardado no painel da empresa.",
          performance_rating: null,
        });

        if (!result) {
          throw new Error("Não foi possível guardar o contacto.");
        }

        showToast("Contacto guardado no acompanhamento.", "success");
        return;
      }

      await createStudentNote({
        studentName,
        note: note ? `Contacto registado: ${note}` : "Contacto registado pela empresa.",
      });
      showToast("Contacto guardado como nota.", "success");
    } catch (error) {
      showToast(error?.message || "Não foi possível registar o contacto.", "error");
    } finally {
      setSavingInternId(null);
    }
  }

  function startEvaluation(intern) {
    const progress = progressByInternId[intern.id];
    const evalType = getDefaultEvaluationType(progress?.progression_stage);

    if (!progress?.id || !partner?.id || !intern.student?.id || !evalType) {
      showToast("Esta avaliação ainda não está disponível para este processo.", "error");
      return;
    }

    setActiveEvaluationId(intern.id);
    setEvaluationDrafts((prev) => ({
      ...prev,
      [intern.id]: prev[intern.id] || {
        eval_type: evalType,
        eval_date: new Date().toISOString().slice(0, 10),
        rating: 3,
        recommendation: "NO_ACTION",
        general_comments: String(internNotes[intern.id] ?? "").trim(),
      },
    }));
  }

  async function handleSaveEvaluation(intern) {
    const progress = progressByInternId[intern.id];
    const draft = evaluationDrafts[intern.id];

    if (!progress?.id || !partner?.id || !intern.student?.id || !draft) {
      showToast("Não foi possível preparar a avaliação.", "error");
      return;
    }

    const rating = Number(draft.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      showToast("A classificação deve estar entre 1 e 5.", "error");
      return;
    }

    const evalType = getDefaultEvaluationType(progress.progression_stage);
    if (!evalType) {
      showToast("A avaliação ainda não pode ser registada nesta fase.", "error");
      return;
    }

    setSavingInternId(intern.id);

    try {
      const result = await upsertEvaluation({
        company_progress_id: progress.id,
        partner_id: partner.id,
        student_id: intern.student.id,
        eval_type: evalType,
        eval_date: draft.eval_date || new Date().toISOString().slice(0, 10),
        rating_punctuality: rating,
        rating_initiative: rating,
        rating_teamwork: rating,
        rating_technical: rating,
        rating_communication: rating,
        general_comments: String(draft.general_comments ?? "").trim() || null,
        recommendation: draft.recommendation || null,
        signed_by_company: true,
        signed_by_student: false,
      });

      if (result?.__error) {
        throw new Error(result.message || "Não foi possível guardar a avaliação.");
      }

      if (!result) {
        throw new Error("Não foi possível guardar a avaliação.");
      }

      showToast("Avaliação guardada com sucesso.", "success");
      setActiveEvaluationId(null);
    } catch (error) {
      showToast(error?.message || "Não foi possível guardar a avaliação.", "error");
    } finally {
      setSavingInternId(null);
    }
  }

  if (interns.length === 0) {
    return (
      <PanelCard style={{ padding: "2rem", textAlign: "center" }}>
        <PanelIcon as="span" className="material-icons" style={{ fontSize: "3rem", opacity: 0.3, display: "block", marginBottom: "1rem" }}>
          people_alt
        </PanelIcon>
        <p style={{ opacity: 0.7 }}>Nenhum estagiário aceite ainda.</p>
      </PanelCard>
    );
  }

    if (loadingSupplemental) {
      return (
        <PanelCard style={{ padding: "2rem", textAlign: "center" }}>
          <PanelIcon as="span" className="material-icons" style={{ fontSize: "3rem", opacity: 0.3, display: "block", marginBottom: "1rem" }}>
            sync
          </PanelIcon>
          <p style={{ opacity: 0.7 }}>A sincronizar acompanhamento da empresa...</p>
        </PanelCard>
      );
    }

  return (
    <div className="intern-management-panel">
      {/* Filtro por Área */}
      <div style={{ marginBottom: "1.5rem" }}>
        <PanelSectionTitle as="h3" style={{ fontWeight: 600 }}>
          Filtrar por Área de Atuação
        </PanelSectionTitle>
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
            <PanelCard
              key={intern.id}
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
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveNote(intern)}
                        disabled={savingInternId === intern.id}
                      >
                        {savingInternId === intern.id ? "A guardar..." : "Guardar nota"}
                      </button>
                      <span style={{ fontSize: "0.78rem", opacity: 0.65, alignSelf: "center" }}>
                        Fica registada na área atual da empresa.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "0.5rem" }}>
                    <h4 style={{ margin: "0", fontSize: "0.85rem", fontWeight: 600, opacity: 0.8 }}>
                      Acompanhamento real
                    </h4>
                    <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                      <strong>Progresso:</strong> {progressByInternId[intern.id]?.progression_stage || "—"}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleContactIntern(intern)}
                        disabled={savingInternId === intern.id}
                      >
                        <span className="material-icons" style={{ fontSize: "1rem" }}>mail</span>
                        Contactar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEvaluation(intern)}
                        disabled={savingInternId === intern.id}
                      >
                        <span className="material-icons" style={{ fontSize: "1rem" }}>star</span>
                        Avaliar
                      </button>
                    </div>
                  </div>

                  {activeEvaluationId === intern.id && (
                    <div style={{ border: "1px solid var(--border-color, #d1d5db)", borderRadius: 12, padding: "1rem", background: "var(--surface-subtle, #f8fafc)" }}>
                      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                        <label style={{ display: "grid", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Tipo</span>
                          <input
                            value={evaluationDrafts[intern.id]?.eval_type || ""}
                            disabled
                            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Data</span>
                          <input
                            type="date"
                            value={evaluationDrafts[intern.id]?.eval_date || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEvaluationDrafts((prev) => ({
                                ...prev,
                                [intern.id]: {
                                  ...(prev[intern.id] || {}),
                                  eval_date: value,
                                },
                              }));
                            }}
                            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Classificação</span>
                          <RatingPicker
                            value={Number(evaluationDrafts[intern.id]?.rating || 3)}
                            onChange={(rating) => {
                              setEvaluationDrafts((prev) => ({
                                ...prev,
                                [intern.id]: {
                                  ...(prev[intern.id] || {}),
                                  rating,
                                },
                              }));
                            }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: "0.35rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Recomendação</span>
                          <select
                            value={evaluationDrafts[intern.id]?.recommendation || "NO_ACTION"}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEvaluationDrafts((prev) => ({
                                ...prev,
                                [intern.id]: {
                                  ...(prev[intern.id] || {}),
                                  recommendation: value,
                                },
                              }));
                            }}
                            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)" }}
                          >
                            {Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label style={{ display: "grid", gap: "0.35rem", marginTop: "0.75rem" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Comentários gerais</span>
                        <textarea
                          rows={3}
                          value={evaluationDrafts[intern.id]?.general_comments || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEvaluationDrafts((prev) => ({
                              ...prev,
                              [intern.id]: {
                                ...(prev[intern.id] || {}),
                                general_comments: value,
                              },
                            }));
                          }}
                          placeholder="Resumo da avaliação..."
                          style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: 8, border: "1px solid var(--border-color, #d1d5db)", fontFamily: "inherit" }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSaveEvaluation(intern)}
                          disabled={savingInternId === intern.id}
                        >
                          {savingInternId === intern.id ? "A guardar..." : "Guardar avaliação"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setActiveEvaluationId(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

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

                  {loadingSupplemental && (
                    <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.65 }}>
                      A sincronizar dados do acompanhamento...
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
