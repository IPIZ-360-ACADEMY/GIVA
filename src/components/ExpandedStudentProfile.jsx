import { useEffect, useState } from "react";
import {
  getStudentProfile,
  updateStudentProfile,
  uploadProfilePhoto,
  getStudentPortfolio,
  addPortfolioItem,
  deletePortfolioItem,
} from "../services/studentProfileService.js";

export default function ExpandedStudentProfile({ studentId, t, isOwnProfile }) {
  const [profile, setProfile] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [activeTab, setActiveTab] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadProfile();
    loadPortfolio();
  }, [studentId]);

  async function loadProfile() {
    const data = await getStudentProfile(studentId);
    setProfile(data);
  }

  async function loadPortfolio() {
    const items = await getStudentPortfolio(studentId);
    setPortfolio(items || []);
    setLoading(false);
  }

  if (!profile) return <div className="profile-loading">A carregar...</div>;

  return (
    <div className="expanded-profile">
      {/* Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.profile_photo_url ? (
            <img src={profile.profile_photo_url} alt={profile.full_name} />
          ) : (
            <div className="avatar-placeholder">
              {profile.full_name?.charAt(0).toUpperCase()}
            </div>
          )}
          {isOwnProfile && (
            <label className="photo-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0])}
                hidden
              />
              <span>📷</span>
            </label>
          )}
        </div>
        <div className="profile-intro">
          <h2>{profile.full_name}</h2>
          <p className="meta">
            {profile.training_area?.name} • {profile.course?.name}
          </p>
          {profile.professional_summary && (
            <p className="summary">{profile.professional_summary}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button
          className={`tab ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          {t("studentProfile.personal.title")}
        </button>
        <button
          className={`tab ${activeTab === "academic" ? "active" : ""}`}
          onClick={() => setActiveTab("academic")}
        >
          {t("studentProfile.academic.title")}
        </button>
        <button
          className={`tab ${activeTab === "professional" ? "active" : ""}`}
          onClick={() => setActiveTab("professional")}
        >
          {t("studentProfile.professional.title")}
        </button>
        <button
          className={`tab ${activeTab === "portfolio" ? "active" : ""}`}
          onClick={() => setActiveTab("portfolio")}
        >
          {t("studentProfile.portfolio.title")}
        </button>
      </div>

      {/* Content */}
      <div className="profile-content">
        {activeTab === "personal" && (
          <PersonalTab
            profile={profile}
            onUpdate={loadProfile}
            t={t}
            isOwnProfile={isOwnProfile}
          />
        )}

        {activeTab === "academic" && (
          <AcademicTab profile={profile} t={t} />
        )}

        {activeTab === "professional" && (
          <ProfessionalTab
            profile={profile}
            onUpdate={loadProfile}
            t={t}
            isOwnProfile={isOwnProfile}
          />
        )}

        {activeTab === "portfolio" && (
          <PortfolioTab
            portfolio={portfolio}
            onUpdate={loadPortfolio}
            studentId={studentId}
            t={t}
            isOwnProfile={isOwnProfile}
          />
        )}
      </div>
    </div>
  );

  async function handlePhotoUpload(file) {
    if (!file) return;
    const url = await uploadProfilePhoto(studentId, file);
    if (url) {
      setProfile({ ...profile, profile_photo_url: url });
    }
  }
}

// Personal Tab
function PersonalTab({ profile, onUpdate, t, isOwnProfile }) {
  const [formData, setFormData] = useState({
    email: profile.email || "",
    phone: profile.phone_number || "",
    address: profile.address || "",
    city: profile.city || "",
    postal_code: profile.postal_code || "",
    bio: profile.bio || "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const result = await updateStudentProfile(profile.id, {
      ...formData,
      phone_number: formData.phone,
    });
    setLoading(false);
    if (result) onUpdate();
  }

  return (
    <div className="tab-content">
      <h3>{t("studentProfile.personal.title")}</h3>
      {isOwnProfile ? (
        <div className="form-grid">
          <div className="form-field">
            <label>{t("studentProfile.personal.email")}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              disabled
            />
          </div>
          <div className="form-field">
            <label>{t("studentProfile.personal.phone")}</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
          <div className="form-field full-width">
            <label>{t("studentProfile.personal.address")}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label>{t("studentProfile.personal.city")}</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label>{t("studentProfile.personal.postalCode")}</label>
            <input
              type="text"
              value={formData.postal_code}
              onChange={(e) =>
                setFormData({ ...formData, postal_code: e.target.value })
              }
            />
          </div>
          <div className="form-field full-width">
            <label>{t("studentProfile.personal.bio")}</label>
            <textarea
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
              rows="4"
            />
          </div>
          <button className="btn primary" onClick={handleSave} disabled={loading}>
            {loading ? "A guardar..." : t("common.save")}
          </button>
        </div>
      ) : (
        <div className="profile-view">
          <p>
            <strong>{t("studentProfile.personal.email")}:</strong> {profile.email}
          </p>
          <p>
            <strong>{t("studentProfile.personal.phone")}:</strong> {profile.phone_number || "—"}
          </p>
          <p>
            <strong>{t("studentProfile.personal.address")}:</strong>{" "}
            {profile.address || "—"}
          </p>
          <p>
            <strong>{t("studentProfile.personal.city")}:</strong> {profile.city || "—"}
          </p>
          <p>
            <strong>{t("studentProfile.personal.bio")}:</strong>
          </p>
          <p>{profile.bio || "Nenhuma bio definida"}</p>
        </div>
      )}
    </div>
  );
}

