import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addComment, getComments, getPublicPostUrl, toggleBookmark, votePoll, deletePost, updatePost } from "../services/postsService.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { sanitizeAssetUrl } from "../utils/urlSafety.js";
import styled from "@emotion/styled";

const GlassCard = styled.article`
  background: rgba(255,255,255,0.96);
  backdrop-filter: blur(8px) saturate(1.05);
  border-radius: 1.1rem;
  border: 1px solid rgba(200,200,220,0.13);
  box-shadow: 0 2px 8px 0 rgba(60,60,120,0.06);
  transition: box-shadow 0.18s cubic-bezier(.4,0,.2,1), transform 0.14s cubic-bezier(.4,0,.2,1);
  margin-bottom: 0.75rem;
  overflow: hidden;
  position: relative;
  &:hover {
    box-shadow: 0 4px 16px 0 rgba(60,60,120,0.10);
    transform: translateY(-1px) scale(1.004);
  }
  @media (max-width: 700px) {
    border-radius: 0.7rem;
  }
`;

const AnimatedBar = styled.div`
  height: 4px;
  width: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%);
  opacity: 0.13;
  position: absolute;
  top: 0;
  left: 0;
  animation: bar-move 3.5s linear infinite alternate;
  @keyframes bar-move {
    0% { opacity: 0.13; }
    100% { opacity: 0.28; }
  }
`;

const REACTIONS = [
  { type: "adoro",    emoji: "❤️",  label: "Adoro" },
  { type: "aplausos", emoji: "👏",  label: "Aplausos" },
  { type: "riso",     emoji: "😄",  label: "Riso" },
  { type: "apoio",    emoji: "🤝",  label: "Apoio" },
];

const TYPE_LABELS = {
  student:  "Estudante",
  company:  "Empresa",
  admin:    "Equipa IPIZ",
  external: "Visitante",
};

/**
 * Menu de ações para o dono do post (eliminar).
 */
