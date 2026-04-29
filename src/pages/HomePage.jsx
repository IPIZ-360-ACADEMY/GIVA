import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CreatePostCard from "../components/CreatePostCard.jsx";
import PageHeader from "../components/PageHeader.jsx";
import PanelSection from "../components/PanelSection.jsx";
import PostCard from "../components/PostCard.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getBookmarkedPostIds, getBookmarkedPosts, getFeedPosts, sharePost, subscribeToFeed, toggleReaction } from "../services/postsService.js";
export default function HomePage() {
  const { t } = useOutletContext();
  const { user, userProfile, authProfile } = useAuth();
  const role = String(authProfile?.role ?? "").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin1 = role === "ADMIN_1";
  const isAdmin = isSuperAdmin || isAdmin1;
  const isStudent = role === "STUDENT" || userProfile?.type === "student";
  const isExternal = role === "EXTERNAL" || userProfile?.type === "external";
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
      setError(err.message ?? "Erro ao carregar publicações");
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
          setError(err?.message ?? "Não foi possível atualizar o feed em tempo real.");
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

  const visiblePostsCount = posts.length;
  const officialPostsCount = posts.filter((post) => post.is_official).length;
  const savedPostsCount = bookmarkedIds.size;
  const visibleReactionsCount = posts.reduce((sum, post) => sum + (post.reactions?.length ?? 0), 0);
  const compactSummary = [
    `${visiblePostsCount} publicações`,
    `${officialPostsCount} oficiais`,
    `${savedPostsCount} guardadas`,
    `${visibleReactionsCount} interações`,
  ];

  const feedPersona = (() => {
    if (isSuperAdmin) {
      return {
        title: "Comando Social Institucional",
        description: "Canal completo para comunicação estratégica, monitorização e decisão institucional.",
        summary: [
          `${visiblePostsCount} publicações no ecossistema`,
          `${officialPostsCount} comunicados oficiais`,
          `${savedPostsCount} conteúdos guardados`,
          `${visibleReactionsCount} interações monitoradas`,
        ],
        spotlight: [
          { label: "Governação", value: "Total", hint: "Visão transversal de comunicação" },
          { label: "Ação", value: "Imediata", hint: "Priorizar comunicados críticos" },
        ],
      };
    }

    if (isAdmin1) {
      return {
        title: "Feed Operacional da Coordenação",
        description: "Visão curada para acompanhamento diário da tua operação académica.",
        summary: [
          `${visiblePostsCount} publicações relevantes`,
          `${officialPostsCount} alertas oficiais`,
          `${savedPostsCount} conteúdos para seguimento`,
          `${visibleReactionsCount} sinais da comunidade`,
        ],
        spotlight: [
          { label: "Foco", value: "Execução", hint: "Prioriza mensagens que impactam turmas" },
          { label: "Ritmo", value: "Diário", hint: "Acompanha tendências e dúvidas" },
        ],
      };
    }

    if (isStudent) {
      return {
        title: "Feed do Estudante",
        description: "Atualizações simples do teu percurso: oportunidades, orientações e anúncios úteis.",
        summary: [
          `${visiblePostsCount} atualizações para ti`,
          `${officialPostsCount} comunicados importantes`,
          `${savedPostsCount} conteúdos guardados`,
          `${visibleReactionsCount} interações da comunidade`,
        ],
        spotlight: [
          { label: "Objetivo", value: "Empregabilidade", hint: "Acompanha vagas e comunicados úteis" },
          { label: "Perfil", value: "Evolução", hint: "Regista interesses e aprende com a comunidade" },
        ],
      };
    }

    if (isExternal) {
      return {
        title: "Feed Público Curado",
        description: "Visão informativa e resumida da comunidade IPIZ em modo de leitura.",
        summary: [
          `${visiblePostsCount} publicações públicas`,
          `${officialPostsCount} comunicados institucionais`,
          `${visibleReactionsCount} interações observadas`,
          "Modo leitura ativo",
        ],
        spotlight: [
          { label: "Acesso", value: "Leitura", hint: "Sem ações de publicação/reação" },
          { label: "Escopo", value: "Público", hint: "Conteúdo aberto e comunicados" },
        ],
      };
    }

    return {
      title: "Comunidade",
      description: "Informação pública, simples e resumida da comunidade académica.",
      summary: compactSummary,
      spotlight: [],
    };
  })();

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
    <main className="page page-home">
      <PageHeader
        title={feedPersona.title}
        description={feedPersona.description}
      />

      <section className="community-summary" aria-label="Resumo público da comunidade">
        {feedPersona.summary.map((item) => (
          <span key={item} className="community-summary-item">{item}</span>
        ))}
      </section>

      {feedPersona.spotlight.length > 0 && (
        <section className="stats-grid dashboard-kpis dashboard-kpis-secondary" aria-label="Resumo de perfil do feed">
          {feedPersona.spotlight.map((item) => (
            <article className="stat-card" key={item.label}>
              <div className="stat-head">
                <span>{item.label}</span>
                <span className="material-icons-sharp">insights</span>
              </div>
              <h3>{item.value}</h3>
              <p>{item.hint}</p>
            </article>
          ))}
        </section>
      )}

      {user && !isExternal ? (
        <section className="panel-card" style={{ marginBottom: "1rem" }}>
          <CreatePostCard onCreated={handleCreated} />
        </section>
      ) : null}

      <PanelSection
        title="Feed"
        className="panel dashboard-panel community-feed-panel"
        actions={
          <div style={{ display: "grid", gap: "0.35rem", justifyItems: "end" }}>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }} role="group" aria-label="Filtrar feed">
              {[
                ...availableFeedFilters,
              ].map((filterItem) => (
                <button
                  key={filterItem.id}
                  type="button"
                  className={`btn ghost btn-sm${feedFilter === filterItem.id ? " --active" : ""}`}
                  onClick={() => setFeedFilter(filterItem.id)}
                  aria-pressed={feedFilter === filterItem.id}
                >
                  <span className="material-icons-sharp" aria-hidden="true">{filterItem.icon}</span>
                  {filterItem.label}
                </button>
              ))}
            </div>
            <span className="meta" style={{ fontSize: "0.78rem" }}>
              {visiblePostsCount} publicação(ões) no resultado atual{isExternal ? " · leitura" : ""}
            </span>
          </div>
        }
      >
        {loading && (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="panel-card"
                style={{ minHeight: "120px", background: "var(--surface-alt, rgba(148, 163, 184, 0.12))" }}
              />
            ))}
          </div>
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

        <div style={{ display: "grid", gap: "0.85rem" }}>
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
        </div>

        {feedFilter !== "saved" && hasMore && !loading && (
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center" }}>
            <button type="button" className="btn ghost" onClick={() => loadPosts(false)} disabled={loadingMore}>
              {loadingMore ? "A carregar..." : "Mostrar mais publicações"}
            </button>
          </div>
        )}
      </PanelSection>
    </main>
  );
}


