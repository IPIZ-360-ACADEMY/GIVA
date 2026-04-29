import { useEffect, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { isAuthEnabled } from "../services/authService.js";
import { supabase } from "../lib/supabase.js";

const BIO_MAX = 200;

const SOCIAL_FIELDS = [
  { key: "linkedinUrl", label: "LinkedIn", icon: "work", placeholder: "https://linkedin.com/in/utilizador" },
  { key: "githubUrl",   label: "GitHub",   icon: "code",  placeholder: "https://github.com/utilizador" },
  { key: "twitterUrl",  label: "Twitter/X", icon: "tag",  placeholder: "https://x.com/utilizador" },
];

export default function SettingsProfilePage() {
  const { showToast, t } = useOutletContext();
  const { user, userProfile, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    name: "", bio: "", email: "", phone: "",
    website: "",
    linkedinUrl: "", githubUrl: "", twitterUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata ?? {};
      setForm({
        name:        userProfile?.display_name || meta.display_name || meta.name || "",
        bio:         userProfile?.bio || "",
        email:       user.email || "",
        phone:       meta.phone_number || "",
        website:     meta.website || "",
        linkedinUrl: meta.linkedin_url || "",
        githubUrl:   meta.github_url || "",
        twitterUrl:  meta.twitter_url || "",
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

    if (isAuthEnabled() && user) {
      // 1 — Atualizar user_profiles (display_name, bio)
      const { error: profileErr } = await supabase
        .from("user_profiles")
        .update({
          display_name: form.name.trim(),
          bio: form.bio.trim() || null,
        })
        .eq("id", user.id);

      if (profileErr) {
        showToast("Erro ao guardar perfil.", "error");
        setSubmitting(false);
        return;
      }

      // 2 — Atualizar auth metadata (phone, website, social links, etc.)
      const { error: metaErr } = await supabase.auth.updateUser({
        data: {
          display_name: form.name.trim(),
          phone_number:  form.phone.trim() || null,
          website:       form.website.trim() || null,
          linkedin_url:  form.linkedinUrl.trim() || null,
          github_url:    form.githubUrl.trim() || null,
          twitter_url:   form.twitterUrl.trim() || null,
        },
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Avatar + identidade visual */}
      <section className="form-card">
        <h3>Foto &amp; Identidade</h3>
        <div className="avatar-editor">
          <div className="avatar-preview-wrap">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt="Avatar" className="avatar-preview-img" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            ) : (
              <span className="material-icons-sharp avatar-preview-placeholder">person</span>
            )}
          </div>
          <div className="avatar-editor-fields">
            <label className="form-label-small">Carregar foto de perfil</label>
            <button
              type="button"
              className="btn secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              <span className="material-icons-sharp">upload_file</span>
              {uploadingAvatar ? "A carregar..." : "Escolher imagem"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
            <p className="form-hint">JPEG, PNG, WebP ou GIF. Máx. 5 MB.</p>
          </div>
        </div>
      </section>

      {/* Informações pessoais */}
      <section className="form-card">
        <h3>Informações Pessoais</h3>
        {user && (
          <p className="meta" style={{ marginBottom: "1rem", fontSize: "0.85rem", opacity: 0.7 }}>
            {t("settings.profile.loggedAs") || "Sessão ativa como"}: <strong>{user.email}</strong>
          </p>
        )}
        <form id="profile-form" onSubmit={handleSubmit}>
          <div className="form-grid">
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
              <label htmlFor="cfg-email">{t("settings.profile.email")}</label>
              <input
                id="cfg-email"
                type="email"
                value={form.email}
                disabled={Boolean(user)}
                title={user ? "Email gerido pelo Supabase Auth — altere na aba Segurança" : undefined}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="cfg-phone">{t("settings.profile.phone") || "Telefone"}</label>
              <input
                id="cfg-phone"
                type="tel"
                value={form.phone}
                placeholder="+244 9xx xxx xxx"
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="cfg-website">Website / Portfólio</label>
              <input
                id="cfg-website"
                type="url"
                value={form.website}
                placeholder="https://meusite.com"
                onChange={(e) => set("website", e.target.value)}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="form-field" style={{ marginTop: "1rem" }}>
            <label htmlFor="cfg-bio">
              Biografia
              <span className={`bio-counter${bioLen > BIO_MAX ? " over" : ""}`}>
                {bioLen}/{BIO_MAX}
              </span>
            </label>
            <textarea
              id="cfg-bio"
              rows={3}
              maxLength={BIO_MAX}
              value={form.bio}
              placeholder="Apresente-se em poucas palavras…"
              onChange={(e) => set("bio", e.target.value)}
            />
          </div>
        </form>
      </section>

      {/* Redes sociais */}
      <section className="form-card">
        <h3>Redes Sociais</h3>
        <div className="form-grid">
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

      {/* Botão guardar global */}
      <div className="form-actions" style={{ paddingBottom: "1rem" }}>
        <button className="btn primary" form="profile-form" type="submit" disabled={submitting || bioLen > BIO_MAX}>
          {submitting ? "A guardar…" : (t("settings.profile.save") || "Guardar alterações")}
        </button>
      </div>
    </div>
  );
}
