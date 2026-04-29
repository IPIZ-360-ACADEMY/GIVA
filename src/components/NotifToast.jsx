import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { subscribeToNotifications } from "../services/notificationsService.js";
import { supabase } from "../lib/supabase.js";

const TYPE_META = {
  reaction:         { icon: "favorite",    color: "#e0245e", label: "Reação" },
  comment:          { icon: "chat_bubble", color: "#1d9bf0", label: "Comentário" },
  share:            { icon: "share",       color: "#00ba7c", label: "Partilha" },
  follow:           { icon: "person_add",  color: "#7856ff", label: "Seguidor" },
  message:          { icon: "mail",        color: "#0f6d67", label: "Mensagem" },
  announcement:     { icon: "campaign",    color: "#ff7a00", label: "Aviso" },
  post_approved:    { icon: "verified",    color: "#00ba7c", label: "Publicação" },
  company_approved: { icon: "business",    color: "#0f6d67", label: "Empresa" },
  internship_match: { icon: "work",        color: "#7856ff", label: "Estágio" },
};

// AudioContext singleton — reutilizado para evitar suspensão pelo browser
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

async function playNotifSound(type) {
  try {
    const ctx = getAudioCtx();
    // Browser suspende o contexto após inactividade — resumir antes de tocar
    if (ctx.state === "suspended") await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "message") {
      // Dois tons curtos — estilo WhatsApp
      osc.type = "sine";
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(820, now + 0.1);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.38);
    } else {
      // Tom suave para outras notificações
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch { /* AudioContext indisponível */ }
}

function NotifPopup({ notif, onClose, onAction }) {
  const meta = TYPE_META[notif.type] ?? TYPE_META.announcement;
  const actor = notif.actor;
  const actorName = actor?.display_name ?? "GIVA";
  const actorAvatar = actor?.avatar_url;

  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="notif-popup" role="alert" aria-live="polite">
      <div className="notif-popup-accent" style={{ background: meta.color }} />
      <div className="notif-popup-avatar">
        {actorAvatar ? (
          <img src={actorAvatar} alt={actorName} />
        ) : (
          <div className="notif-popup-avatar-fallback" style={{ background: meta.color }}>
            {actorName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="notif-popup-type-icon" style={{ background: meta.color }}>
          <span className="material-icons-sharp">{meta.icon}</span>
        </span>
      </div>
      <button type="button" className="notif-popup-body" onClick={onAction}>
        <span className="notif-popup-label" style={{ color: meta.color }}>{meta.label}</span>
        <p className="notif-popup-title">{notif.title}</p>
        {notif.body && <p className="notif-popup-excerpt">{notif.body}</p>}
      </button>
      <button type="button" className="notif-popup-close" onClick={onClose} aria-label="Fechar">
        <span className="material-icons-sharp">close</span>
      </button>
      <div className="notif-popup-progress" />
    </div>
  );
}

export default function NotifToastContainer({ soundEnabled = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const unsubRef = useRef(null);

  const fetchActor = useCallback(async (actorId) => {
    if (!actorId) return null;
    const { data } = await supabase
      .from("user_profiles")
      .select("id, display_name, avatar_url")
      .eq("id", actorId)
      .maybeSingle();
    return data;
  }, []);

  useEffect(() => {
    if (!user) return;
    if (unsubRef.current) unsubRef.current();

    unsubRef.current = subscribeToNotifications(user.id, async (payload) => {
      const notif = payload.new ?? payload;
      if (!notif?.id) return;

      const actor = await fetchActor(notif.actor_id);
      const enriched = { ...notif, actor };

      if (soundEnabled) playNotifSound(notif.type);

      setQueue((prev) => [...prev.slice(-2), { ...enriched, _key: Date.now() }]);
    });

    return () => unsubRef.current?.();
  }, [user, soundEnabled, fetchActor]);

  function dismiss(key) {
    setQueue((prev) => prev.filter((n) => n._key !== key));
  }

  function navigate_to(notif) {
    dismiss(notif._key);
    if (notif.object_type === "post" && notif.object_id) navigate(`/home#post-${notif.object_id}`);
    else if (notif.object_type === "profile" && notif.object_id) navigate(`/perfil-publico/${notif.object_id}`);
    else if (notif.type === "message" && notif.object_id) navigate(`/chat?conv=${notif.object_id}`);
    else if (notif.object_type === "message") navigate("/chat");
    else navigate("/notificacoes");
  }

  if (!queue.length) return null;

  return (
    <div className="notif-toast-stack" aria-label="Notificações">
      {queue.map((n) => (
        <NotifPopup
          key={n._key}
          notif={n}
          onClose={() => dismiss(n._key)}
          onAction={() => navigate_to(n)}
        />
      ))}
    </div>
  );
}
