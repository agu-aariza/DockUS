/**
 * @fileoverview Gestión de estado de sesión y permisos (SessionContext).
 *
 * @module SessionContext
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAccessToken, setRefreshToken, subscribeAuthWarning, subscribeTokenUpdate } from '../api/http';
import type { SessionAuthPayload, SessionRecord } from "./session.types";
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
  addSession: (auth: SessionAuthPayload, label?: string) => SessionRecord;
  setActiveSessionId: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
  clearAuthWarning: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren): JSX.Element {
  const queryClient = useQueryClient();
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
    setAccessToken(activeSession?.accessToken ?? null);
    setRefreshToken(activeSession?.refreshToken ?? null);
  }, [activeSessionId, activeSession]);

  useEffect(() => {
    return subscribeAuthWarning((message) => {
      setAuthWarning(message);
    });
  }, []);

  // Listen for token updates from the auto-refresh interceptor
  useEffect(() => {
    const unsubscribe = subscribeTokenUpdate((newAccess, newRefresh) => {
      if (!activeSessionId) return;
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

  const addSession = useCallback((auth: SessionAuthPayload, label?: string): SessionRecord => {
    const created = createSessionRecord(auth, label);
    setSessions((prev) => [created, ...prev]);
    setActiveSessionIdState(created.id);
    queryClient.clear();
    return created;
  }, [queryClient]);

  const setActiveSessionId = useCallback((sessionId: string): void => {
    setActiveSessionIdState(sessionId);
    queryClient.clear();
  }, [queryClient]);

  const removeSession = useCallback((sessionId: string): void => {
    setSessions((prev) => {
      const next = prev.filter((session) => session.id !== sessionId);
      if (sessionId === activeSessionId) {
        setActiveSessionIdState(next[0]?.id ?? null);
        queryClient.clear();
      }
      return next;
    });
  }, [activeSessionId, queryClient]);

  const clearSessions = useCallback((): void => {
    setSessions([]);
    setActiveSessionIdState(null);
    setAccessToken(null);
    setRefreshToken(null);
    queryClient.clear();
  }, [queryClient]);

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
