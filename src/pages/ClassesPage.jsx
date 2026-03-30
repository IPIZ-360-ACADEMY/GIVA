import { useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import { INTERNSHIPS_ROWS } from "../data/internshipsData.js";
import { matchesSearch } from "../utils/search.js";

const COURSE_RESOURCES = {
  TI: ["Guia de Desenvolvimento", "Checklist de Sprint", "Template de Relatorio Tecnico"],
  EIE: ["Manual de Seguranca Industrial", "Checklist de Bancada", "Plano de Ensaios"],
  TLQB: ["Protocolo de Laboratorio", "Ficha de Controlo de Qualidade", "Normas de Biosseguranca"],
};

export default function ClassesPage() {
  const { query, t } = useOutletContext();

  const classGroups = useMemo(() => {
    const byClass = new Map();

    for (const row of INTERNSHIPS_ROWS) {
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
  }, [query]);

  return (
    <main className="page">
      <PageHeader title={t("classes.title")} description={t("classes.description")} />

      <PanelSection title={t("classes.section.title")}>
        {classGroups.length ? (
          <div className="classes-year-list">
            {classGroups.map((yearGroup) => (
              <section key={yearGroup.anoLetivo} className="classes-year-block" aria-label={`${t("internships.schoolYear")}: ${yearGroup.anoLetivo}`}>
                <header className="classes-year-header">
                  <h3>{t("internships.schoolYear")}: {yearGroup.anoLetivo}</h3>
                </header>

                {yearGroup.cursos.map((courseGroup) => (
                  <section key={`${yearGroup.anoLetivo}-${courseGroup.curso}`} className="classes-course-block" aria-label={`${t("common.course")}: ${courseGroup.curso}`}>
                    <div className="classes-course-head">
                      <h4>{t("common.course")}: {courseGroup.curso}</h4>
                      <span className="tag">{courseGroup.turmas.length} {t("classes.count")}</span>
                    </div>

                    <div className="class-grid">
                      {courseGroup.turmas.map((turma) => {
                        const riskRate = turma.total ? Math.round((turma.risco / turma.total) * 100) : 0;
                        const detailUrl = `/turmas/detalhe?anoLetivo=${encodeURIComponent(turma.anoLetivo)}&curso=${encodeURIComponent(
                          turma.curso
                        )}&turma=${encodeURIComponent(turma.turma)}`;
                        return (
                          <article className="class-card classes-card-rich" key={turma.key}>
                            <header className="class-card-head">
                              <div>
                                <h4>{turma.turma}</h4>
                                <p>{t("internships.schoolYear")}: {turma.anoLetivo}</p>
                                <p>{t("common.course")}: {turma.curso}</p>
                              </div>
                              <span className="tag">{turma.total} {t("internships.studentsCount")}</span>
                            </header>

                            <div className="classes-kpis" role="list" aria-label={t("classes.kpis")}>
                              <div className="classes-kpi" role="listitem">
                                <small>{t("classes.avgGrade")}</small>
                                <strong>{turma.mediaNota}</strong>
                              </div>
                              <div className="classes-kpi" role="listitem">
                                <small>{t("classes.riskRate")}</small>
                                <strong>{riskRate}%</strong>
                              </div>
                            </div>

                            <div className="classes-metrics">
                              <span className="tag">{t("internships.active")}: {turma.ativos}</span>
                              <span className="tag">{t("internships.monitoring")}: {turma.monitoramento}</span>
                              <span className="tag">{t("internships.risk")}: {turma.risco}</span>
                            </div>

                            <div className="classes-resources" aria-label={t("classes.resources")}>
                              <strong>{t("classes.resources")}</strong>
                              <ul>
                                {(COURSE_RESOURCES[turma.curso] ?? [t("classes.genericResource")]).map((resource) => (
                                  <li key={resource}>{resource}</li>
                                ))}
                              </ul>
                            </div>

                            <footer className="class-card-foot">
                              {t("internships.supervisor")}: {turma.supervisor}
                              <span className="classes-open-hint">{t("classes.openClassHint")}</span>
                            </footer>

                            <div className="classes-card-actions">
                              <Link className="btn primary" to={detailUrl} aria-label={`${t("classes.openClass")}: ${turma.turma}`}>
                                {t("classes.openClass")}
                              </Link>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <p className="meta">{t("classes.empty")}</p>
        )}
      </PanelSection>

    </main>
  );
}