function PostActionsMenu({ postId, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Tem a certeza que pretende eliminar esta publicação?")) return;
    setDeleting(true);
    try {
      await deletePost(postId);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      console.error("Erro ao eliminar post:", err);
      alert("Erro ao eliminar: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => setOpen(!open)}
        title="Opções"
        aria-label="Opções do post"
      >
        <span className="material-icons-sharp">more_vert</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            zIndex: 100,
            minWidth: "160px",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              display: "block",
              width: "100%",
              padding: "0.75rem 1rem",
              border: "none",
              background: "none",
              cursor: deleting ? "not-allowed" : "pointer",
              textAlign: "left",
              color: "var(--danger, #dc2626)",
              fontSize: "0.85rem",
              fontWeight: 500,
              transition: "background-color 0.2s",
              opacity: deleting ? 0.6 : 1,
            }}
            onMouseEnter={(e) => !deleting && (e.currentTarget.style.backgroundColor = "var(--surface)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <span className="material-icons-sharp" style={{ fontSize: "0.9rem", marginRight: "0.5rem", verticalAlign: "middle" }}>
              delete
            </span>
            {deleting ? "A eliminar..." : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ url, name, size = 44 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  const safeUrl = sanitizeAssetUrl(url);
  return safeUrl ? (
    <img src={safeUrl} alt={name} className="post-avatar" style={{ width: size, height: size }} />
  ) : (
    <div className="post-avatar post-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initials}
    </div>
  );
}

function ReactionBar({ postId, reactions = [], onToggle, readOnly = false }) {
  const { user } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  const counts = REACTIONS.map((r) => ({
    ...r,
    count: reactions.filter((rx) => rx.type === r.type).length,
    active: reactions.some((rx) => rx.type === r.type && rx.user_id === user?.id),
  }));
  const myReaction = REACTIONS.find((r) => reactions.some((rx) => rx.user_id === user?.id && rx.type === r.type));
  const totalCount = reactions.length;

  return (
    <div className="post-action-bar">
      {totalCount > 0 && (
        <div className="post-reaction-summary">
          {counts.filter((c) => c.count > 0).map((c) => (
            <span key={c.type} className={`post-reaction-pill${c.active ? " active" : ""}`}>
              {c.emoji} {c.count}
            </span>
          ))}
        </div>
      )}
      <div className="post-action-buttons">
        <div className="post-action-wrap" onMouseLeave={() => setShowPicker(false)}>
          <button
            type="button"
            className={`post-action-btn${myReaction ? " reacted" : ""}`}
            onMouseEnter={() => setShowPicker(true)}
            onClick={() => onToggle(myReaction?.type ?? "adoro")}
            disabled={readOnly}
          >
            <span className="material-icons-sharp">{myReaction ? "favorite" : "favorite_border"}</span>
            <span>{myReaction ? myReaction.label : "Reagir"}</span>
          </button>
          {showPicker && (
            <div className="post-reaction-picker">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  className={`reaction-pick-btn${counts.find((c) => c.type === r.type)?.active ? " active" : ""}`}
                  onClick={() => { onToggle(r.type); setShowPicker(false); }}
                  title={r.label}
                  disabled={readOnly}
                >
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PollSection({ poll }) {
  const { user } = useAuth();
  const [localVotes, setLocalVotes] = useState(poll?.votes ?? []);
  const [voting, setVoting] = useState(false);
  const [pollError, setPollError] = useState("");

  if (!poll) return null;

  let options = [];
  if (Array.isArray(poll.options)) {
    options = poll.options;
  } else if (typeof poll.options === "string") {
    try {
      const parsed = JSON.parse(poll.options);
      options = Array.isArray(parsed) ? parsed : [];
    } catch {
      options = [];
    }
  }

  const totalVotes = localVotes.length;
  const myVote = localVotes.find((v) => v.user_id === user?.id);
  const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
  const showResults = Boolean(myVote) || isExpired;

  async function handleVote(idx) {
    if (!user || voting || showResults) return;
    setVoting(true);
    try {
      await votePoll(poll.id, idx);
      setLocalVotes((prev) => {
        const without = prev.filter((v) => v.user_id !== user.id);
        return [...without, { user_id: user.id, option_idx: idx }];
      });
      setPollError("");
    } catch (err) {
      setPollError(err?.message ?? "Não foi possível registar o voto na sondagem.");
    }
    setVoting(false);
  }

  return (
    <div className="post-poll">
      <p className="post-poll-question">{poll.question}</p>
      <div className="post-poll-options">
        {options.map((opt, idx) => {
          const voteCount = localVotes.filter((v) => v.option_idx === idx).length;
          const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isMine = myVote?.option_idx === idx;
          return (
            <button
              key={idx}
              type="button"
              className={`post-poll-option${isMine ? " voted" : ""}${showResults ? " revealed" : ""}`}
              onClick={() => handleVote(idx)}
              disabled={showResults || voting || !user}
            >
              <div className="post-poll-bar" style={{ width: showResults ? `${pct}%` : "0%" }} />
              <span className="post-poll-label">{opt}</span>
              {showResults && <span className="post-poll-pct">{pct}%</span>}
              {isMine && <span className="material-icons-sharp post-poll-check">check_circle</span>}
            </button>
          );
        })}
      </div>
      <p className="post-poll-meta">
        {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        {isExpired ? " · Sondagem encerrada" : poll.ends_at ? ` · Termina ${new Date(poll.ends_at).toLocaleDateString("pt-PT")}` : ""}
      </p>
      {pollError && <p className="form-error" role="alert">{pollError}</p>}
    </div>
  );
}

function CommentSection({ postId, commentsCount, sharesCount, onShare, compact = false, readOnly = false }) {
  const { user, userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  async function load() {
    if (loaded) { setOpen((v) => !v); return; }
    try {
      const data = await getComments(postId);
      setComments(data);
      setLoaded(true);
      setOpen(true);
      setCommentError("");
    } catch (err) {
      setCommentError(err?.message ?? "Não foi possível carregar os comentários.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (readOnly || !text.trim() || !user) return;
    setSubmitting(true);
    try {
      const comment = await addComment(postId, text.trim(), replyTo?.id ?? null);
      setComments((prev) => [...prev, { ...comment, parent_id: replyTo?.id ?? null }]);
      setText("");
      setReplyTo(null);
      setCommentError("");
    } catch (err) {
      setCommentError(err?.message ?? "Não foi possível publicar o comentário.");
    }
    setSubmitting(false);
  }

  const count = loaded ? comments.length : commentsCount;
  const topLevel = comments.filter((c) => !c.parent_id);
  const getReplies = (id) => comments.filter((c) => c.parent_id === id);

  if (compact) {
    return (
      <>
        {(count > 0 || sharesCount > 0) && (
          <div className="post-stats-bar post-stats-bar-compact">
            {count > 0 && <span className="post-stats-item">{count} comentário{count !== 1 ? "s" : ""}</span>}
            {sharesCount > 0 && <span className="post-stats-item">{sharesCount} partilha{sharesCount !== 1 ? "s" : ""}</span>}
          </div>
        )}
      </>
    );
  }

  if (readOnly) {
    return (
      <>
        {(count > 0 || sharesCount > 0) && (
          <div className="post-stats-bar">
            {count > 0 && <span className="post-stats-item">{count} comentário{count !== 1 ? "s" : ""}</span>}
            {sharesCount > 0 && <span className="post-stats-item">{sharesCount} partilha{sharesCount !== 1 ? "s" : ""}</span>}
          </div>
        )}
        <div className="post-action-divider" />
        <p className="meta" style={{ padding: "0.75rem 0 0" }}>
          Modo leitura: interações indisponíveis para este perfil.
        </p>
      </>
    );
  }

  return (
    <>
      {(count > 0 || sharesCount > 0) && (
        <div className="post-stats-bar">
          {count > 0 && <span className="post-stats-item">{count} comentário{count !== 1 ? "s" : ""}</span>}
          {sharesCount > 0 && <span className="post-stats-item">{sharesCount} partilha{sharesCount !== 1 ? "s" : ""}</span>}
        </div>
      )}
      <div className="post-action-divider" />
      <div className="post-bottom-actions">
        <button type="button" className={`post-bottom-btn${open ? " active" : ""}`} onClick={load}>
          <span className="material-icons-sharp">chat_bubble_outline</span>
          <span>Comentar</span>
        </button>
        {onShare && (
          <button type="button" className="post-bottom-btn" onClick={onShare}>
            <span className="material-icons-sharp">share</span>
            <span>Partilhar</span>
          </button>
        )}
      </div>

      {open && (
        <div className="post-comments">
          {commentError && <p className="form-error" role="alert">{commentError}</p>}
          {topLevel.map((c) => {
            const replies = getReplies(c.id);
            return (
              <div key={c.id} className="post-comment">
                <div className="post-comment-avatar">
                  {sanitizeAssetUrl(c.author?.avatar_url)
                    ? <img src={sanitizeAssetUrl(c.author?.avatar_url)} alt={c.author.display_name} />
                    : <span>{(c.author?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="post-comment-body">
                  <strong>{c.author?.display_name ?? "Utilizador"}</strong>
                  <p>{c.content}</p>
                  <button
                    type="button"
                    className="post-comment-reply-btn"
                    onClick={() => setReplyTo({ id: c.id, name: c.author?.display_name ?? "Utilizador" })}
                  >
                    Responder
                  </button>
                  {replies.map((r) => (
                    <div key={r.id} className="post-comment post-comment-reply">
                      <div className="post-comment-avatar sm">
                        {sanitizeAssetUrl(r.author?.avatar_url)
                          ? <img src={sanitizeAssetUrl(r.author?.avatar_url)} alt={r.author.display_name} />
                          : <span>{(r.author?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="post-comment-body">
                        <strong>{r.author?.display_name ?? "Utilizador"}</strong>
                        <p>{r.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {user && (
            <form className="post-comment-form" onSubmit={handleSubmit}>
              <div className="post-comment-avatar self">
                {sanitizeAssetUrl(userProfile?.avatar_url)
                  ? <img src={sanitizeAssetUrl(userProfile?.avatar_url)} alt={userProfile.display_name} />
                  : <span>{(userProfile?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="post-comment-input-wrap">
                {replyTo && (
                  <div className="post-comment-reply-indicator">
                    <span className="material-icons-sharp">reply</span>
                    A responder a <strong>{replyTo.name}</strong>
                    <button type="button" onClick={() => setReplyTo(null)}>
                      <span className="material-icons-sharp">close</span>
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  placeholder={replyTo ? `Responder a ${replyTo.name}...` : "Adiciona um comentário..."}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                />
              </div>
              <button type="submit" disabled={submitting || !text.trim()} className="btn primary sm post-comment-send">
                <span className="material-icons-sharp">send</span>
              </button>
            </form>
          )}
        </div>
      )}
    </>
  );
}

export default function PostCard({ post, onReaction, onShare, isBookmarked = false, onBookmark, compact = false, getAdjacentImagePost = null, readOnly = false, onDeleted }) {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [bookmarking, setBookmarking] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [activeImagePost, setActiveImagePost] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [touchStartX, setTouchStartX] = useState(null);
  const author = post.author ?? {};
  const reactions = post.reactions ?? [];
  const commentsCount = post.comments_count?.[0]?.count ?? 0;
  const sharesCount = post.shares_count?.[0]?.count ?? 0;
  const poll = Array.isArray(post.poll) ? post.poll[0] : post.poll;
  const safePostImageUrl = sanitizeAssetUrl(post.image_url);
  const summarizedContent = post.content?.length > 220 ? `${post.content.slice(0, 220).trim()}...` : post.content;
  const myReaction = reactions.find((reaction) => reaction.user_id === user?.id);
  const hasReaction = Boolean(myReaction);
  const reactionsCount = reactions.length;
  const showCompactCaptionBelow = compact && safePostImageUrl;
  const shareUrl = useMemo(() => getPublicPostUrl(post.id), [post.id]);
  const shareText = `${author.display_name ?? "Membro da comunidade"}: ${summarizedContent ?? "Veja esta publicação."}`;

  function formatTimeAgo(createdAt) {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora mesmo";
    if (mins < 60) return `há ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days}d`;
    return new Date(createdAt).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
  }

  const timeAgo = formatTimeAgo(post.created_at);

  const modalPost = activeImagePost ?? post;
  const modalAuthor = modalPost.author ?? {};
  const modalImageUrl = sanitizeAssetUrl(modalPost.image_url);
  const modalReactionsCount = modalPost.reactions?.length ?? 0;
  const modalCommentsCount = modalPost.comments_count?.[0]?.count ?? 0;
  const modalSharesCount = modalPost.shares_count?.[0]?.count ?? 0;
  const modalTimeAgo = formatTimeAgo(modalPost.created_at);
  const prevImagePost = getAdjacentImagePost?.(modalPost.id, -1) ?? null;
  const nextImagePost = getAdjacentImagePost?.(modalPost.id, 1) ?? null;

  async function handleBookmark() {
    if (!user || bookmarking || readOnly) return;
    setBookmarking(true);
    try {
      const added = await toggleBookmark(post.id);
      setBookmarked(added);
      onBookmark?.(post.id, added);
    } catch (err) {
      setShareFeedback(err?.message ?? "Não foi possível atualizar os guardados.");
    }
    setBookmarking(false);
  }

  function handleCompactLike() {
    onReaction?.(post.id, myReaction?.type ?? "adoro");
  }

  function handleOpenComments() {
    if (!post?.id) return;
    navigate(`/post/${post.id}`);
  }

  function openImageModal() {
    setActiveImagePost(post);
    setImageModalOpen(true);
  }

  function closeImageModal() {
    setImageModalOpen(false);
    setActiveImagePost(null);
  }

  function handleImageNavigate(direction) {
    if (!getAdjacentImagePost || !modalPost?.id) return;
    const targetPost = getAdjacentImagePost(modalPost.id, direction);
    if (targetPost) setActiveImagePost(targetPost);
  }

  function handleModalTouchStart(event) {
    if (!event.touches?.length) return;
    setTouchStartX(event.touches[0].clientX);
  }

  function handleModalTouchEnd(event) {
    if (touchStartX == null || !event.changedTouches?.length) return;
    const touchEndX = event.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    const SWIPE_THRESHOLD = 48;

    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        handleImageNavigate(1);
      } else {
        handleImageNavigate(-1);
      }
    }

    setTouchStartX(null);
  }

  useEffect(() => {
    if (!imageModalOpen && !shareModalOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setImageModalOpen(false);
        setShareModalOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageModalOpen, shareModalOpen]);

  useEffect(() => {
    if (!shareFeedback) return undefined;
    const timer = window.setTimeout(() => setShareFeedback(""), 2200);
    return () => window.clearTimeout(timer);
  }, [shareFeedback]);

  async function registerInternalShare() {
    if (!onShare) return;
    try {
      await onShare(post);
    } catch {
      // noop
    }
  }

  async function handleCopyLink() {
    await registerInternalShare();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("Link copiado.");
    } catch {
      setShareFeedback("Não foi possível copiar automaticamente.");
    }
  }

  async function handleNativeShare() {
    await registerInternalShare();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Publicação GIVA",
          text: shareText,
          url: shareUrl,
        });
        setShareModalOpen(false);
        return;
      } catch {
        // noop
      }
    }
    await handleCopyLink();
  }

  async function handleExternalShare(platform) {
    await registerInternalShare();
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    const map = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    };

    const url = map[platform];
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <GlassCard className={`post-card${compact ? " post-card-compact" : ""}`}>  
      <AnimatedBar />
      {/* Banner oficial removido para visual mais clean */}

      <div className="post-card-header">
        <Link to={`/perfil-publico/${author.id}`} className="post-author-link">
          <Avatar url={author.avatar_url} name={author.display_name} size={compact ? 36 : 44} />
          <div className="post-author-info">
            <div className="post-author-top">
              <strong className="post-author-name">{author.display_name ?? "Utilizador"}</strong>
              {post.is_official && <span className="material-icons-sharp post-verified-icon">verified</span>}
            </div>
            <span className="post-author-role">{TYPE_LABELS[author.type] ?? "Membro"}</span>
            <span className="post-time">{timeAgo}</span>
          </div>
        </Link>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {!readOnly && user?.id === author.id && (
            <PostActionsMenu postId={post.id} onDeleted={onDeleted} />
          )}
          {!readOnly && (
          <button
            type="button"
            className={`post-bookmark-btn${bookmarked ? " active" : ""}`}
            onClick={handleBookmark}
            title={bookmarked ? "Remover dos guardados" : "Guardar publicação"}
            aria-label={bookmarked ? "Remover dos guardados" : "Guardar publicação"}
            style={{ transition: "background 0.18s, color 0.18s", borderRadius: 18, padding: "6px 10px" }}
          >
            <span className="material-icons-sharp">{bookmarked ? "bookmark" : "bookmark_border"}</span>
          </button>
          )}
        </div>
      </div>

      <div className="post-card-body">
        {!showCompactCaptionBelow && (
          <p className={`post-content${compact ? " post-content-compact" : ""}`}>{compact ? summarizedContent : post.content}</p>
        )}
        {safePostImageUrl && (
          <button
            type="button"
            className={`post-image-wrap post-image-button${compact ? " post-image-wrap-compact" : ""}`}
            onClick={openImageModal}
            aria-label="Abrir imagem em tamanho completo"
            style={{ borderRadius: "1.1rem", overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.10)", transition: "box-shadow 0.18s" }}
          >
            <img src={safePostImageUrl} alt="" className="post-image" loading="lazy" />
          </button>
        )}
        {!compact && poll && <PollSection poll={poll} />}
        {compact && poll && (
          <div className="post-compact-tags" aria-label="Resumo do conteúdo">
            {poll ? <span className="post-compact-tag">Contém sondagem</span> : null}
          </div>
        )}
      </div>

      {!compact ? (
        <ReactionBar
          postId={post.id}
          reactions={reactions}
          onToggle={(type) => onReaction?.(post.id, type)}
          readOnly={readOnly}
        />
      ) : (
        <div className="post-instagram-compact" aria-label="Ações da publicação">
          <div className="post-instagram-actions">
            <button
              type="button"
              className={`post-ig-btn${hasReaction ? " active" : ""}`}
              onClick={handleCompactLike}
              aria-label={hasReaction ? "Remover gosto" : "Gostar"}
              disabled={readOnly}
              style={{ transition: "background 0.18s, color 0.18s", borderRadius: 18 }}
            >
              <span className="material-icons-sharp">{hasReaction ? "favorite" : "favorite_border"}</span>
            </button>
            <button
              type="button"
              className="post-ig-btn"
              aria-label="Comentários"
              onClick={handleOpenComments}
              disabled={!post?.id}
              style={{ borderRadius: 18 }}
            >
              <span className="material-icons-sharp">chat_bubble_outline</span>
            </button>
            <button
              type="button"
              className="post-ig-btn"
              aria-label="Partilhar"
              onClick={() => setShareModalOpen(true)}
              disabled={readOnly || !onShare}
              style={{ borderRadius: 18 }}
            >
              <span className="material-icons-sharp">send</span>
            </button>
          </div>
          <div className="post-instagram-meta">
            <p className="post-instagram-likes">{reactionsCount} gosto(s)</p>
            <p className="post-instagram-caption">
              <strong>{author.display_name ?? "Utilizador"}</strong> {summarizedContent}
            </p>
            {commentsCount > 0 && (
              <p className="post-instagram-comments">Ver {commentsCount} comentário(s)</p>
            )}
            {sharesCount > 0 && (
              <p className="post-instagram-comments">{sharesCount} partilha(s)</p>
            )}
          </div>
        </div>
      )}

      {!compact && (
        <CommentSection
          postId={post.id}
          commentsCount={commentsCount}
          sharesCount={sharesCount}
          onShare={() => setShareModalOpen(true)}
          compact={compact}
          readOnly={readOnly}
        />
      )}

      {imageModalOpen && modalImageUrl && (
        <div className="post-overlay" role="dialog" aria-modal="true" aria-label="Imagem da publicação" onClick={closeImageModal}>
          <div
            className="post-media-modal"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleModalTouchStart}
            onTouchEnd={handleModalTouchEnd}
          >
            <button
              type="button"
              className="post-overlay-close"
              onClick={closeImageModal}
              aria-label="Fechar"
            >
              <span className="material-icons-sharp">close</span>
            </button>

            {prevImagePost && (
              <button
                type="button"
                className="post-media-nav prev"
                onClick={() => handleImageNavigate(-1)}
                aria-label="Imagem anterior"
              >
                <span className="material-icons-sharp">chevron_left</span>
              </button>
            )}

            {nextImagePost && (
              <button
                type="button"
                className="post-media-nav next"
                onClick={() => handleImageNavigate(1)}
                aria-label="Próxima imagem"
              >
                <span className="material-icons-sharp">chevron_right</span>
              </button>
            )}

            <img src={modalImageUrl} alt="Imagem da publicação" className="post-media-modal-image" />
            <div className="post-media-modal-meta">
              <strong>{modalAuthor.display_name ?? "Utilizador"}</strong>
              <span>{modalTimeAgo}</span>
              <p>{modalPost.content}</p>
              <small>{modalReactionsCount} gosto(s) · {modalCommentsCount} comentário(s) · {modalSharesCount} partilha(s)</small>
            </div>
          </div>
        </div>
      )}

      {shareModalOpen && !readOnly && onShare && (
        <div className="post-overlay" role="dialog" aria-modal="true" aria-label="Partilhar publicação" onClick={() => setShareModalOpen(false)}>
          <div className="post-share-modal" onClick={(event) => event.stopPropagation()}>
            <div className="post-share-modal-head">
              <h4>Partilhar publicação</h4>
              <button type="button" className="post-overlay-close" onClick={() => setShareModalOpen(false)} aria-label="Fechar">
                <span className="material-icons-sharp">close</span>
              </button>
            </div>

            <div className="post-share-link-wrap">
              <input type="text" value={shareUrl} readOnly aria-label="Link da publicação" />
              <button type="button" className="btn ghost sm" onClick={handleCopyLink}>Copiar link</button>
            </div>

            <div className="post-share-actions">
              <button type="button" className="btn primary sm" onClick={handleNativeShare}>Partilha rápida</button>
              <button type="button" className="btn ghost sm" onClick={() => handleExternalShare("whatsapp")}>WhatsApp</button>
              <button type="button" className="btn ghost sm" onClick={() => handleExternalShare("facebook")}>Facebook</button>
              <button type="button" className="btn ghost sm" onClick={() => handleExternalShare("linkedin")}>LinkedIn</button>
              <button type="button" className="btn ghost sm" onClick={() => handleExternalShare("x")}>X</button>
            </div>

            {shareFeedback && <p className="post-share-feedback">{shareFeedback}</p>}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
