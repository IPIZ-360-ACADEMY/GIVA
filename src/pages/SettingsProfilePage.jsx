import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAuthEnabled, updateUserAccountSettings } from "../services/authService.js";
import { supabase } from "../lib/supabase.js";

const BIO_MAX = 200;

const SOCIAL_FIELDS = [
  { key: "linkedinUrl", label: "LinkedIn", icon: "work", placeholder: "https://linkedin.com/in/utilizador" },
  { key: "githubUrl",   label: "GitHub",   icon: "code",  placeholder: "https://github.com/utilizador" },
  { key: "twitterUrl",  label: "Twitter/X", icon: "tag",  placeholder: "https://x.com/utilizador" },
  { key: "instagramUrl", label: "Instagram", icon: "photo_camera", placeholder: "https://instagram.com/utilizador" },
  { key: "facebookUrl", label: "Facebook", icon: "groups", placeholder: "https://facebook.com/utilizador" },
];

const PROFILE_COMPLETION_FIELDS = ["name", "jobTitle", "location", "website", "bio"];

export default function SettingsProfilePage() {
  const { showToast, t } = useOutletContext();
  const { user, userProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: "", bio: "",
    website: "",
    location: "", jobTitle: "",
    linkedinUrl: "", githubUrl: "", twitterUrl: "", instagramUrl: "", facebookUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata ?? {};
      setForm({
        name:        userProfile?.display_name || meta.display_name || meta.name || "",
        bio:         userProfile?.bio || "",
        website:     meta.website || "",
        location:    meta.location || "",
        jobTitle:    meta.job_title || "",
        linkedinUrl: meta.linkedin_url || "",
        githubUrl:   meta.github_url || "",
        twitterUrl:  meta.twitter_url || "",
        instagramUrl: meta.instagram_url || "",
        facebookUrl: meta.facebook_url || "",
      });
    } else {
      const raw = localStorage.getItem("giva.settings.profile.v2");
      if (raw) {
        try { setForm(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }
  }, [user, userProfile]);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("Foto máx. 5 MB", "error");
      return;
    }

    if (!user) {
      showToast("Necessário estar autenticado para fazer upload de foto", "error");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        showToast(`Erro ao carregar foto: ${uploadError.message}`, "error");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!data?.publicUrl) {
        showToast("Erro ao gerar URL da foto", "error");
        return;
      }

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);

      if (profileError) {
        showToast("Erro ao guardar foto no perfil", "error");
        return;
      }

      refreshProfile();
      showToast("Foto de perfil atualizada com sucesso", "success");
    } catch (err) {
      showToast(`Erro: ${err.message}`, "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const normalizedName = form.name.trim();

    if (isAuthEnabled() && user) {
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .update({
          display_name: normalizedName,
          bio: form.bio.trim() || null,
        })
        .eq("id", user.id);

      if (profileErr) {
        showToast("Erro ao guardar perfil.", "error");
        setSubmitting(false);
        return;
      }

      const { error: metaErr } = await updateUserAccountSettings({
        displayName: normalizedName,
        website: form.website.trim() || null,
        location: form.location.trim() || null,
        jobTitle: form.jobTitle.trim() || null,
        linkedinUrl: form.linkedinUrl.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        twitterUrl: form.twitterUrl.trim() || null,
        instagramUrl: form.instagramUrl.trim() || null,
        facebookUrl: form.facebookUrl.trim() || null,
      });

      if (metaErr) {
        showToast("Erro ao atualizar metadados.", "error");
        setSubmitting(false);
        return;
      }

      refreshProfile();
    } else {
      localStorage.setItem("giva.settings.profile.v2", JSON.stringify(form));
    }

    showToast(t("settings.profile.saved") || "Perfil guardado.");
    setSubmitting(false);
  }

  const bioLen = form.bio.length;
  const connectedSocials = useMemo(
    () => SOCIAL_FIELDS.filter(({ key }) => String(form[key] ?? "").trim()).length,
    [form]
  );
  const completionCount = useMemo(
    () => PROFILE_COMPLETION_FIELDS.filter((key) => String(form[key] ?? "").trim()).length,
    [form]
  );
  const completionRate = Math.round((completionCount / PROFILE_COMPLETION_FIELDS.length) * 100);

  return (
    <div className="settings-premium-shell settings-premium-shell--profile">
      <section className="form-card settings-hero-card settings-hero-card--profile">
        <div className="settings-hero-main">
          <div className="avatar-editor settings-hero-avatar-row">
            <div className="avatar-preview-wrap settings-hero-avatar-wrap">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="Avatar" className="avatar-preview-img" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              ) : (
                <span className="material-icons-sharp avatar-preview-placeholder">person</span>
              )}
            </div>
            <div className="avatar-editor-fields settings-hero-copy">
              <span className="settings-section-kicker">Perfil premium</span>
              <h3 className="settings-hero-title">Identidade, presença e canais públicos</h3>
              <p className="settings-hero-subtitle">
                Ajuste a forma como o seu perfil aparece na plataforma com uma apresentação mais completa, consistente e profissional.
              </p>
              <div className="settings-hero-chip-row">
                <span className="settings-hero-chip">{completionRate}% completo</span>
                <span className="settings-hero-chip">{connectedSocials} redes ligadas</span>
                {user?.email && <span className="settings-hero-chip settings-hero-chip--subtle">{user.email}</span>}
              </div>
              <div className="settings-hero-actions">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <span className="material-icons-sharp">upload_file</span>
                  {uploadingAvatar ? "A carregar..." : "Atualizar fotografia"}
                </button>
                <Link className="btn ghost" to="/config/conta">
                  Gerir email e telefone
                </Link>
              </div>
              <p className="form-hint">JPEG, PNG, WebP ou GIF. Máx. 5 MB.</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={uploadingAvatar}
          />
        </div>

        <div className="settings-hero-stats">
          <article className="settings-hero-stat">
            <span className="settings-hero-stat-label">Identidade pública</span>
            <strong>{form.name || "Sem nome definido"}</strong>
            <small>{form.jobTitle || "Cargo ou especialidade ainda não definido"}</small>
          </article>
          <article className="settings-hero-stat">
            <span className="settings-hero-stat-label">Localização</span>
            <strong>{form.location || "Por definir"}</strong>
            <small>{form.website || "Sem website associado"}</small>
          </article>
          <article className="settings-hero-stat">
            <span className="settings-hero-stat-label">Bio</span>
            <strong>{bioLen}/{BIO_MAX}</strong>
            <small>{bioLen > 0 ? "Resumo pessoal disponível" : "Adicione um resumo curto"}</small>
          </article>
        </div>
      </section>

      <form id="profile-form" className="settings-premium-stack" onSubmit={handleSubmit}>
        <section className="form-card settings-profile-card">
          <div className="settings-section-head">
            <div>
              <span className="settings-section-kicker">Identidade pública</span>
              <h3>Dados essenciais do perfil</h3>
            </div>
            <p className="settings-section-desc">
              Estes dados compõem a apresentação principal do seu perfil dentro da plataforma.
            </p>
          </div>

          <div className="settings-profile-grid">
            <div className="form-field">
              <label htmlFor="cfg-name">Nome de apresentação</label>
              <input
                id="cfg-name"
                value={form.name}
                maxLength={80}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="cfg-job-title">Cargo / especialidade</label>
              <input
                id="cfg-job-title"
                value={form.jobTitle}
                placeholder="Ex.: Designer gráfico, Gestor comercial"
                onChange={(e) => set("jobTitle", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="cfg-location">Localização</label>
              <input
                id="cfg-location"
                value={form.location}
                placeholder="Ex.: Luanda, Angola"
                onChange={(e) => set("location", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="cfg-website">Website / portfólio</label>
              <input
                id="cfg-website"
                type="url"
                value={form.website}
                placeholder="https://meusite.com"
                onChange={(e) => set("website", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="form-card settings-profile-card">
          <div className="settings-section-head">
            <div>
              <span className="settings-section-kicker">Narrativa</span>
              <h3>Biografia curta</h3>
            </div>
            <p className="settings-section-desc">
              Um resumo curto ajuda a contextualizar quem é e qual o foco da sua atuação.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="cfg-bio">
              Biografia
              <span className={`bio-counter${bioLen > BIO_MAX ? " over" : ""}`}>
                {bioLen}/{BIO_MAX}
              </span>
            </label>
            <textarea
              id="cfg-bio"
              rows={4}
              maxLength={BIO_MAX}
              value={form.bio}
              placeholder="Apresente-se em poucas palavras..."
              onChange={(e) => set("bio", e.target.value)}
            />
          </div>
        </section>

        <section className="form-card settings-profile-card">
          <div className="settings-section-head">
            <div>
              <span className="settings-section-kicker">Redes e presença digital</span>
              <h3>Perfis associados</h3>
            </div>
            <p className="settings-section-desc">
              Ligue os seus canais para reforçar credibilidade e facilitar contacto em contexto profissional.
            </p>
          </div>

          <div className="settings-social-grid">
            {SOCIAL_FIELDS.map(({ key, label, icon, placeholder }) => (
              <div className="form-field social-field" key={key}>
                <label htmlFor={`cfg-${key}`}>
                  <span className="material-icons-sharp social-field-icon">{icon}</span>
                  {label}
                </label>
                <input
                  id={`cfg-${key}`}
                  type="url"
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>
      </form>

      <div className="form-actions settings-premium-actions" style={{ paddingBottom: "1rem" }}>
        <button className="btn primary" form="profile-form" type="submit" disabled={submitting || bioLen > BIO_MAX}>
          {submitting ? "A guardar..." : (t("settings.profile.save") || "Guardar alterações")}
        </button>
      </div>
    </div>
  );
}
