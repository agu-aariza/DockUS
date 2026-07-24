import type { AuthResponse, SessionRecord } from "../../features/auth/types";

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

/**
 * El accessToken nunca se persiste (FE-MED-04): es un bearer de vida corta
 * que, filtrado vía XSS, da acceso inmediato a la API sin ningún paso extra.
 * El refreshToken sí se persiste —hace falta para rehidratar sesión sin
 * volver a iniciar sesión— pero solo sirve para canjear un accessToken nuevo
 * en /auth/refresh, no para llamar al resto de la API directamente.
 *
 * Al recargar la página, la sesión rehidratada trae accessToken vacío; la
 * primera petición autenticada recibe 401 y el interceptor de http.ts la
 * refresca y reintenta solo — el mismo camino que ya usa cuando el token
 * expira a mitad de sesión, no una ruta nueva.
 */
export function writeSessions(sessions: SessionRecord[]): void {
  const sanitized = sessions.map((session) => ({ ...session, accessToken: '' }));
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sanitized));
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
