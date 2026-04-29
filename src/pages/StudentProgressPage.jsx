import { Navigate, useParams, useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import CompanyProgressTimeline from "../components/CompanyProgressTimeline.jsx";
import { listStudentApplications } from "../services/jobApplicationService.js";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function StudentProgressPage() {
  const { t } = useOutletContext();
  const { studentId } = useParams();
  const { user, userProfile, authProfile } = useAuth();
  const [applications, setApplications] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = String(authProfile?.role ?? "").toUpperCase();
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN_1";
  const isCompanyUser = userProfile?.type === "company" || role === "COMPANY";
  const targetStudentId = studentId || user?.id;

  useEffect(() => {
    loadApplications();
  }, [targetStudentId]);

  async function loadApplications() {
    if (!targetStudentId) {
      setLoading(false);
      return;
    }

    const apps = await listStudentApplications(targetStudentId);
    const accepted = apps?.filter((app) => app.status === "ACCEPTED") || [];
    setApplications(accepted);
    if (accepted.length > 0) {
      setSelectedPartner(accepted[0].partner_id);
    }
    setLoading(false);
  }

  if (isCompanyUser) {
    return <Navigate to="/empresa" replace />;
  }

  // Defesa em profundidade: fora do papel admin, só permite ver o próprio progresso.
  if (!isAdmin && targetStudentId && user?.id && targetStudentId !== user.id) {
    return <Navigate to={`/progresso/${user.id}`} replace />;
  }

  if (loading) return <div className="loading">A carregar...</div>;

  if (applications.length === 0) {
    return (
      <div className="progress-page">
        <h1>{t("progressCompany.title")}</h1>
        <p className="empty">{t("common.noData")}</p>
      </div>
    );
  }

  return (
    <div className="progress-page">
      <h1>{t("progressCompany.title")}</h1>

      <div className="partner-selector">
        <label>{t("progressCompany.selectPartner")}</label>
        <select
          value={selectedPartner || ""}
          onChange={(e) => setSelectedPartner(e.target.value)}
        >
          {applications.map((app) => (
            <option key={app.partner_id} value={app.partner_id}>
              {app.partner?.empresa ?? app.partner_id}
            </option>
          ))}
        </select>
      </div>

      {selectedPartner && (
        <CompanyProgressTimeline
          studentId={targetStudentId}
          partnerId={selectedPartner}
          t={t}
          isCompanyView={false}
        />
      )}
    </div>
  );
}