// Academic Tab
function AcademicTab({ profile, t }) {
  return (
    <div className="tab-content">
      <h3>{t("studentProfile.academic.title")}</h3>
      <div className="academic-info">
        <div className="info-card">
          <label>{t("studentProfile.academic.trainingArea")}</label>
          <p>{profile.training_area?.name || "—"}</p>
        </div>
        <div className="info-card">
          <label>{t("studentProfile.academic.course")}</label>
          <p>{profile.course?.name || "—"}</p>
        </div>
        <div className="info-card">
          <label>{t("studentProfile.academic.status")}</label>
          <p>{profile.status || "ACTIVE"}</p>
        </div>
        <div className="info-card">
          <label>{t("studentProfile.academic.enrolled")}</label>
          <p>
            {profile.created_at
              ? new Date(profile.created_at).toLocaleDateString("pt-PT")
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// Professional Tab
function ProfessionalTab({ profile, onUpdate, t, isOwnProfile }) {
  const [formData, setFormData] = useState({
    professional_summary: profile.professional_summary || "",
    skills: profile.skills?.join(", ") || "",
    languages: profile.languages?.join(", ") || "",
    portfolio_url: profile.portfolio_url || "",
    linkedin_url: profile.linkedin_url || "",
    cv_url: profile.cv_url || "",
    cover_letter_url: profile.cover_letter_url || "",
    internship_letter_url: profile.internship_letter_url || "",
  });
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const updateData = {
      ...formData,
      skills: formData.skills
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      languages: formData.languages
        .split(",")
        .map((l) => l.trim())
        .filter((l) => l),
    };
    const result = await updateStudentProfile(profile.id, updateData);
    setLoading(false);
    if (result) onUpdate();
  }

  return (
    <div className="tab-content">
      <h3>{t("studentProfile.professional.title")}</h3>
      {isOwnProfile ? (
        <div className="form-grid">
          <div className="form-field full-width">
            <label>{t("studentProfile.professional.summary")}</label>
            <textarea
              value={formData.professional_summary}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  professional_summary: e.target.value,
                })
              }
              rows="4"
            />
          </div>
          <div className="form-field full-width">
            <label>{t("studentProfile.professional.skills")}</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) =>
                setFormData({ ...formData, skills: e.target.value })
              }
              placeholder="JavaScript, React, Node.js, ..."
            />
          </div>
          <div className="form-field full-width">
            <label>{t("studentProfile.professional.languages")}</label>
            <input
              type="text"
              value={formData.languages}
              onChange={(e) =>
                setFormData({ ...formData, languages: e.target.value })
              }
              placeholder="Português, Inglês, Espanhol, ..."
            />
          </div>
          <div className="form-field">
            <label>{t("studentProfile.professional.portfolioUrl")}</label>
            <input
              type="url"
              value={formData.portfolio_url}
              onChange={(e) =>
                setFormData({ ...formData, portfolio_url: e.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label>{t("studentProfile.professional.linkedinUrl")}</label>
            <input
              type="url"
              value={formData.linkedin_url}
              onChange={(e) =>
                setFormData({ ...formData, linkedin_url: e.target.value })
              }
            />
          </div>
          <div className="form-field">
            <label>URL do CV</label>
            <input
              type="url"
              value={formData.cv_url}
              onChange={(e) =>
                setFormData({ ...formData, cv_url: e.target.value })
              }
              placeholder="https://.../cv.pdf"
            />
          </div>
          <div className="form-field">
            <label>URL da Carta de Apresentação</label>
            <input
              type="url"
              value={formData.cover_letter_url}
              onChange={(e) =>
                setFormData({ ...formData, cover_letter_url: e.target.value })
              }
              placeholder="https://.../carta-apresentacao.pdf"
            />
          </div>
          <div className="form-field full-width">
            <label>URL da Carta de Estágio</label>
            <input
              type="url"
              value={formData.internship_letter_url}
              onChange={(e) =>
                setFormData({ ...formData, internship_letter_url: e.target.value })
              }
              placeholder="https://.../carta-estagio.pdf"
            />
          </div>
          <button className="btn primary" onClick={handleSave} disabled={loading}>
            {loading ? "A guardar..." : t("common.save")}
          </button>
        </div>
      ) : (
        <div className="profile-view">
          <h4>{t("studentProfile.professional.summary")}</h4>
          <p>{profile.professional_summary || "—"}</p>
          {profile.skills && profile.skills.length > 0 && (
            <>
              <h4>{t("studentProfile.professional.skills")}</h4>
              <div className="tags">
                {profile.skills.map((skill) => (
                  <span key={skill} className="tag">
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
          {profile.languages && profile.languages.length > 0 && (
            <>
              <h4>{t("studentProfile.professional.languages")}</h4>
              <div className="tags">
                {profile.languages.map((lang) => (
                  <span key={lang} className="tag">
                    {lang}
                  </span>
                ))}
              </div>
            </>
          )}
          {profile.portfolio_url && (
            <p>
              <strong>{t("studentProfile.professional.portfolioUrl")}:</strong>{" "}
              <a href={profile.portfolio_url} target="_blank">
                Ver portfólio
              </a>
            </p>
          )}
          {profile.cv_url && (
            <p>
              <strong>CV:</strong>{" "}
              <a href={profile.cv_url} target="_blank" rel="noreferrer">
                Abrir CV
              </a>
            </p>
          )}
          {profile.cover_letter_url && (
            <p>
              <strong>Carta de Apresentação:</strong>{" "}
              <a href={profile.cover_letter_url} target="_blank" rel="noreferrer">
                Abrir Carta
              </a>
            </p>
          )}
          {profile.internship_letter_url && (
            <p>
              <strong>Carta de Estágio:</strong>{" "}
              <a href={profile.internship_letter_url} target="_blank" rel="noreferrer">
                Abrir Carta
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Portfolio Tab
function PortfolioTab({ portfolio, onUpdate, studentId, t, isOwnProfile }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "PROJECT",
    title: "",
    description: "",
    organization: "",
    url: "",
    tags: "",
  });
  const [loading, setLoading] = useState(false);

  async function handleAddItem() {
    setLoading(true);
    const itemData = {
      ...formData,
      tags: formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t),
    };
    const result = await addPortfolioItem(studentId, itemData);
    setLoading(false);
    if (result) {
      setShowForm(false);
      setFormData({
        type: "PROJECT",
        title: "",
        description: "",
        organization: "",
        url: "",
        tags: "",
      });
      onUpdate();
    }
  }

  return (
    <div className="tab-content">
      <div className="portfolio-header">
        <h3>{t("studentProfile.portfolio.title")}</h3>
        {isOwnProfile && (
          <button className="btn secondary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "Adicionar item"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="portfolio-form">
          <div className="form-grid">
            <div className="form-field">
              <label>{t("studentProfile.portfolio.type")}</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
              >
                <option value="PROJECT">Projeto</option>
                <option value="CERTIFICATION">Certificação</option>
                <option value="COMPETITION">Competição</option>
                <option value="VOLUNTEER">Voluntário</option>
                <option value="AWARD">Prémio</option>
              </select>
            </div>
            <div className="form-field full-width">
              <label>{t("studentProfile.portfolio.title")}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="form-field full-width">
              <label>{t("studentProfile.portfolio.description")}</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows="3"
              />
            </div>
            <div className="form-field">
              <label>{t("studentProfile.portfolio.organization")}</label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) =>
                  setFormData({ ...formData, organization: e.target.value })
                }
              />
            </div>
            <div className="form-field">
              <label>URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
              />
            </div>
            <div className="form-field full-width">
              <label>{t("studentProfile.portfolio.tags")}</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
                placeholder="React, JavaScript, CSS, ..."
              />
            </div>
            <button
              className="btn primary"
              onClick={handleAddItem}
              disabled={loading}
            >
              {loading ? "A adicionar..." : "Adicionar"}
            </button>
          </div>
        </div>
      )}

      <div className="portfolio-items">
        {portfolio.length === 0 ? (
          <p className="empty">{t("common.noData")}</p>
        ) : (
          portfolio.map((item) => (
            <div key={item.id} className="portfolio-item">
              <div className="item-header">
                <h4>{item.title}</h4>
                <span className="item-type">{item.type}</span>
              </div>
              <p className="description">{item.description}</p>
              {item.organization && (
                <p className="meta">
                  <strong>{item.organization}</strong>
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {item.url && (
                <a href={item.url} target="_blank" className="link">
                  Ver mais →
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
