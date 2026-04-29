import { Navigate, useParams, useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import ExpandedStudentProfile from "../components/ExpandedStudentProfile.jsx";

export default function StudentProfilePage() {
  const { t } = useOutletContext();
  const { studentId } = useParams();
  const { user, userProfile, authProfile } = useAuth();

  const role = String(authProfile?.role ?? "").toUpperCase();
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN_1";
  const isCompanyUser = userProfile?.type === "company" || role === "COMPANY";
  const targetStudentId = studentId || user?.id;

  if (isCompanyUser) {
    return <Navigate to="/empresa" replace />;
  }

  // Defesa em profundidade: fora do papel admin, só permite visualizar o próprio perfil.
  if (!isAdmin && targetStudentId && user?.id && targetStudentId !== user.id) {
    return <Navigate to={`/perfil/${user.id}`} replace />;
  }

  const isOwnProfile = user?.id === targetStudentId;

  return (
    <div className="student-profile-page">
      <ExpandedStudentProfile
        studentId={targetStudentId}
        t={t}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
}
