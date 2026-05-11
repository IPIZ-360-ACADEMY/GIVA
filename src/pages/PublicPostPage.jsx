import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader.jsx";
import PostCard from "../components/PostCard.jsx";
import "../styles/community-feed.css";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getPublicPostById, toggleReaction } from "../services/postsService.js";

export default function PublicPostPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) return;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getPublicPostById(postId);
        setPost(data);
      } catch {
        setPost(null);
        setError("Publicação não encontrada ou indisponível.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [postId]);

  async function handleReaction(targetPostId, type) {
    if (!user) return;
    try {
      const added = await toggleReaction(targetPostId, type);
      setPost((prev) => {
        if (!prev || prev.id !== targetPostId) return prev;
        const reactions = added
          ? [...(prev.reactions ?? []), { id: `tmp_${Date.now()}`, post_id: targetPostId, user_id: user.id, type }]
          : (prev.reactions ?? []).filter((reaction) => !(reaction.user_id === user.id && reaction.type === type));
        return { ...prev, reactions };
      });
    } catch {
      // noop
    }
  }

  return (
    <main className="page public-post-page">
      <PageHeader
        title="Publicação"
        description="Visualização pública da publicação partilhada."
      />

      {loading && <p className="meta">A carregar publicação...</p>}

      {!loading && error && (
        <section className="panel-card" style={{ display: "grid", gap: "0.75rem" }}>
          <p className="form-error">{error}</p>
          <Link to="/home" className="btn ghost sm" style={{ width: "fit-content" }}>
            Voltar à Comunidade
          </Link>
        </section>
      )}

      {!loading && post && (
        <section className="panel-card" style={{ maxWidth: "760px" }}>
          <PostCard post={post} onReaction={handleReaction} />
        </section>
      )}
    </main>
  );
}
