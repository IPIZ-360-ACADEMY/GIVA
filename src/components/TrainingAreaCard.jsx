import { useEffect, useState } from "react";
import {
  listCoursesByArea,
  createCourse,
} from "../services/trainingAreaService.js";

import { useAuth } from "../contexts/AuthContext.jsx";
import { isCoordinatorRole } from "../utils/accessControl.js";

export default function TrainingAreaCard({ area, t, onSelect }) {
  const { authProfile } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");

  useEffect(() => {
    if (expanded && courses.length === 0) {
      loadCourses();
    }
  }, [expanded]);

  async function loadCourses() {
    setLoading(true);
    let data = await listCoursesByArea(area.id);
    // Se for coordenador, só mostra cursos da sua área
    if (isCoordinatorRole(authProfile?.role) && authProfile?.areaId && String(area.id) !== String(authProfile.areaId)) {
      data = [];
    }
    setCourses(data);
    setLoading(false);
  }

  async function handleAddCourse() {
    if (!newCourseName.trim()) return;

    const result = await createCourse(area.id, {
      code: newCourseName.substring(0, 3).toUpperCase(),
      name: newCourseName,
    });

    if (result) {
      setCourses([...courses, result]);
      setNewCourseName("");
      setShowCourseForm(false);
    }
  }

  return (
    <div
      className="training-area-card"
      style={{ borderLeftColor: area.color_hex }}
    >
      <div className="training-area-header" onClick={() => setExpanded(!expanded)}>
        <div
          className="training-area-icon"
          style={{ backgroundColor: area.color_hex }}
        >
          <span className="material-icons-sharp">{area.icon_name || "school"}</span>
        </div>
        <div className="training-area-info">
          <h3>{area.name}</h3>
          <small className="meta">{courses.length} cursos</small>
        </div>
        <span className="material-icons-sharp expand-icon">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </div>

      {expanded && (
        <div className="training-area-content">
          {loading ? (
            <p className="meta loading-state">A carregar cursos...</p>
          ) : courses.length === 0 ? (
            <p className="meta">Nenhum curso criado ainda.</p>
          ) : (
            <div className="course-list">
              {courses.map((course) => (
                <div key={course.id} className="course-item">
                  <span>{course.name}</span>
                  <small className="meta">{course.code}</small>
                </div>
              ))}
            </div>
          )}

          {showCourseForm ? (
            <div className="course-form">
              <input
                type="text"
                placeholder="Nome do curso"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                autoFocus
              />
              <div className="form-actions">
                <button
                  className="btn ghost small"
                  onClick={() => setShowCourseForm(false)}
                >
                  Cancelar
                </button>
                <button
                  className="btn primary small"
                  onClick={handleAddCourse}
                >
                  Adicionar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn ghost small full-width"
              onClick={() => setShowCourseForm(true)}
            >
              <span className="material-icons-sharp">add</span>
              Novo curso
            </button>
          )}
        </div>
      )}

    </div>
  );
}
