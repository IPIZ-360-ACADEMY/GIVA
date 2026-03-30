import { useEffect, useRef, useState } from "react";

const SECTOR_KEYS = ["tech", "telecom", "industry", "health"];

const AREA_KEYS = [
  "software",
  "hardware",
  "networks",
  "telecom",
  "energy",
  "manufacturing",
  "health",
  "finance",
  "education",
  "logistics",
  "construction",
  "media",
];

const INITIAL_FORM = {
  empresa: "",
  nif: "",
  setor: "tech",
  areas: [],
  vagas: "",
  sla: "",
  endereco: "",
  telefone: "",
  email: "",
  website: "",
  responsavel: "",
  photoPreview: null,
};

export default function PartnerRegisterModal({
  onClose,
  onSave,
  showToast,
  t,
  mode = "create",
  initialData = null,
}) {
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, ...(initialData ?? {}) }));
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm({ ...INITIAL_FORM, ...(initialData ?? {}) });
  }, [initialData]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast(t("partners.toast.largePhoto"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setForm((f) => ({ ...f, photoPreview: e.target.result }));
    reader.readAsDataURL(file);
  }

  function toggleArea(area) {
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(area)
        ? f.areas.filter((a) => a !== area)
        : [...f.areas, area],
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!form.empresa.trim()) {
      showToast(t("partners.toast.missingCompany"), "error");
      return;
    }
    if (!form.nif.trim()) {
      showToast(t("partners.toast.missingNif"), "error");
      return;
    }
    onSave({ ...form });
    showToast(mode === "edit" ? t("partners.toast.updated") : t("partners.toast.saved"));
    onClose();
  }

  return (
    <>
      <div className="pmodal-overlay" onClick={onClose} aria-hidden="true" />

      <div
        className="pmodal"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "edit" ? t("partners.modal.editTitle") : t("partners.modal.title")}
      >
        <div className="pmodal-header">
          <span className="material-icons-sharp pmodal-icon" aria-hidden="true">
            apartment
          </span>
          <h3>{mode === "edit" ? t("partners.modal.editTitle") : t("partners.modal.title")}</h3>
          <button
            className="smodal-close"
            type="button"
            onClick={onClose}
            aria-label={t("partners.cancel")}
          >
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <div className="pmodal-body">
          <form id="partner-register-form" onSubmit={handleSubmit}>

            <section className="pmodal-section">
              <h4 className="pmodal-section-title">
                <span className="material-icons-sharp" aria-hidden="true">badge</span>
                {t("partners.section.identity")}
              </h4>

              <div className="pmodal-photo-row">
                <div
                  className="pmodal-photo-thumb"
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label={t("partners.photo")}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                >
                  {form.photoPreview ? (
                    <img src={form.photoPreview} alt="" className="pmodal-photo-img" />
                  ) : (
                    <span className="material-icons-sharp pmodal-photo-placeholder">add_photo_alternate</span>
                  )}
                </div>
                <div className="pmodal-photo-meta">
                  <strong>{t("partners.photo")}</strong>
                  <p className="meta">{t("partners.photoHint")}</p>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t("partners.photoSelect")}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={handlePhoto}
                />
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="pr-empresa">{t("common.company")} *</label>
                  <input
                    id="pr-empresa"
                    required
                    value={form.empresa}
                    placeholder="Ex: Novasoft Angola"
                    onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pr-nif">{t("partners.nif")} *</label>
                  <input
                    id="pr-nif"
                    required
                    value={form.nif}
                    placeholder={t("partners.nifPlaceholder")}
                    onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pr-responsavel">{t("partners.contact")}</label>
                  <input
                    id="pr-responsavel"
                    value={form.responsavel}
                    placeholder={t("partners.contactPlaceholder")}
                    onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="pmodal-section">
              <h4 className="pmodal-section-title">
                <span className="material-icons-sharp" aria-hidden="true">contacts</span>
                {t("partners.section.contact")}
              </h4>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="pr-telefone">{t("partners.phone")}</label>
                  <input
                    id="pr-telefone"
                    type="tel"
                    value={form.telefone}
                    placeholder="+244 9XX XXX XXX"
                    onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pr-email">{t("partners.partnerEmail")}</label>
                  <input
                    id="pr-email"
                    type="email"
                    value={form.email}
                    placeholder="geral@empresa.ao"
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pr-website">{t("partners.website")}</label>
                  <input
                    id="pr-website"
                    type="url"
                    value={form.website}
                    placeholder="https://empresa.ao"
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  />
                </div>

                <div className="form-field pmodal-full">
                  <label htmlFor="pr-endereco">{t("partners.address")}</label>
                  <input
                    id="pr-endereco"
                    value={form.endereco}
                    placeholder="Rua, bairro, cidade"
                    onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="pmodal-section">
              <h4 className="pmodal-section-title">
                <span className="material-icons-sharp" aria-hidden="true">work</span>
                {t("partners.section.activity")}
              </h4>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="pr-setor">{t("partners.sector")}</label>
                  <select
                    id="pr-setor"
                    value={form.setor}
                    onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))}
                  >
                    {SECTOR_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`partners.sector.${key}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="pr-vagas">{t("partners.slots")}</label>
                  <input
                    id="pr-vagas"
                    type="number"
                    min="0"
                    value={form.vagas}
                    placeholder="0"
                    onChange={(e) => setForm((f) => ({ ...f, vagas: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pr-sla">{t("partners.performance")}</label>
                  <input
                    id="pr-sla"
                    value={form.sla}
                    placeholder="95%"
                    onChange={(e) => setForm((f) => ({ ...f, sla: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-field pmodal-full">
                <label>{t("partners.areas")}</label>
                <div className="partner-areas-grid" role="group" aria-label={t("partners.areas")}>
                  {AREA_KEYS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className={`partner-area-tag ${form.areas.includes(area) ? "active" : ""}`}
                      aria-pressed={form.areas.includes(area)}
                      onClick={() => toggleArea(area)}
                    >
                      {t(`partners.areas.${area}`)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

          </form>
        </div>

        <div className="pmodal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t("partners.cancel")}
          </button>
          <button className="btn primary" type="submit" form="partner-register-form">
            {mode === "edit" ? t("partners.update") : t("partners.register")}
          </button>
        </div>
      </div>
    </>
  );
}
