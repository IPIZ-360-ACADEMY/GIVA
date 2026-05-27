import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  PENDING_STUDENT_OAUTH_STORAGE,
  getAuthProfile,
  getCurrentSession,
  getPendingStudentOauthTtlMs,
  isAuthEnabled,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from "../services/authService.js";
import { supabase } from "../lib/supabase.js";
import { getUnreadNotifCount, subscribeToNotifications } from "../services/notificationsService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";
import { resolveAccessProfile, typeFromRole } from "../utils/accessControl.js";

const AuthContext = createContext(null);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 10000;

function withTimeout(promise, timeoutMs, timeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    }),
  ]);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPhase, setLoadingPhase] = useState("idle");
  const [userProfile, setUserProfile] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const notifUnsubRef = useRef(null);
  const authEnabled = isAuthEnabled();

  const finalizePendingStudentOAuth = useCallback(async (user) => {
    if (!authEnabled || !user?.id) return;

    const raw = sessionStorage.getItem(PENDING_STUDENT_OAUTH_STORAGE);
    if (!raw) return;

    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
      return;
    }

    const createdAt = Number(pending?.createdAt ?? 0);
    const ttlMs = getPendingStudentOauthTtlMs();
    const expired = Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt > ttlMs;
    if (expired) {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
      return;
    }

    const processNumber = normalizeStudentProcessNumber(pending?.processNumber);
    if (!processNumber) {
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
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
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
    } catch (error) {
      console.error("Falha ao concluir cadastro OAuth de aluno:", error);
      sessionStorage.removeItem(PENDING_STUDENT_OAUTH_STORAGE);
    }
  }, [authEnabled]);

  const fetchUserProfile = useCallback(async (userId) => {
    if (!userId || !authEnabled) {
      setUserProfile(null);
      return null;
    }

    try {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, type, display_name, avatar_url, bio, moderation")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setUserProfile(data);
        return data;
      }

      // user_profiles row missing — derive type from JWT role so access control works
      const ap = await getAuthProfile();
      const derivedType = typeFromRole(ap?.role);
      const fallbackProfile = {
        id: userId,
        type: derivedType,
        display_name: null,
        avatar_url: null,
        bio: null,
        moderation: null,
      };
      setUserProfile(fallbackProfile);
      return fallbackProfile;
    } catch {
      setUserProfile(null);
      return null;
    }
  }, [authEnabled]);

  useEffect(() => {
    let active = true;

    async function resolveSessionState(nextSession) {
      setLoading(true);
      setLoadingPhase("session");
      setSession(nextSession);

      if (!nextSession?.user?.id) {
        setUserProfile(null);
        setLoadingPhase("ready");
        setLoading(false);
        return;
      }

      setLoadingPhase("profile");
      await finalizePendingStudentOAuth(nextSession.user);
      if (!active) return;

      await fetchUserProfile(nextSession.user.id);
      if (!active) return;

      setLoadingPhase("ready");
      setLoading(false);
    }

    async function bootstrap() {
      if (!authEnabled) {
        setLoadingPhase("ready");
        setLoading(false);
        return;
      }

      try {
        const nextSession = await withTimeout(
          getCurrentSession(),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
          "Timeout ao validar sessao",
        );
        if (!active) {
          return;
        }
        await resolveSessionState(nextSession);
      } catch (error) {
        if (!active) {
          return;
        }
        console.warn("Falha ao validar sessao no arranque:", error?.message ?? error);
        setSession(null);
        setUserProfile(null);
      } finally {
        if (active) {
          setLoadingPhase("ready");
          setLoading(false);
        }
      }
    }

    bootstrap();

    const { data } = onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      void resolveSessionState(nextSession);
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

  // Funções estáveis extraídas para evitar que o useMemo recrie o objeto de contexto
  // apenas por causa de closures inline — o referência estável reduz re-renders
  // em consumidores que usam estas funções como dependência de useEffect/useCallback.
  const resetNotifCount = useCallback(() => setNotifCount(0), []);
  const refreshProfile = useCallback(() => {
    if (session?.user?.id) fetchUserProfile(session.user.id);
  }, [session?.user?.id, fetchUserProfile]);

  const value = useMemo(() => {
    const user = session?.user ?? null;

    return {
      authEnabled,
      loading,
      loadingPhase,
      session,
      user,
      userProfile,
      notifCount,
      resetNotifCount,
      refreshProfile,
      isAuthenticated: Boolean(session?.access_token),
      authProfile: getAuthProfile(user),
      signInWithPassword,
      signOut,
    };
  }, [authEnabled, loading, loadingPhase, session, userProfile, notifCount, resetNotifCount, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

/**
 * Hook de conveniência: devolve o perfil de acesso completo (isAdmin, isStudentUser, etc.)
 * combinando o JWT role (app_metadata) com o type da tabela user_profiles.
 * Usa resolveAccessProfile para garantir consistência em toda a aplicação.
 */
export function useAccessProfile() {
  const { authProfile, userProfile } = useAuth();
  return useMemo(
    () => resolveAccessProfile({ role: authProfile?.role, type: userProfile?.type }),
    [authProfile?.role, userProfile?.type],
  );
}