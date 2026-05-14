import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

const DEFAULT_HEARTBEAT_MS = 30000;
const DEFAULT_ACTIVITY_THROTTLE_MS = 10000;

function isoNow() {
  return new Date().toISOString();
}

export function usePresenceHeartbeat(
  userId,
  { enabled = true, heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS, activityThrottleMs = DEFAULT_ACTIVITY_THROTTLE_MS } = {}
) {
  const lastHeartbeatAtRef = useRef(0);
  const lastStatusRef = useRef("offline");

  useEffect(() => {
    if (!enabled || !userId || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    let cancelled = false;

    const writePresence = async (status, force = false) => {
      if (cancelled) return;

      const now = Date.now();
      if (!force && status === "online" && now - lastHeartbeatAtRef.current < activityThrottleMs) {
        return;
      }

      lastHeartbeatAtRef.current = now;
      lastStatusRef.current = status;

      const { error } = await supabase
        .from("user_presence")
        .upsert(
          {
            user_id: userId,
            last_seen_at: isoNow(),
            status,
          },
          { onConflict: "user_id" }
        );

      if (error && !cancelled) {
        console.warn("Falha ao atualizar presença:", error);
      }
    };

    const setOnline = (force = false) => {
      void writePresence("online", force);
    };

    const setOffline = () => {
      void writePresence("offline", true);
    };

    const handleActivity = () => {
      setOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setOffline();
        return;
      }
      setOnline(true);
    };

    const handlePageHide = () => {
      setOffline();
    };

    setOnline(true);

    const activityEvents = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll", "focus"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setOnline(true);
      }
    }, heartbeatIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);

      if (lastStatusRef.current === "online") {
        setOffline();
      }
    };
  }, [activityThrottleMs, enabled, heartbeatIntervalMs, userId]);
}