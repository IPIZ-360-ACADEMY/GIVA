import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import ClassRegisterModal from "../components/ClassRegisterModal.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { canUseInternshipsApi, listInternships } from "../services/internshipsService.js";
import { listManualClasses, createManualClass } from "../services/classesService.js";
import { matchesSearch } from "../utils/search.js";
import { filterByCoordinatorScope } from "../utils/coordinationScope.js";

const COURSE_RESOURCES = {
  TI: ["Guia de Desenvolvimento", "Checklist de Sprint", "Template de Relatorio Tecnico"],
  EIE: ["Manual de Seguranca Industrial", "Checklist de Bancada", "Plano de Ensaios"],
  TLQB: ["Protocolo de Laboratorio", "Ficha de Controlo de Qualidade", "Normas de Biosseguranca"],
};

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ClassesPage() {
  const { query, t, showToast } = useOutletContext();
  const { authProfile } = useAuth();
  const [rows, setRows] = useState([]);
  const [registeredClasses, setRegisteredClasses] = useState([]);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRows() {
      if (!canUseInternshipsApi()) {
        if (active) {
          setRows([]);
        }
        return;
      }

      try {
        const remoteRows = await listInternships();
        if (!active) {
          return;
        }
        setRows(remoteRows);
      } catch {
        if (active) {
          setRows([]);
          showToast("Falha ao carregar turmas na base remota.", "error");
        }
      }
    }

    loadRows();

    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    listManualClasses().then((items) => setRegisteredClasses(items)).catch(() => {});
  }, []);

  const classGroups = useMemo(() => {
    const scopedRows = filterByCoordinatorScope(rows, authProfile, {
      areaKeys: ["areaId", "area_id"],
      courseCodeKeys: ["curso", "course"],
    });

    const scopedRegisteredClasses = filterByCoordinatorScope(registeredClasses, authProfile, {
      areaKeys: ["areaId", "area_id"],
      courseCodeKeys: ["curso", "course"],
    });

    const byClass = new Map();

    for (const row of scopedRows) {
      if (!matchesSearch(query, `${row.turma} ${row.anoLetivo} ${row.curso} ${row.supervisor} ${row.aluno} ${row.empresa} ${row.email} ${row.telefone}`)) {
        continue;
      }

      const classKey = `${row.anoLetivo}|${row.curso}|${row.turma}`;
      if (!byClass.has(classKey)) {
        byClass.set(classKey, {
          key: classKey,
          anoLetivo: row.anoLetivo,
          curso: row.curso,
          turma: row.turma,
          supervisor: row.supervisor,
          total: 0,
          ativos: 0,
          monitoramento: 0,
          risco: 0,
          somaNotas: 0,
        });
      }

      const group = byClass.get(classKey);
      group.total += 1;
      group.somaNotas += Number(row.nota);
      if (row.status === "active") group.ativos += 1;
      if (row.status === "monitoring") group.monitoramento += 1;
      if (row.status === "risk") group.risco += 1;
    }

    for (const item of scopedRegisteredClasses) {
      if (!matchesSearch(query, `${item.turma} ${item.anoLetivo} ${item.curso} ${item.supervisor}`)) {
        continue;
      }

      const classKey = `${item.anoLetivo}|${item.curso}|${item.turma}`;
      if (byClass.has(classKey)) {
        continue;
      }

      const total = safeNumber(item.total, 0);
      const ativos = safeNumber(item.ativos, 0);
      const monitoramento = safeNumber(item.monitoramento, 0);
      const risco = safeNumber(item.risco, 0);
      const media = safeNumber(item.mediaNota, 0);

      byClass.set(classKey, {
        key: classKey,
        anoLetivo: item.anoLetivo,
        curso: item.curso,
        turma: item.turma,
        supervisor: item.supervisor || "-",
        total,
        ativos,
        monitoramento,
        risco,
        somaNotas: media * Math.max(total, 1),
      });
    }

    const byYear = new Map();
    for (const group of byClass.values()) {
      const avgNota = group.total ? (group.somaNotas / group.total).toFixed(1) : "0.0";
      const normalized = {
        ...group,
        mediaNota: avgNota,
      };

      if (!byYear.has(normalized.anoLetivo)) {
        byYear.set(normalized.anoLetivo, new Map());
      }

      const byCourse = byYear.get(normalized.anoLetivo);
      if (!byCourse.has(normalized.curso)) {
        byCourse.set(normalized.curso, []);
      }
      byCourse.get(normalized.curso).push(normalized);
    }

    return Array.from(byYear.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([anoLetivo, courseMap]) => ({
        anoLetivo,
        cursos: Array.from(courseMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([curso, turmas]) => ({
            curso,
            turmas: turmas.sort((a, b) => a.turma.localeCompare(b.turma)),
          })),
      }));
  }, [authProfile, query, registeredClasses, rows]);

  function registerClass(payload, validationError) {
    if (validationError) {
      showToast(validationError, "error");
      return false;
    }

    const classKey = `${payload.anoLetivo}|${payload.curso}|${payload.turma}`;
    const existsInRows = rows.some(
      (row) => `${row.anoLetivo}|${row.curso}|${row.turma}` === classKey
    );
    const existsInRegistry = registeredClasses.some(
      (item) => `${item.anoLetivo}|${item.curso}|${item.turma}` === classKey
    );

    if (existsInRows || existsInRegistry) {
      showToast("Esta turma/curso ja esta registada.", "error");
      return false;
    }

    const tempId = `manual-${Date.now()}`;
    const next = { ...payload, id: tempId };

    setRegisteredClasses((current) => [next, ...current]);
    showToast("Turma e curso registados com sucesso.");

    createManualClass(payload)
      .then((created) => {
        setRegisteredClasses((current) =>
          current.map((item) => (item.id === tempId ? created : item))
        );
      })
      .catch(() => {
        showToast("Turma guardada localmente — falha na sincronizacao remota.", "error");
      });

    return true;
  }

  return (
    <main className="page page-classes">

      {/* Hero header */}
      <div className="classes-hero">
        <div className="classes-hero-inner">
          <div className="classes-hero-badge">
            <span className="material-icons-sharp">school</span>
          </div>
          <div className="classes-hero-text">
            <h1 className="classes-hero-title">{t("classes.title")}</h1>
            <p className="classes-hero-sub">{t("classes.description")}</p>
          </div>
          <button className="classes-hero-btn" type="button" onClick={() => setShowRegisterModal(true)}>
            <span className="material-icons-sharp">add</span>
            Registar turma/curso
          </button>
        </div>
      </div>

      {/* Classes by year */}
      {classGroups.length ? (
        <div className="classes-years">
          {classGroups.map((yearGroup) => (
            <section key={yearGroup.anoLetivo} className="classes-year-section">
              <div className="classes-year-header">
                <span className="material-icons-sharp">event_note</span>
                <h2>{t("internships.schoolYear")}: <strong>{yearGroup.anoLetivo}</strong></h2>
                <span className="classes-year-total">
                  {yearGroup.cursos.reduce((s, c) => s + c.turmas.length, 0)} turmas
                </span>
              </div>

              {yearGroup.cursos.map((courseGroup) => (
                <div key={`${yearGroup.anoLetivo}-${courseGroup.curso}`} className="classes-course-section">
                  <div className="classes-course-header">
                    <span className="material-icons-sharp">book</span>
                    <h3>{courseGroup.curso}</h3>
                    <span className="classes-course-badge">{courseGroup.turmas.length} {t("classes.count")}</span>
                  </div>

                  <div className="classes-card-grid">
                    {courseGroup.turmas.map((turma) => {
                      const riskRate = turma.total ? Math.round((turma.risco / turma.total) * 100) : 0;
                      const detailUrl = `/turmas/detalhe?anoLetivo=${encodeURIComponent(turma.anoLetivo)}&curso=${encodeURIComponent(turma.curso)}&turma=${encodeURIComponent(turma.turma)}`;
                      const avgNum = Number(turma.mediaNota);

                      return (
                        <article className="classes-card" key={turma.key}>
                          <div className="classes-card-accent" />

                          <header className="classes-card-header">
                            <div>
                              <h4 className="classes-card-title">{turma.turma}</h4>
                              <p className="classes-card-meta">{turma.curso} · {turma.anoLetivo}</p>
                            </div>
                            <span className="classes-card-count">{turma.total}</span>
                          </header>

                          <div className="classes-card-kpis">
                            <div className="classes-card-kpi">
                              <span className={`classes-card-kpi-value classes-card-kpi-value--${avgNum >= 14 ? "high" : avgNum >= 10 ? "mid" : "low"}`}>
                                {turma.mediaNota}
                              </span>
                              <span className="classes-card-kpi-label">{t("classes.avgGrade")}</span>
                            </div>
                            <div className="classes-card-kpi">
                              <span className={`classes-card-kpi-value classes-card-kpi-value--${riskRate > 20 ? "low" : riskRate > 10 ? "mid" : "high"}`}>
                                {riskRate}%
                              </span>
                              <span className="classes-card-kpi-label">{t("classes.riskRate")}</span>
                            </div>
                          </div>

                          <div className="classes-card-status-row">
                            <span className="classes-card-status classes-card-status--active">
                              <span className="material-icons-sharp">check_circle</span> {turma.ativos}
                            </span>
                            <span className="classes-card-status classes-card-status--monitoring">
                              <span className="material-icons-sharp">visibility</span> {turma.monitoramento}
                            </span>
                            <span className="classes-card-status classes-card-status--risk">
                              <span className="material-icons-sharp">warning</span> {turma.risco}
                            </span>
                          </div>

                          <div className="classes-card-resources">
                            <span className="classes-card-resources-title">{t("classes.resources")}</span>
                            <ul>
                              {(COURSE_RESOURCES[turma.curso] ?? [t("classes.genericResource")]).map((resource) => (
                                <li key={resource}>{resource}</li>
                              ))}
                            </ul>
                          </div>

                          <footer className="classes-card-footer">
                            <span className="classes-card-supervisor">
                              <span className="material-icons-sharp">person</span>
                              {turma.supervisor}
                            </span>
                            <Link className="classes-card-open-btn" to={detailUrl} aria-label={`${t("classes.openClass")}: ${turma.turma}`}>
                              <span className="material-icons-sharp">open_in_new</span>
                              {t("classes.openClass")}
                            </Link>
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="classes-empty">
          <span className="material-icons-sharp">school</span>
          <p>{t("classes.empty")}</p>
        </div>
      )}

      {showRegisterModal ? (
        <ClassRegisterModal
          onClose={() => setShowRegisterModal(false)}
          onSave={registerClass}
          t={t}
        />
      ) : null}

    </main>
  );
}
