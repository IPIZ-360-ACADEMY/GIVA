import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CreatePostCard from "../components/CreatePostCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import PostCard from "../components/PostCard.jsx";
import "../styles/community-feed.css";
import { useAuth, useAccessProfile } from "../contexts/AuthContext.jsx";
import { getBookmarkedPostIds, getBookmarkedPosts, getFeedPosts, sharePost, subscribeToFeed, toggleReaction } from "../services/postsService.js";
import styled from "@emotion/styled";

const FeedHero = styled.section`
  width: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%);
  color: var(--text-inverted);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 32px rgba(0,0,0,0.10);
  padding: 2.2rem 1.5rem 1.5rem 1.5rem;
  margin-bottom: 2.2rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.7rem;
  position: relative;
  overflow: hidden;
  @media (max-width: 700px) {
    padding: 1.2rem 0.7rem 1.1rem 0.7rem;
    margin-bottom: 1.2rem;
  }
`;

const FeedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 1.5rem;
  width: 100%;
  margin-bottom: 2.5rem;
  @media (max-width: 700px) {
    gap: 0.85rem;
    grid-template-columns: 1fr;
    margin-bottom: 1.2rem;
  }
`;

const FeedSummary = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  font-size: 1.05rem;
  opacity: 0.92;
  @media (max-width: 700px) {
    gap: 0.7rem;
    font-size: 0.97rem;
  }
`;

const FeedSpotlight = styled.div`
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  font-size: 0.93rem;
  opacity: 0.85;
  @media (max-width: 700px) {
    gap: 0.5rem;
    font-size: 0.89rem;
  }
`;

