import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function DocumentSubmitModal({
  mode = "create",
  form,
  selectedFile,
  submitting,
  onClose,
  onSubmit,
  onFormChange,
  onFileChange,
  classOptions = [],
  partnerOptions = [],
  t,
}) {
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const modalTitle = mode === "edit" ? t("docModal.titleEdit") : t("docModal.titleCreate");

  function handleFolderPathChange(rawValue) {
    const normalized = String(rawValue ?? "")
      .split(/[\\/]+/)
      .map((segment) => String(segment ?? "").trim())
      .filter(Boolean)
      .join("/");

    const segments = normalized.split("/").filter(Boolean);
    onFormChange({
      folderPath: normalized,
      folderName: segments[0] ?? "",
      subfolderName: segments[1] ?? "",
    });
  }

  return createPortal(
    <div className="pmodal-layer" role="presentation">
      <div className="pmodal-overlay" onClick={onClose} aria-hidden="true" />

      <div className="pmodal" role="dialog" aria-modal="true" aria-label={modalTitle}>
        <div className="pmodal-header">
          <span className="material-icons-sharp pmodal-icon" aria-hidden="true">
            description
          </span>
          <h3>{modalTitle}</h3>
          <button className="smodal-close" type="button" onClick={onClose} aria-label={t("docModal.close")}>
            <span className="material-icons-sharp">close</span>
          </button>
        </div>

        <div className="pmodal-body">
          <form id="document-submit-form" onSubmit={onSubmit}>
            <section className="pmodal-section">
              <h4 className="pmodal-section-title">
                <span className="material-icons-sharp" aria-hidden="true">edit_note</span>
                {t("docModal.section.data")}
              </h4>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="doc-title">{t("docModal.label.title")}</label>
                  <input
                    id="doc-title"
                    value={form.titulo}
                    onChange={(event) => onFormChange({ titulo: event.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="doc-type">{t("docModal.label.type")}</label>
                  <select
                    id="doc-type"
                    value={form.tipo}
                    onChange={(event) => onFormChange({ tipo: event.target.value })}
                  >
                    <option>PDF</option>
                    <option>DOCX</option>
                    <option>XLSX</option>
                    <option>PPTX</option>
                    <option>CSV</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="doc-version">{t("docModal.label.version")}</label>
                  <input
                    id="doc-version"
                    value={form.versao}
                    onChange={(event) => onFormChange({ versao: event.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="doc-category">{t("docModal.label.category")}</label>
                  <input
                    id="doc-category"
                    value={form.categoria}
                    onChange={(event) => onFormChange({ categoria: event.target.value })}
                  />
                </div>

                <div className="form-field pmodal-full">
                  <label htmlFor="doc-file-url">{t("docModal.label.fileUrl")}</label>
                  <input
                    id="doc-file-url"
                    type="url"
                    value={form.arquivoUrl}
                    onChange={(event) => onFormChange({ arquivoUrl: event.target.value })}
                  />
                </div>

                <div className="form-field pmodal-full">
                  <label htmlFor="doc-file">{t("docModal.label.upload")}</label>
                  <input
                    ref={fileInputRef}
                    id="doc-file"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      onFileChange(file);
                    }}
                  />
                  {selectedFile ? (
                    <small className="meta">
                      {t("docModal.fileSelected").replace("{name}", selectedFile.name)}
                    </small>
                  ) : null}
                </div>

                <div className="form-field pmodal-full">
                  <label htmlFor="doc-description">{t("docModal.label.description")}</label>
                  <input
                    id="doc-description"
                    value={form.descricao}
                    onChange={(event) => onFormChange({ descricao: event.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="doc-folder-path">Caminho da pasta</label>
                  <input
                    id="doc-folder-path"
                    value={form.folderPath ?? ""}
                    placeholder="Ex: contratos/2026/fornecedores"
                    onChange={(event) => handleFolderPathChange(event.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="doc-context-type">Escopo</label>
                  <select
                    id="doc-context-type"
                    value={form.contextType ?? "general"}
                    onChange={(event) => {
                      const nextType = event.target.value;
                      onFormChange({
                        contextType: nextType,
                        classGroupId: nextType === "class" ? form.classGroupId ?? "" : "",
                        partnerId: nextType === "company" ? form.partnerId ?? "" : "",
                      });
                    }}
                  >
                    <option value="general">Geral</option>
                    <option value="class">Turma</option>
                    <option value="company">Empresa</option>
                  </select>
                </div>

                {form.contextType === "class" ? (
                  <div className="form-field">
                    <label htmlFor="doc-class-group-id">Turma</label>
                    <select
                      id="doc-class-group-id"
                      value={form.classGroupId ?? ""}
                      onChange={(event) => onFormChange({ classGroupId: event.target.value })}
                    >
                      <option value="">Selecionar turma...</option>
                      {classOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {`${item.turma || "Turma"} ${item.curso ? `- ${item.curso}` : ""} ${item.anoLetivo ? `(${item.anoLetivo})` : ""}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {form.contextType === "company" ? (
                  <div className="form-field">
                    <label htmlFor="doc-partner-id">Empresa</label>
                    <select
                      id="doc-partner-id"
                      value={form.partnerId ?? ""}
                      onChange={(event) => onFormChange({ partnerId: event.target.value })}
                    >
                      <option value="">Selecionar empresa...</option>
                      {partnerOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.empresa || "Empresa sem nome"}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="form-field pmodal-full">
                  <label htmlFor="doc-pinned">Prioridade</label>
                  <select
                    id="doc-pinned"
                    value={form.isPinned ? "yes" : "no"}
                    onChange={(event) => onFormChange({ isPinned: event.target.value === "yes" })}
                  >
                    <option value="no">Normal</option>
                    <option value="yes">Fixado (aparece primeiro)</option>
                  </select>
                </div>
              </div>
            </section>
          </form>
        </div>

        <div className="pmodal-footer">
          <button className="btn ghost" type="button" onClick={onClose}>
            {t("docModal.cancel")}
          </button>
          <button className="btn primary" type="submit" form="document-submit-form" disabled={submitting}>
            {submitting
              ? t("docModal.processing")
              : mode === "edit"
              ? t("docModal.update")
              : t("docModal.submit")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
