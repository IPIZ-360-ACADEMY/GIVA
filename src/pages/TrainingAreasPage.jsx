import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import TrainingAreaCard from "../components/TrainingAreaCard.jsx";
import ModalStepper from "../components/ModalStepper.jsx";
import { listTrainingAreas } from "../services/trainingAreaService.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isCoordinatorRole } from "../utils/accessControl.js";

export default function TrainingAreasPage() {
  const { t } = useOutletContext();
  const { authProfile } = useAuth();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadAreas();
  }, []);

  async function loadAreas() {
    setLoading(true);
    let data = await listTrainingAreas();
    // Se for coordenador, filtra apenas a área atribuída
    if (isCoordinatorRole(authProfile?.role) && authProfile?.areaId) {
      data = data.filter((a) => String(a.id) === String(authProfile.areaId));
    }
    setAreas(data);
    setLoading(false);
  }

  // Etapas do stepper: Área > Curso > Turma
  const steps = [
    {
      label: t("trainingArea.modal.step.area"),
      content: ({ form, onChange, errors, t }) => (
        <div>
          <label>{t("trainingArea.fields.name")}</label>
          <input value={form.areaName || ""} onChange={e => onChange({ areaName: e.target.value })} />
          {errors.areaName && <span className="form-error">{errors.areaName}</span>}
        </div>
      ),
      validate: (form) => {
        const err = {};
        if (!form.areaName || form.areaName.trim().length < 3) err.areaName = t("trainingArea.modal.required");
        return err;
      }
    },
    {
      label: t("trainingArea.modal.step.course"),
      content: ({ form, onChange, errors, t }) => (
        <div>
          <label>{t("trainingArea.fields.course")}</label>
          <input value={form.courseName || ""} onChange={e => onChange({ courseName: e.target.value })} />
          {errors.courseName && <span className="form-error">{errors.courseName}</span>}
        </div>
      ),
      validate: (form) => {
        const err = {};
        if (!form.courseName || form.courseName.trim().length < 2) err.courseName = t("trainingArea.modal.required");
        return err;
      }
    },
    {
      label: t("trainingArea.modal.step.class"),
      content: ({ form, onChange, errors, t }) => (
        <div>
          <label>{t("trainingArea.fields.class")}</label>
          <input value={form.className || ""} onChange={e => onChange({ className: e.target.value })} />
          {errors.className && <span className="form-error">{errors.className}</span>}
          <label>{t("trainingArea.fields.year")}</label>
          <input value={form.year || ""} onChange={e => onChange({ year: e.target.value })} />
          {errors.year && <span className="form-error">{errors.year}</span>}
          <label>{t("trainingArea.fields.coordinator")}</label>
          <input value={form.coordinator || ""} onChange={e => onChange({ coordinator: e.target.value })} />
          {errors.coordinator && <span className="form-error">{errors.coordinator}</span>}
        </div>
      ),
      validate: (form) => {
        const err = {};
        if (!form.className || form.className.trim().length < 2) err.className = t("trainingArea.modal.required");
        if (!form.year || form.year.trim().length < 4) err.year = t("trainingArea.modal.required");
        if (!form.coordinator || form.coordinator.trim().length < 3) err.coordinator = t("trainingArea.modal.required");
        return err;
      }
    }
  ];

  async function handleFinish(form) {
    // Aqui: chamada para criar área, curso e turma (em sequência ou via RPC)
    // Exemplo: await createTrainingAreaWithCourseAndClass(form)
    await loadAreas();
  }

  return (
    <main className="page page-training-areas">
      <PageHeader
        title={t("trainingArea.title")}
        description="Áreas de formação organizadas por categorias, com cursos associados"
        icon="school"
      />

      {(authProfile?.role === "SUPER_ADMIN" || isCoordinatorRole(authProfile?.role)) && (
        <div style={{ marginBottom: 24 }}>
          <button className="btn primary" onClick={() => setShowModal(true)}>
            {t("trainingArea.modal.newStructure")}
          </button>
        </div>
      )}

      <PanelSection title={t("trainingArea.title")}> 
        {loading ? (
          <p className="meta loading-state">A carregar áreas...</p>
        ) : areas.length === 0 ? (
          <p className="meta">Nenhuma área de formação disponível.</p>
        ) : (
          <div className="training-areas-grid">
            {areas.map((area) => (
              <TrainingAreaCard
                key={area.id}
                area={area}
                t={t}
                onSelect={() => {}}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {showModal && (
        <ModalStepper
          steps={steps}
          onClose={() => setShowModal(false)}
          onFinish={handleFinish}
          t={t}
        />
      )}
    </main>
  );
}
