import { useEffect, useRef } from "react";

const SECURITY_STORAGE_KEY = "giva.settings.security";
const LAST_ACTIVITY_PREFIX = "giva.security.lastActivityAt";
const DEFAULT_TIMEOUT_MINUTES = 30;
const VALID_TIMEOUTS = new Set([1, 5, 15, 30, 60]);
const CHECK_INTERVAL_MS = 15000;

function readTimeoutMinutes() {
  if (typeof window === "undefined") {
    return DEFAULT_TIMEOUT_MINUTES;
  }

  try {
    const raw = window.localStorage.getItem(SECURITY_STORAGE_KEY);
    if (!raw) return DEFAULT_TIMEOUT_MINUTES;

    const parsed = JSON.parse(raw);
    const minutes = Number(parsed?.sessionTimeout);
    if (VALID_TIMEOUTS.has(minutes)) {
      return minutes;
    }
  } catch {
    // fallback abaixo
  }

  return DEFAULT_TIMEOUT_MINUTES;
}

function getLastActivityKey(userId) {
  return `${LAST_ACTIVITY_PREFIX}:${userId}`;
}

function readLastActivityAt(userId) {
  if (typeof window === "undefined" || !userId) return 0;
  const value = Number(window.localStorage.getItem(getLastActivityKey(userId)) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function writeLastActivityAt(userId, value) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(getLastActivityKey(userId), String(value));
}

function removeLastActivityAt(userId) {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.removeItem(getLastActivityKey(userId));
}

export function useSessionTimeout(userId, { enabled = true, onTimeout } = {}) {
  const timeoutTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    timeoutTriggeredRef.current = false;

    const ensureActivitySeed = () => {
      const existing = readLastActivityAt(userId);
      if (!existing) {
        writeLastActivityAt(userId, Date.now());
      }
      return readLastActivityAt(userId) || Date.now();
    };

    const getTimeoutMs = () => readTimeoutMinutes() * 60 * 1000;

    const triggerTimeout = async () => {
      if (timeoutTriggeredRef.current) return;
      timeoutTriggeredRef.current = true;

      try {
        await Promise.resolve(onTimeout?.());
      } finally {
        removeLastActivityAt(userId);
      }
    };

    const isExpired = () => {
      const lastActivityAt = readLastActivityAt(userId) || ensureActivitySeed();
      return Date.now() - lastActivityAt >= getTimeoutMs();
    };

    const markActivity = () => {
      if (timeoutTriggeredRef.current) return;
      if (isExpired()) {
        void triggerTimeout();
        return;
      }
      writeLastActivityAt(userId, Date.now());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      markActivity();
    };

    const handleStorageEvent = (event) => {
      if (event.key === getLastActivityKey(userId) || event.key === SECURITY_STORAGE_KEY) {
        if (isExpired()) {
          void triggerTimeout();
          return;
        }
        if (event.key === getLastActivityKey(userId) && event.newValue) {
          timeoutTriggeredRef.current = false;
        }
      }
    };

    const activityEvents = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll", "click"];

    ensureActivitySeed();

    if (isExpired()) {
      void triggerTimeout();
      return undefined;
    }

    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorageEvent);

    const intervalId = window.setInterval(() => {
      if (isExpired()) {
        void triggerTimeout();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [enabled, onTimeout, userId]);
}