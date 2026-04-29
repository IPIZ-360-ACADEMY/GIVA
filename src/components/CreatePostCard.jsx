import { useRef, useState } from "react";
import { createPost, createPollPost } from "../services/postsService.js";
import { useAuth } from "../contexts/AuthContext.jsx";

function Avatar({ url, name, size = 40 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  return url ? (
    <img src={url} alt={name} className="post-avatar" style={{ width: size, height: size }} />
  ) : (
    <div className="post-avatar post-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initials}
    </div>
  );
}

const MODES = [
  { id: "text",  icon: "article",   label: "Publicação" },
  { id: "photo", icon: "image",     label: "Foto" },
  { id: "poll",  icon: "poll",      label: "Sondagem" },
  { id: "event", icon: "event",     label: "Evento" },
  { id: "file",  icon: "attach_file", label: "Ficheiro" },
];

export default function CreatePostCard({ onCreated }) {
  const { userProfile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState("text");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  function handleExpand(nextMode = "text") {
    const normalizedMode = ["text", "photo", "poll"].includes(nextMode) ? nextMode : "text";
    setMode(normalizedMode);
    setExpanded(true);
    if (normalizedMode === "photo") {
      setTimeout(() => fileRef.current?.click(), 80);
    } else {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Imagem máx. 5 MB"); return; }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    setExpanded(true);
  }

  function removeImage() {
    setImageFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleCancel() {
    setExpanded(false);
    setContent("");
    setError("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    removeImage();
  }

  function updatePollOption(idx, value) {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addPollOption() {
    if (pollOptions.length >= 4) return;
    setPollOptions((prev) => [...prev, ""]);
  }

  function removePollOption(idx) {
    if (pollOptions.length <= 2) return;
    setPollOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!content.trim()) { setError("Escreve algo antes de publicar"); return; }
    setSubmitting(true);
    setError("");
    try {
      let post;
      if (mode === "poll") {
        const validOptions = pollOptions.filter((o) => o.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) {
          setError("Sondagem requer uma pergunta e pelo menos 2 opções");
          setSubmitting(false);
          return;
        }
        post = await createPollPost(content.trim(), pollQuestion.trim(), validOptions, pollDuration);
      } else {
        post = await createPost(content.trim(), imageFile);
      }
      setContent("");
      setPollQuestion("");
      setPollOptions(["", ""]);
      removeImage();
      setExpanded(false);
      onCreated?.(post);
    } catch (err) {
      setError(err.message ?? "Erro ao publicar");
    }
    setSubmitting(false);
  }

  const firstName = (userProfile?.display_name ?? "").split(" ")[0] || "colega";

  return (
    <div className="create-post-card">
      <div className="create-post-top">
        <Avatar url={userProfile?.avatar_url} name={userProfile?.display_name} />

        {!expanded ? (
          <button type="button" className="create-post-trigger" onClick={() => handleExpand("text")}>
            O que queres partilhar, {firstName}?
          </button>
        ) : (
          <form className="create-post-form" onSubmit={handleSubmit}>
            {/* Seletor de modo */}
            <div className="create-post-modes">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`create-mode-btn${mode === m.id ? " active" : ""}`}
                  onClick={() => setMode(m.id)}
                >
                  <span className="material-icons-sharp">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              placeholder={
                mode === "poll"
                  ? "Introdução ou contexto da sondagem (opcional)..."
                  : "Partilha algo com a comunidade IPIZ..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={3000}
            />

            {/* Modo Foto */}
            {mode === "photo" && (
              <>
                {preview ? (
                  <div className="create-post-preview">
                    <img src={preview} alt="pré-visualização" />
                    <button type="button" className="remove-img-btn" onClick={removeImage} aria-label="Remover imagem">
                      <span className="material-icons-sharp">close</span>
                    </button>
                  </div>
                ) : (
                  <button type="button" className="create-photo-drop" onClick={() => fileRef.current?.click()}>
                    <span className="material-icons-sharp">add_photo_alternate</span>
                    <span>Clica para adicionar foto</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
              </>
            )}

            {/* Modo Sondagem */}
            {mode === "poll" && (
              <div className="create-poll-builder">
                <input
                  type="text"
                  className="create-poll-question"
                  placeholder="Pergunta da sondagem..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  maxLength={200}
                />
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="create-poll-option-row">
                    <input
                      type="text"
                      placeholder={`Opção ${idx + 1}`}
                      value={opt}
                      onChange={(e) => updatePollOption(idx, e.target.value)}
                      maxLength={80}
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" className="create-poll-remove" onClick={() => removePollOption(idx)} aria-label="Remover opção">
                        <span className="material-icons-sharp">close</span>
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button type="button" className="create-poll-add" onClick={addPollOption}>
                    <span className="material-icons-sharp">add</span>
                    Adicionar opção
                  </button>
                )}
                <div className="create-poll-duration">
                  <span className="material-icons-sharp">schedule</span>
                  <label>Duração:</label>
                  <select value={pollDuration} onChange={(e) => setPollDuration(Number(e.target.value))}>
                    <option value={6}>6 horas</option>
                    <option value={24}>1 dia</option>
                    <option value={72}>3 dias</option>
                    <option value={168}>1 semana</option>
                  </select>
                </div>
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <div className="create-post-actions">
              {mode === "photo" && !preview && (
                <>
                  <button type="button" className="create-post-media-btn" onClick={() => fileRef.current?.click()}>
                    <span className="material-icons-sharp">image</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
                </>
              )}
              <div style={{ flex: 1 }} />
              <button type="button" className="btn ghost sm" onClick={handleCancel}>Cancelar</button>
              <button type="submit" className="btn primary sm" disabled={submitting || !content.trim()}>
                {submitting ? "A publicar..." : "Publicar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {!expanded && (
        <div className="create-post-shortcuts premium-create-shortcuts">
          <button type="button" className="create-post-shortcut" onClick={() => handleExpand("photo")}>
            <span className="material-icons-sharp">image</span>
            <span>Foto</span>
          </button>
          <button type="button" className="create-post-shortcut" onClick={() => handleExpand("poll")}>
            <span className="material-icons-sharp">poll</span>
            <span>Sondagem</span>
          </button>
          <button type="button" className="create-post-shortcut" onClick={() => handleExpand("text")}>
            <span className="material-icons-sharp">article</span>
            <span>Artigo</span>
          </button>
          <button type="button" className="create-post-shortcut" onClick={() => handleExpand("event")}>
            <span className="material-icons-sharp">event</span>
            <span>Evento</span>
          </button>
          <button type="button" className="create-post-shortcut" onClick={() => handleExpand("file")}>
            <span className="material-icons-sharp">attach_file</span>
            <span>Ficheiro</span>
          </button>
        </div>
      )}
    </div>
  );
}
