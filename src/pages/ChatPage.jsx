import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getConversations,
  getMessages,
  getOrCreateConversation,
  getOtherReadAt,
  markAsRead,
  sendMessage,
  subscribeToConversations,
  subscribeToMessages,
  subscribeToReadReceipts,
} from "../services/chatService.js";
import { searchProfiles } from "../services/profilesService.js";

function Avatar({ name, src, size = 36 }) {
  const initials = (name ?? "?").slice(0, 1).toUpperCase();
  return (
    <div className="post-avatar post-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.45, borderRadius: "50%", flexShrink: 0, overflow: "hidden" }}>
      {src ? (
        <img
          src={src}
          alt={name ?? "Avatar"}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget.parentElement;
            if (fallback) fallback.textContent = initials;
          }}
        />
      ) : initials}
    </div>
  );
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                       

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function ConversationItem({ conv, active, onClick, currentUserId }) {
  const others = (conv.other_participants ?? []).filter(
    (p) => p.profile && p.user_id !== currentUserId
  );
  const other = others[0]?.profile;
  const name = other?.display_name ?? "Utilizador";
  const updatedAt = conv.last_message_at ?? conv.conversation?.updated_at;
  const preview = conv.last_message_preview?.trim()
    ? conv.last_message_preview
    : "Sem mensagens ainda";
  const unreadCount = Number(conv.unread_count ?? 0);

  return (
    <button type="button" className={`conv-item${active ? " active" : ""}`} onClick={onClick}>
      <Avatar name={name} src={other?.avatar_url} size={44} />
      <div className="conv-item-info">
        <div className="conv-item-row">
          <strong>{name}</strong>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
            <span className="conv-item-time">{timeAgo(updatedAt)}</span>
            {unreadCount > 0 && <span className="chat-unread-pill">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </div>
        </div>
        <span className="conv-item-preview">{preview}</span>
      </div>
    </button>
  );
}

function ChatWindow({ conversationId, currentUserId, otherProfile, onBackToList, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [windowError, setWindowError] = useState("");
  const [otherReadAt, setOtherReadAt] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const unsubRef = useRef(null);
  const receiptUnsubRef = useRef(null);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await getMessages(conversationId);
      setMessages(data);
      await markAsRead(conversationId);
      setWindowError("");
    } catch (err) {
      setWindowError(err?.message ?? "Não foi possível carregar as mensagens.");
    }
    finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setOtherReadAt(null);
    loadMessages();
    if (unsubRef.current) unsubRef.current();
    if (!conversationId) return;
    unsubRef.current = subscribeToMessages(conversationId, async (payload) => {
      if (!payload.new) return;
      const data = await getMessages(conversationId);
      setMessages(data);
      await markAsRead(conversationId);
      onMessageSent?.();
    });
    return () => unsubRef.current?.();
  }, [conversationId, loadMessages, onMessageSent]);

  // Carregar e subscrever read receipts do outro participante
  useEffect(() => {
    if (!conversationId) return;
    getOtherReadAt(conversationId).then(setOtherReadAt);
    if (receiptUnsubRef.current) receiptUnsubRef.current();
    receiptUnsubRef.current = subscribeToReadReceipts(conversationId, currentUserId, (readAt) => {
      setOtherReadAt(readAt);
    });
    return () => receiptUnsubRef.current?.();
  }, [conversationId, currentUserId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (conversationId) inputRef.current?.focus(); }, [conversationId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() || !conversationId || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(conversationId, text.trim());
      setMessages((prev) => [...prev, msg]);
      setText("");
      inputRef.current?.focus();
      setWindowError("");
      onMessageSent?.();
    } catch (err) {
      setWindowError(err?.message ?? "Não foi possível enviar a mensagem.");
    }
    setSending(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
  }

  if (!conversationId) {
    return (
      <div className="chat-window chat-window-empty">
        <span className="material-icons-sharp" style={{ fontSize: "3rem", color: "var(--primary)", opacity: 0.35 }}>chat_bubble_outline</span>
        <p>Seleciona uma conversa ou pesquisa um utilizador para começar</p>
      </div>
    );
  }

  const contactName = otherProfile?.display_name ?? "Conversa";

  return (
    <div className="chat-window">
      <div className="chat-window-header">
        <button type="button" className="chat-back-btn" onClick={onBackToList} aria-label="Voltar a lista">
          <span className="material-icons-sharp">arrow_back</span>
        </button>
        <Avatar name={contactName} src={otherProfile?.avatar_url} size={36} />
        <div className="chat-window-header-info">
          <strong>{contactName}</strong>
          {otherProfile?.type && <small className={`chat-type-badge badge-${otherProfile.type}`}>{otherProfile.type}</small>}
        </div>
      </div>

      <div className="chat-messages">
        {windowError && (
          <div className="chat-empty-state" style={{ color: "var(--danger, #e53e3e)", marginBottom: "0.75rem" }} role="alert">
            <span className="material-icons-sharp">error_outline</span>
            <p>{windowError}</p>
          </div>
        )}
        {loading && <div className="chat-loading"><span className="material-icons-sharp" style={{ animation: "spin 1s linear infinite" }}>hourglass_top</span></div>}
        {!loading && messages.length === 0 && (
          <div className="chat-no-messages">
            <span className="material-icons-sharp" style={{ fontSize: "2rem", color: "var(--primary)", opacity: 0.4 }}>waving_hand</span>
            <p>Sem mensagens ainda. Diz olá!</p>
          </div>
        )}
        {messages.map((m, idx) => {
          const isOwn = m.sender?.id === currentUserId;

          // Calcular estado de leitura apenas para mensagens próprias
          let receiptIcon = null;
          if (isOwn) {
            const msgDate = new Date(m.created_at);
            const readDate = otherReadAt ? new Date(otherReadAt) : null;
            const isSeen = readDate && msgDate <= readDate;

            // Mostrar "Visto HH:MM" apenas na última mensagem própria já vista
            const isLastSeenOwnMsg = isSeen && messages.slice(idx + 1).every(
              (next) => next.sender?.id !== currentUserId || !readDate || new Date(next.created_at) > readDate
            );

            if (isLastSeenOwnMsg) {
              receiptIcon = (
                <span className="chat-receipt chat-receipt-seen" title={`Visto às ${readDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`}>
                  <span className="material-icons-sharp">done_all</span>
                  <span className="chat-receipt-label">Visto {readDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              );
            } else if (isSeen) {
              receiptIcon = (
                <span className="chat-receipt chat-receipt-seen" title="Visto">
                  <span className="material-icons-sharp">done_all</span>
                </span>
              );
            } else {
              receiptIcon = (
                <span className="chat-receipt chat-receipt-sent" title="Enviado">
                  <span className="material-icons-sharp">done</span>
                </span>
              );
            }
          }

          return (
            <div key={m.id} className={`chat-bubble${isOwn ? " own" : ""}`}>
              {!isOwn && <Avatar name={m.sender?.display_name} src={m.sender?.avatar_url} size={28} />}
              <div className="chat-bubble-content">
                <p>{m.content}</p>
                <div className="chat-bubble-meta">
                  <span className="chat-time">{new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                  {receiptIcon}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSend}>
        <input ref={inputRef} type="text" placeholder="Escreve uma mensagem..." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown} maxLength={2000} autoComplete="off" />
        <button type="submit" className="chat-send-btn" disabled={sending || !text.trim()}>
          <span className="material-icons-sharp">send</span>
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeOtherProfile, setActiveOtherProfile] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convError, setConvError] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [startingChat, setStartingChat] = useState(false);
  const [mobileView, setMobileView] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef(null);
  const convUnsubRef = useRef(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setConvError(null);
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error("[ChatPage] getConversations error:", err);
      setConvError(err?.message ?? "Erro ao carregar conversas");
    } finally {
      setLoadingConvs(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    convUnsubRef.current = subscribeToConversations(user.id, () => { loadConversations(); });
    return () => convUnsubRef.current?.();
  }, [user, loadConversations]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadConversations();
    const withUserId = searchParams.get("with");
    const convId = searchParams.get("conv");
    if (withUserId) {
      getOrCreateConversation(withUserId)
        .then((id) => { setActiveConvId(id); setMobileView("chat"); })
        .catch((err) => {
          setChatError(err?.message ?? "Não foi possível abrir a conversa solicitada.");
        });
    } else if (convId) {
      // Abrir conversa diretamente a partir de uma notificação de mensagem
      setActiveConvId(convId);
      setMobileView("chat");
    }
  }, [user, navigate, searchParams, loadConversations]);

  function handleSearch(e) {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProfiles(q.trim(), 8);
        setSearchResults(results.filter((r) => r.id !== user.id));
        setChatError(null);
      } catch (err) {
        setChatError(err?.message ?? "Não foi possível pesquisar utilizadores.");
      }
      setSearching(false);
    }, 400);
  }

  async function handleStartChat(profile) {
    setChatError(null);
    setStartingChat(true);
    try {
      const convId = await getOrCreateConversation(profile.id);
      setActiveConvId(convId);
      setActiveOtherProfile(profile);
      setSearchQuery("");
      setSearchResults([]);
      setMobileView("chat");
      await loadConversations();
    } catch (err) {
      setChatError(err?.message ?? "Erro ao abrir conversa. Tenta de novo.");
    } finally {
      setStartingChat(false);
    }
  }

  // Sincronizar activeOtherProfile sempre que a conversa activa ou a lista mudar
  useEffect(() => {
    if (!activeConvId || !conversations.length) return;
    const conv = conversations.find((c) => c.conversation_id === activeConvId);
    if (!conv) return;
    const other = (conv.other_participants ?? []).find((p) => p.profile && p.user_id !== user?.id)?.profile ?? null;
    if (other) setActiveOtherProfile(other);
  }, [activeConvId, conversations, user]);

  function handleSelectConv(conv) {
    const other = (conv.other_participants ?? []).find((p) => p.profile && p.user_id !== user?.id)?.profile ?? null;
    setActiveConvId(conv.conversation_id);
    setActiveOtherProfile(other);
    setMobileView("chat");
  }

  return (
    <div className="chat-page">
      <div className="chat-topbar">
        <button type="button" className="chat-nav-back" onClick={() => navigate(-1)} aria-label="Voltar">
          <span className="material-icons-sharp">arrow_back</span>
        </button>
        <span className="chat-topbar-title">Mensagens</span>
        {startingChat && <span className="chat-topbar-loading"><span className="material-icons-sharp" style={{ fontSize: "1rem", animation: "spin 1s linear infinite" }}>sync</span></span>}
        {chatError && <span className="chat-topbar-error" role="alert"><span className="material-icons-sharp" style={{ fontSize: "1rem" }}>error_outline</span>{chatError}</span>}
      </div>

      <div className="chat-body">
        <aside className={`chat-sidebar${mobileView === "chat" ? " mobile-hidden" : ""}`}>
          <div className="chat-sidebar-header">
            <div className="chat-sidebar-title">Mensagens</div>
            <div className="chat-search">
              <span className="material-icons-sharp chat-search-icon">search</span>
              <input type="search" placeholder="Pesquisar utilizadores..." value={searchQuery} onChange={handleSearch} />
              {searching && <span className="chat-search-spinner"><span className="material-icons-sharp" style={{ fontSize: "0.85rem", animation: "spin 0.8s linear infinite" }}>sync</span></span>}
            </div>
            {searchResults.length > 0 && (
              <div className="chat-search-results">
                {searchResults.map((r) => (
                  <button key={r.id} type="button" className="chat-search-result-item" onClick={() => handleStartChat(r)} disabled={startingChat}>
                    <Avatar name={r.display_name} src={r.avatar_url} size={32} />
                    <div>
                      <strong>{r.display_name}</strong>
                      <small className={`chat-type-badge badge-${r.type}`}>{r.type}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="chat-conv-list">
            {loadingConvs && (
              <div className="chat-conv-loading">
                <span className="material-icons-sharp" style={{ animation: "spin 1s linear infinite", fontSize: "1.2rem", color: "var(--primary)" }}>sync</span>
                <span>A carregar...</span>
              </div>
            )}
            {!loadingConvs && convError && (
              <div className="chat-empty-state" style={{ color: "var(--danger, #e53e3e)" }}>
                <span className="material-icons-sharp">error_outline</span>
                <p>Erro ao carregar</p>
                <small>{convError}</small>
                <button type="button" className="btn sm" style={{ marginTop: "8px" }} onClick={loadConversations}>Tentar de novo</button>
              </div>
            )}
            {!loadingConvs && !convError && conversations.length === 0 && (
              <div className="chat-empty-state">
                <span className="material-icons-sharp">chat_bubble_outline</span>
                <p>Ainda sem conversas</p>
                <small>Pesquisa um utilizador para começar</small>
              </div>
            )}
            {conversations.map((conv) => (
              <ConversationItem key={conv.conversation_id} conv={conv} active={activeConvId === conv.conversation_id} onClick={() => handleSelectConv(conv)} currentUserId={user?.id} />
            ))}
          </div>
        </aside>

        <div className={`chat-main${mobileView === "list" ? " mobile-hidden" : ""}`}>
          <ChatWindow conversationId={activeConvId} currentUserId={user?.id} otherProfile={activeOtherProfile} onBackToList={() => setMobileView("list")} onMessageSent={loadConversations} />
        </div>
      </div>
    </div>
  );
}