export default function HomePage() {
  const { t } = useOutletContext();
  const { user } = useAuth();
  const { isSuperAdmin, isCoordinatorUser, isStudentUser: isStudent, isExternalUser: isExternal } = useAccessProfile();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [feedFilter, setFeedFilter] = useState("all"); // all | official | saved | trending
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const cursorRef = useRef(null);
  const unsubRef = useRef(null);

  // Carregar IDs guardados
  useEffect(() => {
    if (!user || isExternal) return;
    getBookmarkedPostIds()
      .then((ids) => setBookmarkedIds(new Set(ids)))
      .catch((err) => {
        setError(err?.message ?? "Não foi possível carregar os itens guardados.");
      });
  }, [isExternal, user]);

  function applyFilter(rows, filter) {
    if (filter === "official") return rows.filter((p) => p.is_official);
    if (filter === "trending") {
      return [...rows].sort((a, b) => {
        const scoreA = (a.reactions?.length ?? 0) + (a.comments_count?.[0]?.count ?? 0) * 2 + (a.shares_count?.[0]?.count ?? 0) * 3;
        const scoreB = (b.reactions?.length ?? 0) + (b.comments_count?.[0]?.count ?? 0) * 2 + (b.shares_count?.[0]?.count ?? 0) * 3;
        //Conts for updates and more committs sistems - no code more than 25 lines
        return scoreB - scoreA;
      });
    }
    return rows;
  }

  const loadPosts = useCallback(async (reset = false, filter = feedFilter) => {
    try {
      reset ? setLoading(true) : setLoadingMore(true);
      let data;
      if (filter === "saved" && !isExternal) {
        data = await getBookmarkedPosts();
        setPosts(data);
        setHasMore(false);
      } else {
        const cursor = reset ? null : cursorRef.current;
        const all = await getFeedPosts(cursor, 20);
        data = applyFilter(all, filter);
        if (all.length > 0) cursorRef.current = all[all.length - 1].created_at;
        if (all.length < 20) setHasMore(false);
        else setHasMore(true);
        setPosts((prev) => reset ? data : [...prev, ...data]);
      }
    } catch (err) {
      setError(err.message ?? "Erro ao carregar publicações!");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [feedFilter, isExternal]);

  useEffect(() => {
    cursorRef.current = null;
    loadPosts(true, feedFilter);
    if (feedFilter !== "saved") {
      if (unsubRef.current) unsubRef.current();
      unsubRef.current = subscribeToFeed(async () => {
        try {
          const fresh = await getFeedPosts(null, 20);
          const filtered = applyFilter(fresh, feedFilter);
          setPosts(filtered);
          setHasMore(fresh.length >= 20);
          cursorRef.current = fresh[fresh.length - 1]?.created_at ?? null;
          setError("");
        } catch (err) {
          setError(err?.message ?? "Não foi possível atualizar o feed em tempo real, Verifique sua conecção.");
        }
      });
    }
    return () => unsubRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter]);

  async function handleReaction(postId, type) {
    if (!user || isExternal) return;
    try {
      const added = await toggleReaction(postId, type);
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const reactions = added
            ? [...(p.reactions ?? []), { id: `tmp_${Date.now()}`, post_id: postId, user_id: user.id, type }]
            : (p.reactions ?? []).filter((r) => !(r.user_id === user.id && r.type === type));
          return { ...p, reactions };
        })
      );
      setError("");
    } catch (err) {
      setError(err?.message ?? "Não foi possível registar a reação.");
    }
  }

  async function handleShare(post) {
    if (!user || isExternal) return;
    try {
      const added = await sharePost(post.id);
      if (added) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, shares_count: [{ count: (p.shares_count?.[0]?.count ?? 0) + 1 }] }
              : p
          )
        );
      }
      setError("");
    } catch (err) {
      setError(err?.message ?? "Não foi possível partilhar a publicação.");
    }
  }

  function handleBookmark(postId, added) {
    if (isExternal) return;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (added) next.add(postId); else next.delete(postId);
      return next;
    });
    if (feedFilter === "saved" && !added) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }

  function handleCreated(newPost) {
    if (newPost) setPosts((prev) => [newPost, ...prev]);
  }

  // Limpeza: métricas removidas para visual mais clean

  // Limpeza: feedPersona simplificado
  const feedPersona = {
    title: isStudent ? "Feed do Estudante" : "Comunidade",
    description: isStudent ? "Atualizações do teu percurso: oportunidades e anúncios úteis." : "Feed da comunidade acadêmica.",
  };

  const availableFeedFilters = (() => {
    if (isExternal) {
      return [
        { id: "all", icon: "public", label: "Tudo" },
        { id: "official", icon: "campaign", label: "Oficial" },
      ];
    }

    if (isStudent) {
      return [
        { id: "all", icon: "public", label: "Tudo" },
        { id: "official", icon: "campaign", label: "Oficial" },
        { id: "saved", icon: "bookmark", label: "Guardados" },
      ];
    }

    return [
      { id: "all", icon: "public", label: "Tudo" },
      { id: "official", icon: "campaign", label: "Oficial" },
      { id: "saved", icon: "bookmark", label: "Guardados" },
      { id: "trending", icon: "local_fire_department", label: "Tendências" },
    ];
  })();

  const getAdjacentImagePost = useCallback((currentId, direction) => {
    const imagePosts = posts.filter((feedPost) => Boolean(feedPost.image_url));
    if (imagePosts.length === 0) return null;

    const currentIndex = imagePosts.findIndex((feedPost) => feedPost.id === currentId);
    if (currentIndex === -1) return null;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= imagePosts.length) return null;
    return imagePosts[targetIndex];
  }, [posts]);

  return (
    <main className="page page-home" style={{ padding: 0, background: "var(--bg)" }}>
      <FeedHero>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 800, margin: 0, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{feedPersona.title}</h1>
        <p style={{ fontSize: "1.18rem", margin: 0, opacity: 0.96 }}>{feedPersona.description}</p>
      </FeedHero>

      {user && !isExternal && (
        <section className="panel-card" style={{ marginBottom: "1.2rem", boxShadow: "0 2px 16px rgba(0,0,0,0.07)", border: "none" }}>
          <CreatePostCard onCreated={handleCreated} />
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginBottom: "1.2rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }} role="group" aria-label="Filtrar feed">
          {availableFeedFilters.map((filterItem) => (
            <button
              key={filterItem.id}
              type="button"
              className={`btn ghost btn-sm${feedFilter === filterItem.id ? " --active" : ""}`}
              onClick={() => setFeedFilter(filterItem.id)}
              aria-pressed={feedFilter === filterItem.id}
              style={{ fontWeight: 600, fontSize: "1.01rem", borderRadius: 18, padding: "7px 18px" }}
            >
              <span className="material-icons-sharp" aria-hidden="true">{filterItem.icon}</span>
              {filterItem.label}
            </button>
          ))}
        </div>
        <span className="meta" style={{ fontSize: "0.93rem", opacity: 0.7 }}>
          {visiblePostsCount} publicação(ões) no resultado atual{isExternal ? " · leitura" : ""}
        </span>
      </div>

      {loading && (
        <FeedGrid>
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="panel-card"
              style={{ minHeight: "120px", background: "var(--surface-alt, rgba(148, 163, 184, 0.12))", boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}
            />
          ))}
        </FeedGrid>
      )}

      {error && <p className="form-error" style={{ textAlign: "center" }}>{error}</p>}

      {!loading && posts.length === 0 && !error && (
        <div className="empty-state" style={{ padding: "2rem 1rem" }}>
          <span className="material-icons-sharp" aria-hidden="true" style={{ fontSize: "2.4rem", opacity: 0.7 }}>
            {feedFilter === "saved" ? "bookmark_border" : "inbox"}
          </span>
          <p className="empty-state-title" style={{ marginTop: "0.6rem" }}>
            {feedFilter === "saved"
              ? "Ainda não guardaste nenhuma publicação."
              : feedFilter === "official"
                ? "Sem comunicados oficiais por agora."
                : "Ainda não há publicações."}
          </p>
          <p className="empty-state-text">
            {t?.("dashboard.description") ?? "Acompanhe aqui as novidades da comunidade."}
          </p>
        </div>
      )}

      <FeedGrid>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onReaction={isExternal ? undefined : handleReaction}
            onShare={isExternal ? undefined : handleShare}
            isBookmarked={bookmarkedIds.has(post.id)}
            onBookmark={handleBookmark}
            getAdjacentImagePost={getAdjacentImagePost}
            readOnly={isExternal}
            compact
          />
        ))}
      </FeedGrid>

      {feedFilter !== "saved" && hasMore && !loading && (
        <div style={{ margin: "2.2rem 0 2.5rem 0", display: "flex", justifyContent: "center" }}>
          <button type="button" className="btn ghost" onClick={() => loadPosts(false)} disabled={loadingMore} style={{ fontSize: "1.1rem", padding: "0.7rem 2.2rem", borderRadius: 18, fontWeight: 600, boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}>
            {loadingMore ? "A carregar..." : "Mostrar mais publicações"}
          </button>
        </div>
      )}
    </main>
  );
}


