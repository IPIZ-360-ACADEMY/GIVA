import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAccessProfile } from "../contexts/AuthContext.jsx";
import { resolveEvaluationView } from "../utils/evaluationViewConfig.js";
import PageHeader from "../components/PageHeader.jsx";
import "../styles/evaluations.css";
import EvalDashboardAdmin from "../components/evaluations/EvalDashboardAdmin.jsx";
import EvalDashboardCoordinator from "../components/evaluations/EvalDashboardCoordinator.jsx";
import EvalDashboardTeacher from "../components/evaluations/EvalDashboardTeacher.jsx";
import EvalDashboardStudent from "../components/evaluations/EvalDashboardStudent.jsx";
import EvalDashboardCompany from "../components/evaluations/EvalDashboardCompany.jsx";

export default function EvaluationsPage() {
  const { t } = useOutletContext();
  const { userProfile } = useAuth();
  const accessProfile = useAccessProfile();
  const viewConfig = resolveEvaluationView(accessProfile);
  const [activeTab, setActiveTab] = useState(viewConfig.defaultTab);

  useEffect(() => {
    const visibleTabIds = viewConfig.tabs.map((tab) => tab.id);
    if (!visibleTabIds.includes(activeTab)) {
      setActiveTab(viewConfig.defaultTab);
    }
  }, [activeTab, viewConfig.defaultTab, viewConfig.tabs]);

  return (
    <main className="page page-evaluations">
      <PageHeader
        title={t("evaluations.title")}
        description={t("evaluations.description")}
      />

      {/* Tabs geradas pelo perfil de acesso */}
      <div className="eval-tabs" role="tablist">
        {viewConfig.tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da view activa */}
      <div className="eval-view-container" role="tabpanel">
        <EvalViewDispatcher
          viewMode={viewConfig.viewMode}
          activeTab={activeTab}
          userProfile={userProfile}
          t={t}
        />
      </div>
    </main>
  );
}

/**
 * Encaminha para o dashboard correto com base no viewMode derivado do perfil.
 */
function EvalViewDispatcher({ viewMode, activeTab, userProfile, t }) {
  if (viewMode === "admin") {
    return <EvalDashboardAdmin activeTab={activeTab} t={t} />;
  }
  if (viewMode === "coordinator") {
    return <EvalDashboardCoordinator activeTab={activeTab} t={t} userProfile={userProfile} />;
  }
  if (viewMode === "teacher") {
    return <EvalDashboardTeacher activeTab={activeTab} t={t} />;
  }
  if (viewMode === "student") {
    return <EvalDashboardStudent activeTab={activeTab} t={t} />;
  }
  if (viewMode === "company") {
    return <EvalDashboardCompany activeTab={activeTab} t={t} />;
  }
  // EXTERNAL / fallback — visão mínima de aluno sem dados sensíveis
  return <EvalDashboardStudent activeTab={activeTab} t={t} />;
}