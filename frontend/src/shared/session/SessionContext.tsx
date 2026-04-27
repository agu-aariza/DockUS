import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { setAccessToken, setRefreshToken, subscribeAuthWarning, subscribeTokenUpdate } from '../api/http';
import type { AuthResponse, SessionRecord } from '../types';
import {
  createSessionRecord,
  readActiveSessionId,
  readSessions,
  writeActiveSessionId,
  writeSessions,
} from './sessionStore';

interface SessionContextValue {
  sessions: SessionRecord[];
  activeSessionId: string | null;
  activeSession: SessionRecord | null;
  authWarning: string | null;
  addSession: (auth: AuthResponse, label?: string) => SessionRecord;
  setActiveSessionId: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
  clearAuthWarning: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren): JSX.Element {
  const [sessions, setSessions] = useState<SessionRecord[]>(() => readSessions());
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(() =>
    readActiveSessionId(),
  );
  const [authWarning, setAuthWarning] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  useEffect(() => {
    writeSessions(sessions);
  }, [sessions]);

  useEffect(() => {
    writeActiveSessionId(activeSessionId);
  }, [activeSessionId]);

  // Sync both tokens to the HTTP layer whenever the active session changes
  useEffect(() => {
    setAccessToken(activeSession?.accessToken ?? null);
    setRefreshToken(activeSession?.refreshToken ?? null);
  }, [activeSession?.accessToken, activeSession?.refreshToken]);

  useEffect(() => {
    const unsubscribe = subscribeAuthWarning((message) => {
      setAuthWarning(message);
    });

    return unsubscribe;
  }, []);

  // Listen for token updates from the auto-refresh interceptor
  useEffect(() => {
    const unsubscribe = subscribeTokenUpdate((newAccess, newRefresh) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id === activeSessionId) {
            return {
              ...session,
              accessToken: newAccess,
              refreshToken: newRefresh,
            };
          }
          return session;
        }),
      );
    });

    return unsubscribe;
  }, [activeSessionId]);

  const addSession = useCallback((auth: AuthResponse, label?: string): SessionRecord => {
    const created = createSessionRecord(auth, label);
    setSessions((prev) => [created, ...prev]);
    setActiveSessionIdState(created.id);
    return created;
  }, []);

  const setActiveSessionId = useCallback((sessionId: string): void => {
    setActiveSessionIdState(sessionId);
  }, []);

  const removeSession = useCallback((sessionId: string): void => {
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== sessionId);
      if (sessionId === activeSessionId) {
        setActiveSessionIdState(next[0]?.id ?? null);
      }
      return next;
    });
  }, [activeSessionId]);

  const clearSessions = useCallback((): void => {
    setSessions([]);
    setActiveSessionIdState(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const clearAuthWarning = useCallback((): void => {
    setAuthWarning(null);
  }, []);

  const value: SessionContextValue = useMemo(() => ({
    sessions,
    activeSessionId,
    activeSession,
    authWarning,
    addSession,
    setActiveSessionId,
    removeSession,
    clearSessions,
    clearAuthWarning,
  }), [sessions, activeSessionId, activeSession, authWarning, addSession, setActiveSessionId, removeSession, clearSessions, clearAuthWarning]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider.');
  }

  return context;
}
