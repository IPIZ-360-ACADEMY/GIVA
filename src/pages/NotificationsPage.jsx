import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  deleteNotification,
  listNotifications,
  markAllAsRead,
  markNotificationAsRead,
  subscribeToNotifications,
} from "../services/notificationsService.js";

const TYPE_META = {
  reaction:         { icon: "favorite",           color: "#e0245e", label: "Reação" },
  comment:          { icon: "chat_bubble",         color: "#1d9bf0", label: "Comentário" },
  share:            { icon: "share",               color: "#00ba7c", label: "Partilha" },
  follow:           { icon: "person_add",          color: "#7856ff", label: "Seguidor" },
  message:          { icon: "mail",                color: "#1d9bf0", label: "Mensagem" },
  security_mfa:     { icon: "verified_user",       color: "#0f766e", label: "Segurança" },
  announcement:     { icon: "campaign",            color: "#ff7a00", label: "Aviso" },
  post_approved:    { icon: "verified",            color: "#00ba7c", label: "Publicação" },
  company_approved: { icon: "business",            color: "#0f6d67", label: "Empresa" },
  internship_match: { icon: "work",                color: "#7856ff", label: "Estágio" },
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

function groupByDate(items) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const groups = { hoje: [], ontem: [], semana: [], antigas: [] };
  for (const n of items) {
    const d = new Date(n.created_at).toDateString();
    if (d === today) groups.hoje.push(n);
    else if (d === yesterday) groups.ontem.push(n);
    else if (new Date(n.created_at) >= weekAgo) groups.semana.push(n);
    else groups.antigas.push(n);
  }
  return groups;
}

function NotifItem({ notif, onRead, onDelete }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.announcement;
  const actor = notif.actor;

  function getLink() {
    if (notif.object_type === "post" && notif.object_id) return `/home#post-${notif.object_id}`;
    if (notif.object_type === "profile" && notif.object_id) return `/perfil-publico/${notif.object_id}`;
    if (notif.object_type === "message") return "/chat";
    if (notif.object_type === "vacancy") return "/estagios";
    return null;
  }

  const link = getLink();
  const content = (
    <div className={`notif-item${notif.read ? " read" : ""}`}>
      <div className="notif-icon-wrap" style={{ "--notif-color": meta.color }}>
        {actor?.avatar_url ? (
          <img src={actor.avatar_url} alt={actor.display_name} className="notif-actor-avatar" />
        ) : (
          <div className="notif-actor-fallback">
            {(actor?.display_name ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="notif-type-badge" style={{ background: meta.color }}>
          <span className="material-icons-sharp">{meta.icon}</span>
        </span>
      </div>
      <div className="notif-body">
        <p className="notif-title">{notif.title}</p>
        {notif.body && <p className="notif-excerpt">{notif.body}</p>}
        <span className="notif-time">{timeAgo(notif.created_at)}</span>
      </div>
      {!notif.read && <span className="notif-unread-dot" aria-label="Não lido" />}
    </div>
  );

  return (
    <div className="notif-item-wrap" role="listitem">
      {link ? (
        <Link to={link} className="notif-item-link" onClick={() => !notif.read && onRead(notif.id)}>
          {content}
        </Link>
      ) : (
        <button type="button" className="notif-item-link" onClick={() => !notif.read && onRead(notif.id)}>
          {content}
        </button>
      )}
      <button
        type="button"
        className="notif-delete-btn"
        onClick={() => onDelete(notif.id)}
        aria-label="Remover notificação"
      >
        <span className="material-icons-sharp">close</span>
      </button>
    </div>
  );
}

function NotifGroup({ title, items, onRead, onDelete }) {
  if (!items.length) return null;
  return (
    <section className="notif-group">
      <h3 className="notif-group-title">{title}</h3>
      <div role="list">
        {items.map((n) => (
          <NotifItem key={n.id} notif={n} onRead={onRead} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

export default function NotificationsPage() {
  const { user, resetNotifCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [actionError, setActionError] = useState("");
  const unsubRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      try {
        const data = await listNotifications(100);
        setNotifications(data);
        setActionError("");
        resetNotifCount?.();
      } catch (err) {
        setActionError(err?.message ?? "Não foi possível carregar as notificações.");
      }
      setLoading(false);
    }

    load();

    // Subscrição em tempo real para novas notificações
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribeToNotifications(user.id, async () => {
      try {
        const fresh = await listNotifications(100);
        setNotifications(fresh);
        setActionError("");
      } catch (err) {
        setActionError(err?.message ?? "Falha ao atualizar notificações em tempo real.");
      }
    });

    return () => unsubRef.current?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleRead(id) {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setActionError("");
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível marcar a notificação como lida.");
    }
  }

  async function handleDelete(id) {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setActionError("");
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível remover a notificação.");
    }
  }

  async function handleMarkAll() {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setActionError("");
      resetNotifCount?.();
    } catch (err) {
      setActionError(err?.message ?? "Não foi possível marcar todas como lidas.");
    }
  }

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => n.type === filter);

  const grouped = groupByDate(filtered);
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <main className="page page-notif">
        <div className="notif-page-header">
          <h1>Notificações</h1>
        </div>
        <div className="notif-loading">
          <span className="material-icons-sharp spin">sync</span>
          <span>A carregar notificações...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="page page-notif">
      <div className="notif-page-header">
        <div>
          <h1 className="notif-page-title">
            Notificações
            {unreadCount > 0 && <span className="notif-page-badge">{unreadCount}</span>}
          </h1>
          <p className="notif-page-sub">Todas as tuas interações e atualizações</p>
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
        </div>
        {unreadCount > 0 && (
          <button type="button" className="btn ghost sm" onClick={handleMarkAll}>
            <span className="material-icons-sharp">done_all</span>
            Marcar todas como lidas
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="notif-filters" role="group" aria-label="Filtrar notificações">
        {[
          { id: "all",      label: "Todas" },
          { id: "unread",   label: "Não lidas" },
          { id: "reaction", label: "Reações" },
          { id: "comment",  label: "Comentários" },
          { id: "follow",   label: "Seguidores" },
          { id: "message",  label: "Mensagens" },
          { id: "security_mfa", label: "Segurança" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`notif-filter-btn${filter === f.id ? " active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {f.id === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* Lista agrupada */}
      {filtered.length === 0 ? (
        <div className="notif-empty">
          <span className="material-icons-sharp">notifications_none</span>
          <h3>Nenhuma notificação</h3>
          <p>{filter === "all" ? "Ainda não tens notificações." : "Nenhum resultado para este filtro."}</p>
        </div>
      ) : (
        <div className="notif-list">
          <NotifGroup title="Hoje" items={grouped.hoje} onRead={handleRead} onDelete={handleDelete} />
          <NotifGroup title="Ontem" items={grouped.ontem} onRead={handleRead} onDelete={handleDelete} />
          <NotifGroup title="Esta semana" items={grouped.semana} onRead={handleRead} onDelete={handleDelete} />
          <NotifGroup title="Mais antigas" items={grouped.antigas} onRead={handleRead} onDelete={handleDelete} />
        </div>
      )}
    </main>
  );
}