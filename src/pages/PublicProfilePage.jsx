import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PostCard from "../components/PostCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getOrCreateConversation } from "../services/chatService.js";
import { getFeedPosts, toggleReaction } from "../services/postsService.js";
import { followUser, getProfile, isFollowing, unfollowUser } from "../services/profilesService.js";
import {
  getPublicRatingSummary,
  getPublicRankingPosition,
  listTopRatedCompanies,
  listTopRatedStudents,
} from "../services/publicRatingsService.js";
import { sanitizeAssetUrl } from "../utils/urlSafety.js";

function Avatar({ url, name, size = 80 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  const safeUrl = sanitizeAssetUrl(url);
  return safeUrl ? (
    <img src={safeUrl} alt={name} className="post-avatar" width={size} height={size} style={{ width: size, height: size, borderRadius: "50%" }} />
  ) : (
    <div className="post-avatar post-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42, borderRadius: "50%" }}>
      {initials}
    </div>
  );
}

function TypeBadge({ type }) {
  const labels = { student: "Aluno", company: "Empresa", external: "Visitante", admin: "Admin" };
  return <span className={`profile-type-badge badge-${type}`}>{labels[type] ?? type}</span>;
}

function RatingStars({ value }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const filled = Math.max(0, Math.min(5, Math.round(safeValue)));
  const stars = Array.from({ length: 5 }, (_, index) => (index < filled ? "★" : "☆")).join("");
  return <span aria-label={`Classificação ${safeValue} de 5`}>{stars}</span>;
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const [ratingSummary, setRatingSummary] = useState({ average: null, count: 0, comments: [] });
  const [ranking, setRanking] = useState([]);
  const [rankingPosition, setRankingPosition] = useState(null);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      setLoading(true);
      try {
        const [p, followed] = await Promise.all([
          getProfile(userId),
          user ? isFollowing(userId) : Promise.resolve(false),
        ]);
        setProfile(p);
        setFollowing(followed);

        const [summary, rankingRows] = await Promise.all([
          getPublicRatingSummary({ userId, profileType: p?.type }),
          p?.type === "student" ? listTopRatedStudents(5) : p?.type === "company" ? listTopRatedCompanies(5) : Promise.resolve([]),
        ]);

        const position = await getPublicRankingPosition({ userId, profileType: p?.type });

        setRatingSummary(summary ?? { average: null, count: 0, comments: [] });
        setRanking(rankingRows ?? []);
        setRankingPosition(position ?? null);

        // Carregar posts do utilizador (filtra do feed pelo author_id)
        const allPosts = await getFeedPosts(null, 50);
        setPosts(allPosts.filter((post) => post.author?.id === userId));
      } catch {
        setProfile(null);
        setRatingSummary({ average: null, count: 0, comments: [] });
        setRanking([]);
        setRankingPosition(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId, user]);

  async function handleFollow() {
    if (!user) { navigate("/login"); return; }
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
      setActionError("");
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível atualizar o estado de seguimento.");
    }
  }

  async function handleMessage() {
    if (!user) { navigate("/login"); return; }
    try {
      await getOrCreateConversation(userId);
      navigate(`/chat?with=${userId}`);
      setActionError("");
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível iniciar a conversa.");
    }
  }

  async function handleReaction(postId, type) {
    if (!user) return;
    try {
      const added = await toggleReaction(postId, type);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const reactions = added
            ? [...(p.reactions ?? []), { id: `tmp`, post_id: postId, user_id: user.id, type }]
            : (p.reactions ?? []).filter((r) => !(r.user_id === user.id && r.type === type));
          return { ...p, reactions };
        })
      );
      setActionError("");
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível registar a reação.");
    }
  }

  if (loading) {
    return (
      <div className="public-profile-page">
        <div className="profile-loading">A carregar perfil...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="public-profile-page">
        <div className="profile-loading">
          Perfil não encontrado. <Link to="/home">Voltar ao início</Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.id === userId;
  const rankingTitle = profile.type === "student" ? "Top estudantes" : "Top empresas";
  const ratingAverage = ratingSummary?.average;
  const hasRatings = Number.isFinite(Number(ratingAverage)) && Number(ratingSummary?.count) > 0;
  const rankingHasCurrentProfile = ranking.some((row) => row.userId === userId);
  const showRankingSection = profile.type === "student" || profile.type === "company";

  return (
    <div className="public-profile-page">
      <div className="public-profile-header">
        <Avatar url={profile.avatar_url} name={profile.display_name} size={80} />
        <div className="public-profile-info">
          <h1 className="public-profile-name">{profile.display_name}</h1>
          <TypeBadge type={profile.type} />
          {profile.student_accounts && (
            <p className="public-profile-meta">Processo: {profile.student_accounts.process_number}</p>
          )}
          {profile.company_accounts && (
            <p className="public-profile-meta">{profile.company_accounts.empresa} · {profile.company_accounts.cidade}</p>
          )}
          {profile.bio && <p className="public-profile-bio">{profile.bio}</p>}

          <div className="public-profile-rating" style={{ marginTop: "0.65rem", display: "grid", gap: "0.3rem" }}>
            <strong style={{ fontSize: "0.85rem" }}>Classificação pública</strong>
            {hasRatings ? (
              <>
                <p className="public-profile-meta" style={{ margin: 0 }}>
                  <RatingStars value={ratingAverage} /> {ratingAverage}/5 · {ratingSummary.count} avaliação(ões)
                </p>
                {Array.isArray(ratingSummary.comments) && ratingSummary.comments.length > 0 ? (
                  <p className="public-profile-bio" style={{ marginTop: "0.1rem" }}>
                    “{ratingSummary.comments[0]}”
                  </p>
                ) : null}
              </>
            ) : (
              <p className="public-profile-meta" style={{ margin: 0 }}>Ainda sem avaliações públicas.</p>
            )}
          </div>
        </div>
        {!isOwnProfile && user && (
          <div className="public-profile-actions">
            <button
              type="button"
              className={`btn ${following ? "ghost" : "primary"} sm`}
              onClick={handleFollow}
            >
              {following ? "A seguir ✓" : "+ Seguir"}
            </button>
            <button type="button" className="btn ghost sm" onClick={handleMessage}>
              💬 Mensagem
            </button>
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
          </div>
        )}
        {!user && (
          <div className="public-profile-actions">
            <Link to="/login" className="btn primary sm">Entrar para interagir</Link>
          </div>
        )}
      </div>

      {showRankingSection && (ranking.length > 0 || rankingPosition?.total > 0) ? (
        <div className="public-profile-posts" style={{ marginBottom: "1rem" }}>
          <h2 className="public-profile-posts-title">{rankingTitle}</h2>
          {rankingPosition?.total > 0 ? (
            <p className="public-profile-meta" style={{ marginBottom: "0.55rem" }}>
              {rankingPosition?.position
                ? `Posição global: #${rankingPosition.position} de ${rankingPosition.total}`
                : `Sem posição no top atual (total classificado: ${rankingPosition.total})`}
            </p>
          ) : null}
          <div style={{ display: "grid", gap: "0.45rem" }}>
            {ranking.map((row, index) => (
              <div key={`${row.entityId}-${index}`} className="panel-card" style={{ padding: "0.65rem 0.8rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: "0.85rem" }}>#{index + 1} {row.displayName}</strong>
                  <p className="public-profile-meta" style={{ margin: 0 }}>
                    <RatingStars value={row.average} /> {row.average}/5 · {row.count} avaliação(ões)
                  </p>
                </div>
                {row.userId ? (
                  <Link className="btn ghost sm" to={`/perfil-publico/${row.userId}`}>Ver perfil</Link>
                ) : null}
              </div>
            ))}
          </div>
          {rankingHasCurrentProfile ? (
            <p className="public-profile-meta" style={{ marginTop: "0.45rem" }}>Este perfil está no top atual.</p>
          ) : null}
        </div>
      ) : null}

      <div className="public-profile-posts">
        <h2 className="public-profile-posts-title">Publicações</h2>
        {posts.length === 0 ? (
          <p className="feed-empty-text">Ainda sem publicações.</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onReaction={handleReaction} />
          ))
        )}
      </div>
    </div>
  );
}
