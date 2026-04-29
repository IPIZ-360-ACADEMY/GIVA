import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PostCard from "../components/PostCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getOrCreateConversation } from "../services/chatService.js";
import { getFeedPosts, toggleReaction } from "../services/postsService.js";
import { followUser, getProfile, isFollowing, unfollowUser } from "../services/profilesService.js";
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

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");

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

        // Carregar posts do utilizador (filtra do feed pelo author_id)
        const allPosts = await getFeedPosts(null, 50);
        setPosts(allPosts.filter((post) => post.author?.id === userId));
      } catch {
        setProfile(null);
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
