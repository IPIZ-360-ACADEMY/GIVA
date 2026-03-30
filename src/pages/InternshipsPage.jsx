import { useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { matchesSearch } from "../utils/search.js";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import StudentProfileModal from "../components/StudentProfileModal.jsx";
import { INTERNSHIPS_ROWS } from "../data/internshipsData.js";

const STORAGE_KEY = "giva.internships.filters";
const PAGE_SIZE_OPTIONS = [3, 5, 10];

function readStoredFilters() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const pageSize = PAGE_SIZE_OPTIONS.includes(parsed.pageSize) ? parsed.pageSize : 3;
    return {
      statusFilter: typeof parsed.statusFilter === "string" ? parsed.statusFilter : "all",
      schoolYearFilter: typeof parsed.schoolYearFilter === "string" ? parsed.schoolYearFilter : "all",
      classFilter: typeof parsed.classFilter === "string" ? parsed.classFilter : "all",
      classSortBy: parsed.classSortBy === "date" || parsed.classSortBy === "name" ? parsed.classSortBy : "grade",
      pageSize,
    };
  } catch {
    return null;
  }
}

function statusLabel(status, copy) {
  if (status === "active") return copy.active;
  if (status === "monitoring") return copy.monitoring;
  return copy.risk;
}

function parseDateLabel(value) {
  if (!value) {
    return 0;
  }
  const parts = value.split(" ");
  if (parts.length !== 3) {
    return 0;
  }
  const day = Number(parts[0]);
  const monthMap = {
    Jan: 0,
    Fev: 1,
    Mar: 2,
    Abr: 3,
    Mai: 4,
    Jun: 5,
    Jul: 6,
    Ago: 7,
    Set: 8,
    Out: 9,
    Nov: 10,
    Dez: 11,
  };
  const month = monthMap[parts[1]];
  const year = Number(parts[2]);
  if (Number.isNaN(day) || Number.isNaN(year) || month === undefined) {
    return 0;
  }
  return new Date(year, month, day).getTime();
}

