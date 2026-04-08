import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthPanel } from "./auth/AuthPanel";
import { BuilderPanel } from "./builder/BuilderPanel";
import { DeliveriesPanel } from "./deliveries/DeliveriesPanel";
import { ProjectsPanel } from "./projects/ProjectsPanel";
import { StoragePanel } from "./storage/StoragePanel";
import { UsersPanel } from "./users/UsersPanel";
import { useSession } from "./shared/session/SessionContext";
import type { AuthResponse } from "./shared/types";

interface NavTab {
  path: string;
  label: string;
  requiresAuth: boolean;
}

const NAV_TABS: NavTab[] = [
  { path: "/auth", label: "Auth", requiresAuth: false },
  { path: "/users", label: "Users", requiresAuth: true },
  { path: "/projects", label: "Projects", requiresAuth: true },
  { path: "/deliveries", label: "Deliveries", requiresAuth: true },
  { path: "/builder", label: "Builder", requiresAuth: true },
  { path: "/storage", label: "Storage", requiresAuth: true },
];

export default function App(): JSX.Element {
  const {
    sessions,
    activeSession,
    activeSessionId,
    authWarning,
    addSession,
    setActiveSessionId,
    removeSession,
    clearSessions,
    clearAuthWarning,
  } = useSession();

  const location = useLocation();

  const handleAuthSuccess = (response: AuthResponse, label?: string) => {
    addSession(response, label);
  };

  const hasAuthenticatedSession = Boolean(activeSession);

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>DockUS Smoke Tester</h1>
        <p>
          Cliente funcional para validar Auth, RBAC y flujos de
          Projects/Deliveries/Storage/Builder.
        </p>
      </header>

      {authWarning ? (
        <div className="message warning row gap-8 align-center">
          <span>{authWarning}</span>
          <button className="btn ghost" onClick={clearAuthWarning}>
            Cerrar
          </button>
        </div>
      ) : null}

      <section className="card stack">
        <h3>Sesiones</h3>
        {sessions.length === 0 ? (
          <p className="hint">No hay sesiones activas. Usa Auth para entrar.</p>
        ) : (
          <>
            <div className="row gap-8 align-center">
              <label>
                Sesión activa
                <select
                  value={activeSessionId ?? ""}
                  onChange={(event) => setActiveSessionId(event.target.value)}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn ghost"
                disabled={!activeSessionId}
                onClick={() => {
                  if (activeSessionId) removeSession(activeSessionId);
                }}
              >
                Cerrar sesión activa
              </button>
              <button className="btn danger" onClick={clearSessions}>
                Cerrar todas
              </button>
            </div>
            {activeSession ? (
              <p className="hint">
                Usuario activo: <strong>{activeSession.email}</strong> / rol{" "}
                <strong>{activeSession.role}</strong>
              </p>
            ) : null}
          </>
        )}
      </section>

      <nav className="nav-tabs" aria-label="Módulos">
        {NAV_TABS.map((tab) => {
          const disabled = tab.requiresAuth && !hasAuthenticatedSession;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `tab ${isActive ? "active" : ""} ${disabled ? "disabled" : ""}`
              }
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
              aria-disabled={disabled}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      {!hasAuthenticatedSession && location.pathname !== "/auth" ? (
        <p className="message">Necesitas una sesión activa para este módulo.</p>
      ) : null}

      <main>
        <Routes>
          <Route
            path="/auth"
            element={<AuthPanel onAuthSuccess={handleAuthSuccess} />}
          />
          <Route
            path="/users"
            element={
              hasAuthenticatedSession ? (
                <UsersPanel session={activeSession} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/projects"
            element={
              hasAuthenticatedSession ? (
                <ProjectsPanel session={activeSession} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/deliveries"
            element={
              hasAuthenticatedSession ? (
                <DeliveriesPanel session={activeSession} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/builder"
            element={
              hasAuthenticatedSession ? (
                <BuilderPanel session={activeSession} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/storage"
            element={
              hasAuthenticatedSession ? (
                <StoragePanel session={activeSession} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </main>
    </div>
  );
}
