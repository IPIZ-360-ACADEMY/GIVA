import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import CreatePostCard from "../components/CreatePostCard.jsx";
import PostCard from "../components/PostCard.jsx";
import "../styles/community-feed.css";
import { useAuth, useAccessProfile } from "../contexts/AuthContext.jsx";
import {
  getBookmarkedPostIds,
  getBookmarkedPosts,
  getCommunitySidebarData,
  getFeedPosts,
  sharePost,
  subscribeToFeed,
  subscribeToPresence,
  toggleReaction,
} from "../services/postsService.js";
import { toUserErrorMessage } from "../utils/errorMessages.js";
import { sanitizeAssetUrl } from "../utils/urlSafety.js";

function formatEventDate(value) {
  if (!value) return "Data indefinida";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indefinida";
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function AvatarMini({ url, name }) {
  const safeUrl = sanitizeAssetUrl(url);
  const initials = (String(name ?? "?").trim().charAt(0) || "?").toUpperCase();
  if (safeUrl) {
    return <img src={safeUrl} alt={name ?? "Membro"} className="community-mini-avatar" />;
  }
  return <span className="community-mini-avatar community-mini-avatar-fallback">{initials}</span>;
}

function formatRelativeActivity(value) {
  if (!value) return "Sem registo recente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem registo recente";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Agora mesmo";
  if (diffMinutes < 60) return `Há ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Há ${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  return `Há ${diffDays} d`;
}

function PresenceMemberRow({ member }) {
  const isOnline = member.status === "online";
  return (
    <article className="community-presence-item">
      <AvatarMini url={member.avatar_url} name={member.display_name} />
      <div className="community-presence-copy">
        <strong>{member.display_name ?? "Utilizador"}</strong>
        <small>{isOnline ? "Ativo agora" : formatRelativeActivity(member.lastSeenAt)}</small>
      </div>
      <span className={`community-presence-state ${isOnline ? "online" : "offline"}`}>
        {isOnline ? "Online" : "Offline"}
      </span>
    </article>
  );
}

const PRESENCE_WINDOW_OPTIONS = [1, 5, 10, 20];

export default function HomePage() {
  const { t } = useOutletContext();
  const { user, userProfile } = useAuth();
  const { isSuperAdmin, isCoordinatorUser, isStudentUser: isStudent, isExternalUser: isExternal } = useAccessProfile();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [feedFilter, setFeedFilter] = useState("all"); // all | official | saved | trending
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [communityData, setCommunityData] = useState({
    membersCount: 0,
    postsCount: 0,
    commentsCount: 0,
    reactionsCount: 0,
    onlineNowCount: 0,
    offlineNowCount: 0,
    onlineMembers: [],
    offlineMembers: [],
    createdYear: null,
    onlineWindowMinutes: 20,
    upcomingEvents: [],
  });
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [presenceWindowMinutes, setPresenceWindowMinutes] = useState(() => {
    if (typeof window === "undefined") return 5;
    const savedValue = Number(window.localStorage.getItem("community-presence-window-minutes"));
    return PRESENCE_WINDOW_OPTIONS.includes(savedValue) ? savedValue : 5;
  });
  const cursorRef = useRef(null);
  const unsubRef = useRef(null);
  const presenceUnsubRef = useRef(null);
  const composerRef = useRef(null);

  const loadCommunityData = useCallback(async () => {
    try {
      setSidebarLoading(true);
      const data = await getCommunitySidebarData({ onlineWindowMinutes: presenceWindowMinutes });
      setCommunityData(data);
    } catch (err) {
      setError((prev) => prev || toUserErrorMessage(err, "Nao foi possivel carregar os indicadores da comunidade."));
    } finally {
      setSidebarLoading(false);
    }
  }, [presenceWindowMinutes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("community-presence-window-minutes", String(presenceWindowMinutes));
  }, [presenceWindowMinutes]);

  // Carregar IDs guardados
  useEffect(() => {
    if (!user || isExternal) return;
    getBookmarkedPostIds()
      .then((ids) => setBookmarkedIds(new Set(ids)))
      .catch((err) => {
        setError(toUserErrorMessage(err, "Não foi possível carregar os itens guardados."));
      });
  }, [isExternal, user]);

  useEffect(() => {
    loadCommunityData();
  }, [loadCommunityData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadCommunityData();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadCommunityData]);

  useEffect(() => {
    if (presenceUnsubRef.current) presenceUnsubRef.current();
    presenceUnsubRef.current = subscribeToPresence(() => {
      loadCommunityData();
    });

    return () => {
      presenceUnsubRef.current?.();
      presenceUnsubRef.current = null;
    };
  }, [loadCommunityData]);

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
      if (reset) {
        setError("");
      }
    } catch (err) {
      setError(toUserErrorMessage(err, "Não foi possível carregar as publicações agora."));
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
          loadCommunityData();
        } catch (err) {
          setError(toUserErrorMessage(err, "Não foi possível atualizar o feed em tempo real. Verifique a ligação e tente novamente."));
        }
      });
    }
    return () => unsubRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedFilter, loadCommunityData]);

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
      setCommunityData((prev) => ({
        ...prev,
        reactionsCount: Math.max(0, (prev.reactionsCount ?? 0) + (added ? 1 : -1)),
      }));
      setError("");
    } catch (err) {
      setError(toUserErrorMessage(err, "Não foi possível registar a reação agora."));
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
      if (added) {
        loadCommunityData();
      }
      setError("");
    } catch (err) {
      setError(toUserErrorMessage(err, "Não foi possível partilhar a publicação agora."));
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
    if (!newPost) return;
    setPosts((prev) => [newPost, ...prev]);
    loadCommunityData();
  }

  function focusComposer() {
    if (!composerRef.current) return;
    setShowComposer(true);
    composerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const triggerButton = composerRef.current?.querySelector(".create-post-trigger");
      if (triggerButton instanceof HTMLButtonElement) triggerButton.click();
    }, 30);
  }

  const visiblePostsCount = posts.length;
  const officialPostsCount = posts.filter((post) => post.is_official).length;
  const savedPostsCount = bookmarkedIds.size;
  const visibleReactionsCount = posts.reduce((sum, post) => sum + (post.reactions?.length ?? 0), 0);
  const compactSummary = [
    `${visiblePostsCount} publicacoes visiveis`,
    `${officialPostsCount} oficiais`,
    `${savedPostsCount} guardadas`,
    `${visibleReactionsCount} interacoes`,
  ];

  const feedPersona = (() => {
    if (isSuperAdmin) {
      return {
        title: "Comando Social Institucional",
        description: "Canal completo para comunicacao estrategica, monitorizacao e decisao institucional.",
        summary: [
          `${visiblePostsCount} publicações no ecossistema`,
          `${officialPostsCount} comunicados oficiais`,
          `${savedPostsCount} conteúdos guardados`,
          `${visibleReactionsCount} interacoes monitoradas`,
        ],
        spotlight: [
          { label: "Governação", value: "Total", hint: "Visão transversal de comunicação" },
          { label: "Ação", value: "Imediata", hint: "Priorizar comunicados críticos" },
        ],
      };
    }

    if (isCoordinatorUser) {
      return {
        title: "Feed Operacional da Coordenacao",
        description: "Visao curada para acompanhamento diario da tua operacao academica.",
        summary: [
          `${visiblePostsCount} publicações relevantes`,
          `${officialPostsCount} alertas oficiais`,
          `${savedPostsCount} conteúdos para seguimento`,
          `${visibleReactionsCount} sinais da comunidade`,
        ],
        spotlight: [
          { label: "Foco", value: "Execucao", hint: "Prioriza mensagens que impactam turmas" },
          { label: "Ritmo", value: "Diário", hint: "Acompanha tendências e dúvidas" },
        ],
      };
    }

    if (isStudent) {
      return {
        title: "Feed do Estudante",
        description: "Atualizacoes simples do teu percurso: oportunidades, orientacoes e anuncios uteis.",
        summary: [
          `${visiblePostsCount} atualizacoes para ti`,
          `${officialPostsCount} comunicados importantes`,
          `${savedPostsCount} conteúdos guardados`,
          `${visibleReactionsCount} interacoes da comunidade`,
        ],
        spotlight: [
          { label: "Objetivo", value: "Empregabilidade", hint: "Acompanha vagas e comunicados úteis" },
          { label: "Perfil", value: "Evolução", hint: "Regista interesses e aprende com a comunidade" },
        ],
      };
    }

    if (isExternal) {
      return {
        title: "Feed Publico Curado",
        description: "Visao informativa e resumida da comunidade IPIZ em modo de leitura.",
        summary: [
          `${visiblePostsCount} publicacoes publicas`,
          `${officialPostsCount} comunicados institucionais`,
          `${visibleReactionsCount} interacoes observadas`,
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
      description: "Informacao publica, simples e resumida da comunidade academica.",
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

  const feedFilterLabelMap = {
    all: "Todas as categorias",
    official: "Oficial",
    saved: "Guardados",
    trending: "Tendencias",
  };

  return (
    <main className="page page-home community-modern-page">
      <div className="community-top-grid">
        <section className="community-hero-card panel-card">
          <div className="community-hero-banner">
            <div className="community-hero-content">
              <h1>GIVA IPIZ</h1>
              <p>Inovacao. Tecnologia. Comunidade.</p>
              <small>{feedPersona.description}</small>
              <div className="community-hero-avatars" aria-label="Membros com atividade recente">
                {(communityData.onlineMembers ?? []).slice(0, 6).map((member) => (
                  <AvatarMini key={member.id} url={member.avatar_url} name={member.display_name} />
                ))}
                <span className="community-online-pill">{communityData.onlineNowCount} membros online</span>
                <span className="community-online-pill community-online-pill-muted">{communityData.offlineNowCount} offline</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-card community-side-card community-about-card">
          <h3>Sobre a comunidade</h3>
          <p>
            A GIVA IPIZ e uma comunidade criada para conectar pessoas apaixonadas por tecnologia, inovacao e aprendizagem continua.
          </p>
          <ul>
            <li>Criada em {communityData.createdYear ?? "--"}</li>
            <li>Comunidade aberta</li>
          </ul>
        </section>
      </div>

      <div className="community-content-grid">
        <section className="community-feed-column">
          {!isExternal && user ? (
            <section ref={composerRef} className="panel-card community-create-wrap">
              <div className="community-compose-shell">
                <AvatarMini url={userProfile?.avatar_url} name={userProfile?.display_name} />
                <button type="button" className="community-compose-input" onClick={focusComposer}>
                  O que voce gostaria de compartilhar com a comunidade?
                </button>
                <button type="button" className="community-create-cta" onClick={focusComposer}>
                  <span className="material-icons-sharp" aria-hidden="true">add</span>
                  Nova publicacao
                </button>
              </div>

              {showComposer ? (
                <div className="community-composer-expanded">
                  <CreatePostCard onCreated={(post) => { handleCreated(post); setShowComposer(false); }} />
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="button" className="btn ghost btn-sm" onClick={() => setShowComposer(false)}>
                      Fechar editor
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="community-shortcuts-row">
                <button type="button" className="community-shortcut-card" onClick={focusComposer}>
                  <span className="material-icons-sharp">photo_camera</span>
                  <strong>Foto</strong>
                  <small>Compartilhe uma foto com a comunidade</small>
                </button>
                <button type="button" className="community-shortcut-card" onClick={focusComposer}>
                  <span className="material-icons-sharp">poll</span>
                  <strong>Sondagem</strong>
                  <small>Crie uma enquete e veja opinioes</small>
                </button>
                <button type="button" className="community-shortcut-card" onClick={focusComposer}>
                  <span className="material-icons-sharp">article</span>
                  <strong>Artigo</strong>
                  <small>Escreva conteudo para a comunidade</small>
                </button>
                <button type="button" className="community-shortcut-card" onClick={focusComposer}>
                  <span className="material-icons-sharp">event</span>
                  <strong>Evento</strong>
                  <small>Divulgue encontros e atividades</small>
                </button>
              </div>
            </section>
          ) : null}

          <div className="community-feed-toolbar">
            <strong>Mais recentes</strong>
            <label>
              <span className="material-icons-sharp" aria-hidden="true">filter_list</span>
              <select
                value={feedFilter}
                onChange={(event) => setFeedFilter(event.target.value)}
                aria-label="Filtrar categoria"
              >
                {availableFeedFilters.map((filterItem) => (
                  <option key={filterItem.id} value={filterItem.id}>{feedFilterLabelMap[filterItem.id] ?? filterItem.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="community-summary" aria-label="Resumo do feed">
            {compactSummary.map((item) => (
              <span key={item} className="community-summary-item">{item}</span>
            ))}
          </div>

          {loading && (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[1, 2, 3].map((item) => (
                <div key={item} className="panel-card post-skeleton" style={{ minHeight: "120px" }} />
              ))}
            </div>
          )}

          {error && <p className="form-error" style={{ textAlign: "center" }}>{error}</p>}

          {!loading && posts.length === 0 && !error && (
            <div className="feed-empty">
              <span className="material-icons-sharp" aria-hidden="true" style={{ fontSize: "2.4rem", opacity: 0.7 }}>
                {feedFilter === "saved" ? "bookmark_border" : "inbox"}
              </span>
              <p className="empty-state-title" style={{ marginTop: "0.6rem" }}>
                {feedFilter === "saved"
                  ? "Ainda nao guardaste nenhuma publicacao."
                  : feedFilter === "official"
                    ? "Sem comunicados oficiais por agora."
                    : "Ainda nao ha publicacoes."}
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
            <button type="button" className="feed-load-more btn ghost" onClick={() => loadPosts(false)} disabled={loadingMore}>
              {loadingMore ? "A carregar..." : "Mostrar mais publicacoes"}
            </button>
          )}
        </section>

        <aside className="community-sidebar-column">
          <section className="panel-card community-side-card">
            <h3>Estatisticas</h3>
            {sidebarLoading ? (
              <p className="meta">A carregar indicadores...</p>
            ) : (
              <div className="community-stats-grid">
                <div><strong>{communityData.membersCount}</strong><span>Membros</span></div>
                <div><strong>{communityData.onlineNowCount}</strong><span>Online agora</span></div>
                <div><strong>{communityData.postsCount}</strong><span>Publicacoes</span></div>
                <div><strong>{communityData.commentsCount + communityData.reactionsCount}</strong><span>Interacoes</span></div>
              </div>
            )}
          </section>

          <section className="panel-card community-side-card">
            <h3>Proximos eventos</h3>
            {(communityData.upcomingEvents ?? []).length === 0 ? (
              <p className="meta">Sem eventos ativos neste momento.</p>
            ) : (
              <div className="community-events-list">
                {communityData.upcomingEvents.map((eventItem) => (
                  <article key={eventItem.id} className="community-event-item">
                    <div className="community-event-date">{formatEventDate(eventItem.endsAt)}</div>
                    <div>
                      <strong>{eventItem.title}</strong>
                      <small>{eventItem.authorName}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel-card community-side-card community-presence-card">
            <div className="community-side-card-header">
              <h3>Presença do sistema</h3>
              <label className="community-presence-window" htmlFor="presence-window-select">
                <span className="material-icons-sharp" aria-hidden="true">schedule</span>
                <select
                  id="presence-window-select"
                  value={presenceWindowMinutes}
                  onChange={(event) => setPresenceWindowMinutes(Number(event.target.value))}
                  aria-label="Janela de atividade"
                >
                  {PRESENCE_WINDOW_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option} min</option>
                  ))}
                </select>
              </label>
            </div>

            {sidebarLoading ? (
              <p className="meta">A carregar estado dos utilizadores...</p>
            ) : (
              <>
                <div className="community-presence-kpis">
                  <span className="community-presence-kpi online"><strong>{communityData.onlineNowCount}</strong> online</span>
                  <span className="community-presence-kpi offline"><strong>{communityData.offlineNowCount}</strong> offline</span>
                </div>

                <div className="community-presence-columns">
                  <div className="community-presence-group">
                    <span className="community-presence-label online">Online agora</span>
                    {(communityData.onlineMembers ?? []).length === 0 ? (
                      <p className="meta">Sem utilizadores online neste momento.</p>
                    ) : (
                      <div className="community-presence-list">
                        {communityData.onlineMembers.map((member) => (
                          <PresenceMemberRow key={member.id} member={member} />
                        ))}
                        {communityData.onlineNowCount > communityData.onlineMembers.length ? (
                          <span className="meta">e mais {communityData.onlineNowCount - communityData.onlineMembers.length} online</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="community-presence-group">
                    <span className="community-presence-label offline">Offline</span>
                    {(communityData.offlineMembers ?? []).length === 0 ? (
                      <p className="meta">Sem utilizadores offline visíveis.</p>
                    ) : (
                      <div className="community-presence-list">
                        {communityData.offlineMembers.map((member) => (
                          <PresenceMemberRow key={member.id} member={member} />
                        ))}
                        {communityData.offlineNowCount > communityData.offlineMembers.length ? (
                          <span className="meta">e mais {communityData.offlineNowCount - communityData.offlineMembers.length} offline</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}


