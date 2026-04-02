import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { setAccessToken, subscribeAuthWarning } from '../api/http';
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

  useEffect(() => {
    setAccessToken(activeSession?.accessToken ?? null);
  }, [activeSession?.accessToken]);

  useEffect(() => {
    const unsubscribe = subscribeAuthWarning((message) => {
      setAuthWarning(message);
    });

    return unsubscribe;
  }, []);

  const addSession = (auth: AuthResponse, label?: string): SessionRecord => {
    const created = createSessionRecord(auth, label);
    setSessions((prev) => [created, ...prev]);
    setActiveSessionIdState(created.id);
    return created;
  };

  const setActiveSessionId = (sessionId: string): void => {
    setActiveSessionIdState(sessionId);
  };

  const removeSession = (sessionId: string): void => {
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== sessionId);
      if (sessionId === activeSessionId) {
        setActiveSessionIdState(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const clearSessions = (): void => {
    setSessions([]);
    setActiveSessionIdState(null);
    setAccessToken(null);
  };

  const clearAuthWarning = (): void => {
    setAuthWarning(null);
  };

  const value: SessionContextValue = {
    sessions,
    activeSessionId,
    activeSession,
    authWarning,
    addSession,
    setActiveSessionId,
    removeSession,
    clearSessions,
    clearAuthWarning,
  };

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
