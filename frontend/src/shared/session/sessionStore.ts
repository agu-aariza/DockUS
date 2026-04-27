import type { AuthResponse, SessionRecord } from '../types';

const SESSIONS_KEY = 'dockus_console_sessions';
const ACTIVE_SESSION_KEY = 'dockus_console_active_session';

export function readSessions(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSessions(sessions: SessionRecord[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function readActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function writeActiveSessionId(sessionId: string | null): void {
  if (!sessionId) {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }

  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
}

export function createSessionRecord(
  auth: AuthResponse,
  label?: string,
): SessionRecord {
  const fallbackLabel = `${auth.user.email} (${auth.user.role})`;
  return {
    id: crypto.randomUUID(),
    label: label?.trim() || fallbackLabel,
    userId: auth.user.id,
    email: auth.user.email,
    role: auth.user.role,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    createdAt: new Date().toISOString(),
  };
}
