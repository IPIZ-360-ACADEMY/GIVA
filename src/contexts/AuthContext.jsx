import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  PENDING_STUDENT_OAUTH_KEY,
  getAuthProfile,
  getCurrentSession,
  isAuthEnabled,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from "../services/authService.js";
import { supabase } from "../lib/supabase.js";
import { getUnreadNotifCount, subscribeToNotifications } from "../services/notificationsService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const notifUnsubRef = useRef(null);
  const authEnabled = isAuthEnabled();

  const finalizePendingStudentOAuth = useCallback(async (user) => {
    if (!authEnabled || !user?.id) return;

    const raw = sessionStorage.getItem(PENDING_STUDENT_OAUTH_KEY);
    if (!raw) return;

    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
      return;
    }

    const createdAt = Number(pending?.createdAt ?? 0);
    const expired = Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt > 30 * 60 * 1000;
    if (expired) {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
      return;
    }

    const processNumber = normalizeStudentProcessNumber(pending?.processNumber);
    if (!processNumber) {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
      return;
    }

    try {
      const fallbackName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "Aluno";
      const displayName = String(pending?.fullName ?? fallbackName).trim() || fallbackName;

      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({ id: user.id, type: "student", display_name: displayName }, { onConflict: "id" });
      if (profileError) throw profileError;

      const payload = { id: user.id, process_number: processNumber };
      if (pending?.studentId) payload.student_id = pending.studentId;

      let { error: studentError } = await supabase
        .from("student_accounts")
        .upsert(payload, { onConflict: "id" });

      const missingStudentIdColumn = studentError?.message?.includes("column") && studentError?.message?.includes("student_id");
      if (missingStudentIdColumn) {
        ({ error: studentError } = await supabase
          .from("student_accounts")
          .upsert({ id: user.id, process_number: processNumber }, { onConflict: "id" }));
      }

      if (studentError) throw studentError;
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
    } catch (error) {
      console.error("Falha ao concluir cadastro OAuth de aluno:", error);
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_KEY);
    }
  }, [authEnabled]);

  const fetchUserProfile = useCallback(async (userId) => {
    if (!userId || !authEnabled) return;
    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, type, display_name, avatar_url, bio, moderation")
        .eq("id", userId)
        .maybeSingle();
      setUserProfile(data ?? null);
    } catch {
      setUserProfile(null);
    }
  }, [authEnabled]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!authEnabled) {
        setLoading(false);
        return;
      }

      try {
        const nextSession = await getCurrentSession();
        if (!active) {
          return;
        }
        setSession(nextSession);
        if (nextSession?.user?.id) {
          await finalizePendingStudentOAuth(nextSession.user);
          await fetchUserProfile(nextSession.user.id);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const { data } = onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }
      setSession(nextSession);
      setLoading(false);
      if (nextSession?.user?.id) {
        (async () => {
          await finalizePendingStudentOAuth(nextSession.user);
          if (active) {
            await fetchUserProfile(nextSession.user.id);
          }
        })();
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authEnabled, fetchUserProfile, finalizePendingStudentOAuth]);

  // Carrega contagem inicial e subscreve notificações em tempo real
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !authEnabled) {
      setNotifCount(0);
      return;
    }
    getUnreadNotifCount().then(setNotifCount).catch(() => {});

    if (notifUnsubRef.current) notifUnsubRef.current();
    notifUnsubRef.current = subscribeToNotifications(userId, () => {
      setNotifCount((c) => c + 1);
    });
    return () => notifUnsubRef.current?.();
  }, [session?.user?.id, authEnabled]);

  const value = useMemo(() => {
    const user = session?.user ?? null;

    return {
      authEnabled,
      loading,
      session,
      user,
      userProfile,
      notifCount,
      resetNotifCount: () => setNotifCount(0),
      refreshProfile: () => { if (session?.user?.id) fetchUserProfile(session.user.id); },
      isAuthenticated: Boolean(session?.access_token),
      authProfile: getAuthProfile(user),
      signInWithPassword,
      signOut,
    };
  }, [authEnabled, loading, session, userProfile, notifCount, fetchUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}