import { useState } from "react";
import { useOutletContext } from "react-router-dom";

function readStoredProfile() {
  const fallback = {
    nome: "Coordenacao IPIZ",
    email: "coordenacao@giva.ipiz.ao",
    telefone: "+244 923 000 000"
  };

  const raw = localStorage.getItem("giva.settings.profile");
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      nome: typeof parsed.nome === "string" && parsed.nome.trim() ? parsed.nome : fallback.nome,
      email: typeof parsed.email === "string" && parsed.email.trim() ? parsed.email : fallback.email,
      telefone: typeof parsed.telefone === "string" && parsed.telefone.trim() ? parsed.telefone : fallback.telefone
    };
  } catch {
    return fallback;
  }
}

export default function SettingsProfilePage() {
  const { showToast, t } = useOutletContext();
  const [form, setForm] = useState(readStoredProfile);

  function submitSettings(event) {
    event.preventDefault();
    localStorage.setItem("giva.settings.profile", JSON.stringify(form));
    showToast(t("settings.profile.saved"));
  }

  return (
    <section className="form-card">
      <h3>{t("settings.profile.title")}</h3>
      <form onSubmit={submitSettings}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="cfg-name">{t("settings.profile.name")}</label>
            <input id="cfg-name" value={form.nome} onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))} />
          </div>

          <div className="form-field">
            <label htmlFor="cfg-email">{t("settings.profile.email")}</label>
            <input
              id="cfg-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>

          <div className="form-field">
            <label htmlFor="cfg-phone">{t("settings.profile.phone")}</label>
            <input id="cfg-phone" value={form.telefone} onChange={(event) => setForm((prev) => ({ ...prev, telefone: event.target.value }))} />
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" type="submit">
            {t("settings.profile.save")}
          </button>
        </div>
      </form>
    </section>
  );
}
