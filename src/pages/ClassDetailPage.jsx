import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import DataTable from "../components/DataTable.jsx";
import StudentProfileModal from "../components/StudentProfileModal.jsx";
import { canUseInternshipsApi, listInternships } from "../services/internshipsService.js";

function statusLabel(status, t) {
  if (status === "active") return t("internships.active");
  if (status === "monitoring") return t("internships.monitoring");
  return t("internships.risk");
}

export default function ClassDetailPage() {
  const { t, showToast } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [rows, setRows] = useState([]);

  const turma = searchParams.get("turma") ?? "";
  const curso = searchParams.get("curso") ?? "";
  const anoLetivo = searchParams.get("anoLetivo") ?? "";

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
          showToast("Falha ao carregar detalhe da turma na base remota.", "error");
        }
      }
    }

    loadRows();

    return () => {
      active = false;
    };
  }, [showToast]);

  const students = useMemo(
    () =>
      rows.filter(
        (row) => row.turma === turma && row.curso === curso && row.anoLetivo === anoLetivo
      ).sort((a, b) => a.aluno.localeCompare(b.aluno)),
    [anoLetivo, curso, turma, rows]
  );

  const averageGrade = useMemo(() => {
    if (!students.length) return "0.0";
    const total = students.reduce((sum, row) => sum + Number(row.nota), 0);
    return (total / students.length).toFixed(1);
  }, [students]);

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
    { key: "empresa", label: t("common.company") },
    { key: "inicio", label: t("internships.startDate") },
    { key: "ultimaAtualizacao", label: t("internships.lastUpdate") },
    { key: "supervisor", label: t("internships.supervisor") },
    { key: "nota", label: t("internships.internshipGrade") },
    {
      key: "status",
      label: t("common.status"),
      render: (row) => statusLabel(row.status, t),
    },
    {
      key: "contato",
      label: t("classes.contact"),
      render: (row) => (
        <div className="classes-contact-cell">
          <small>{row.email}</small>
          <small>{row.telefone}</small>
        </div>
      ),
    },
  ];

  if (!students.length) {
    return (
      <main className="page page-class-detail">
        <PageHeader title={t("classes.detail.title")} description={t("classes.detail.notFound")} />
        <PanelSection title={t("classes.section.title")}>
          <Link className="btn ghost" to="/turmas">
            {t("classes.back")}
          </Link>
        </PanelSection>
      </main>
    );
  }

  return (
    <main className="page page-class-detail">
      <PageHeader
        title={`${t("classes.detail.title")} • ${turma}`}
        description={`${t("internships.schoolYear")}: ${anoLetivo} • ${t("common.course")}: ${curso}`}
        meta={
          <div className="classes-detail-meta">
            <span className="tag">{students.length} {t("internships.studentsCount")}</span>
            <span className="tag">{t("classes.avgGrade")}: {averageGrade}</span>
            <Link className="btn ghost" to="/turmas">
              {t("classes.back")}
            </Link>
          </div>
        }
      />

      <PanelSection title={t("classes.detail.listTitle")}>
        <DataTable columns={columns} rows={students} emptyText={t("classes.empty")} />
      </PanelSection>

      {selectedStudent !== null && (
        <StudentProfileModal student={selectedStudent} onClose={() => setSelectedStudent(null)} t={t} />
      )}
    </main>
  );
}