export default function InternshipsPage() {
  const { query, showToast, t } = useOutletContext();
  const savedFilters = useMemo(() => readStoredFilters(), []);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const copy = {
    active: t("internships.active"),
    monitoring: t("internships.monitoring"),
    risk: t("internships.risk")
  };
  const [statusFilter, setStatusFilter] = useState(savedFilters?.statusFilter ?? "all");
  const [schoolYearFilter, setSchoolYearFilter] = useState(savedFilters?.schoolYearFilter ?? "all");
  const [classFilter, setClassFilter] = useState(savedFilters?.classFilter ?? "all");
  const [classSortBy, setClassSortBy] = useState(savedFilters?.classSortBy ?? "grade");
  const [pageSize, setPageSize] = useState(savedFilters?.pageSize ?? 3);
  const [classPage, setClassPage] = useState({});
  const [rows] = useState(INTERNSHIPS_ROWS);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        statusFilter,
        schoolYearFilter,
        classFilter,
        classSortBy,
        pageSize,
      })
    );
  }, [classFilter, classSortBy, pageSize, schoolYearFilter, statusFilter]);

  useEffect(() => {
    setClassPage({});
  }, [classFilter, classSortBy, pageSize, query, schoolYearFilter, statusFilter]);

  const schoolYearOptions = useMemo(
    () => [...new Set(rows.map((row) => row.anoLetivo))].sort((a, b) => b.localeCompare(a)),
    [rows]
  );

  const classOptions = useMemo(
    () => [...new Set(rows.map((row) => row.turma))].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const statusOk = statusFilter === "all" || row.status === statusFilter;
        const yearOk = schoolYearFilter === "all" || row.anoLetivo === schoolYearFilter;
        const classOk = classFilter === "all" || row.turma === classFilter;
        const textOk = matchesSearch(
          query,
          `${row.aluno} ${row.turma} ${row.anoLetivo} ${row.curso} ${row.empresa} ${row.supervisor} ${row.status} ${row.inicio} ${row.nota}`
        );
        return statusOk && yearOk && classOk && textOk;
      }),
    [classFilter, query, rows, schoolYearFilter, statusFilter]
  );

  const classGroups = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      const key = `${row.anoLetivo}|${row.turma}`;
      if (!map.has(key)) {
        map.set(key, {
          turma: row.turma,
          anoLetivo: row.anoLetivo,
          curso: row.curso,
          supervisor: row.supervisor,
          alunos: [],
        });
      }
      map.get(key).alunos.push(row);
    }

    for (const group of map.values()) {
      group.alunos.sort((a, b) => {
        if (classSortBy === "name") {
          return a.aluno.localeCompare(b.aluno);
        }

        if (classSortBy === "date") {
          const dateDiff = parseDateLabel(b.ultimaAtualizacao) - parseDateLabel(a.ultimaAtualizacao);
          if (dateDiff !== 0) {
            return dateDiff;
          }
          return Number(b.nota) - Number(a.nota);
        }

        const gradeDiff = Number(b.nota) - Number(a.nota);
        if (gradeDiff !== 0) {
          return gradeDiff;
        }
        return parseDateLabel(b.ultimaAtualizacao) - parseDateLabel(a.ultimaAtualizacao);
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.anoLetivo === b.anoLetivo) {
        return a.turma.localeCompare(b.turma);
      }
      return b.anoLetivo.localeCompare(a.anoLetivo);
    });
  }, [classSortBy, filtered]);

  const columns = [
    {
      key: "aluno",
      label: t("common.student"),
      render: (row) => (
        <button type="button" className="btn-student-name" onClick={() => setSelectedStudent(row)}>
          <img className="student-avatar-sm" src={row.photo} alt="" />
          {row.aluno}
        </button>
      ),
    },
    { key: "turma", label: t("internships.class") },
    { key: "anoLetivo", label: t("internships.schoolYear") },
    { key: "curso", label: t("common.course") },
    { key: "empresa", label: t("common.company") },
    { key: "inicio", label: t("internships.startDate") },
    { key: "nota", label: t("internships.internshipGrade") },
    { key: "status", label: t("common.status"), render: (row) => statusLabel(row.status, copy) },
    {
      key: "acao",
      label: t("common.action"),
      render: (row) => (
        <button className="btn ghost" type="button" onClick={() => showToast(t("internships.toast.details").replace("{name}", row.aluno))}>
          {t("common.details")}
        </button>
      )
    }
  ];

  return (
    <main className="page">
      <PageHeader
        title={t("internships.title")}
        description={t("internships.description")}
        meta={
          <div className="internships-toolbar">
            <span className="tag">
              <span className="material-icons-sharp">filter_alt</span>
              {t("internships.filter")}
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">{t("internships.all")}</option>
                <option value="active">{t("internships.active")}</option>
                <option value="monitoring">{t("internships.monitoring")}</option>
                <option value="risk">{t("internships.risk")}</option>
              </select>
            </span>

            <span className="tag">
              <span className="material-icons-sharp">calendar_month</span>
              {t("internships.schoolYear")}
              <select value={schoolYearFilter} onChange={(event) => setSchoolYearFilter(event.target.value)}>
                <option value="all">{t("internships.allYears")}</option>
                {schoolYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </span>

            <span className="tag">
              <span className="material-icons-sharp">groups</span>
              {t("internships.class")}
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="all">{t("internships.allClasses")}</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </span>
          </div>
        }
      />

      <PanelSection title={t("internships.priorityList")}>
        <DataTable columns={columns} rows={filtered} />
      </PanelSection>

      <PanelSection title={t("internships.classListTitle")}>
        <div className="internships-class-controls">
          <span className="tag">
            <span className="material-icons-sharp">sort</span>
            {t("internships.sortBy")}
            <select value={classSortBy} onChange={(event) => setClassSortBy(event.target.value)}>
              <option value="grade">{t("internships.sortGrade")}</option>
              <option value="date">{t("internships.sortDate")}</option>
              <option value="name">{t("internships.sortName")}</option>
            </select>
          </span>

          <span className="tag">
            <span className="material-icons-sharp">format_list_numbered</span>
            {t("internships.itemsPerPage")}
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </span>
        </div>

        <div className="class-grid">
          {classGroups.length ? (
            classGroups.map((group) => {
              const groupKey = `${group.anoLetivo}-${group.turma}`;
              const totalPages = Math.max(1, Math.ceil(group.alunos.length / pageSize));
              const currentPage = Math.min(classPage[groupKey] ?? 1, totalPages);
              const startIndex = (currentPage - 1) * pageSize;
              const visibleStudents = group.alunos.slice(startIndex, startIndex + pageSize);

              return (
                <article className="class-card" key={groupKey}>
                <header className="class-card-head">
                  <div>
                    <h4>{group.turma}</h4>
                    <p>
                      {t("internships.schoolYear")}: {group.anoLetivo}
                    </p>
                    <p>
                      {t("common.course")}: {group.curso}
                    </p>
                  </div>
                  <span className="tag">{group.alunos.length} {t("internships.studentsCount")}</span>
                </header>

                <div className="class-list">
                  {visibleStudents.map((student) => (
                    <button
                      className="class-list-item"
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <img className="student-avatar-md" src={student.photo} alt="" />

                      <div className="class-list-copy">
                        <strong>{student.aluno}</strong>
                        <small>
                          {t("internships.startDate")}: {student.inicio} • {t("internships.internshipGrade")}: {student.nota}
                        </small>
                        <small>
                          {t("internships.lastUpdate")}: {student.ultimaAtualizacao}
                        </small>
                      </div>

                      <span className="tag class-list-tag">{statusLabel(student.status, copy)}</span>
                    </button>
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="class-pagination" role="navigation" aria-label={t("internships.paginationLabel")}>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() =>
                        setClassPage((current) => ({
                          ...current,
                          [groupKey]: Math.max(1, (current[groupKey] ?? 1) - 1),
                        }))
                      }
                      disabled={currentPage === 1}
                    >
                      {t("internships.previous")}
                    </button>

                    <span className="meta">
                      {t("internships.page")}: {currentPage}/{totalPages}
                    </span>

                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() =>
                        setClassPage((current) => ({
                          ...current,
                          [groupKey]: Math.min(totalPages, (current[groupKey] ?? 1) + 1),
                        }))
                      }
                      disabled={currentPage === totalPages}
                    >
                      {t("internships.next")}
                    </button>
                  </div>
                ) : null}

                <footer className="class-card-foot">
                  {t("internships.supervisor")}: {group.supervisor}
                </footer>
                </article>
              );
            })
          ) : (
            <p className="meta">{t("internships.emptyClasses")}</p>
          )}
        </div>
      </PanelSection>

      {selectedStudent !== null && (
        <StudentProfileModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          t={t}
        />
      )}
    </main>
  );
}
