/**
 * @fileoverview Componente raíz de enrutamiento y disposición de la aplicación React (React Router 7).
 *
 * @description
 * Enruta las vistas principales según el rol del usuario autenticado (`STUDENT`, `TEACHER`, `ADMIN`).
 * Carga perezosamente (React `lazy` + `Suspense`) todos los paneles principales para optimizar el bundle inicial:
 * - Alumnos: `StudentWorkspacePanel`, `StudentProfilePanel`.
 * - Docentes: `TeacherHomePanel`, `TeacherDeliveriesPanel`, `TeacherProjectsPanel`, `TeacherGroupsPanel`.
 * - Admin: `UsersPanel`, `StoragePanel`, `LlmConfigPanel`, `TeacherRuntimePanel`.
 *
 * @module MainAppContainer
 */

import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import React, { useEffect, useState, Suspense, lazy } from "react";
import { AuthPanel } from "./auth/AuthPanel";
import { LandingPage } from "./landing/LandingPage";
import { AppShell } from "./shared/components/ui/AppShell";
import { WorkspaceBar } from "./app/workspace/WorkspaceBar";
import { CommandPalette } from "./app/components/CommandPalette";
import { useSession } from "./shared/session/SessionContext";
import { authApi } from "./auth/api/authApi";
import type { AuthResponse } from "./features/auth/types";
import { useToast } from "./shared/toast/ToastContext";
import { RiSpyLine, RiLoader4Line } from "react-icons/ri";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";

/** Rutas accesibles sin sesión. Todo lo demás exige autenticación. */
const PUBLIC_PATHS = ["/", "/acceso", "/auth"];

// Lazy-loaded route components (Code Splitting)
const TeacherHomePanel = lazy(() => import("./summary/TeacherHomePanel").then(m => ({ default: m.TeacherHomePanel })));
const TeacherDeliveriesPanel = lazy(() => import("./deliveries/TeacherDeliveriesPanel").then(m => ({ default: m.TeacherDeliveriesPanel })));
const TeacherProjectsPanel = lazy(() => import("./projects/TeacherProjectsPanel").then(m => ({ default: m.TeacherProjectsPanel })));
const TeacherRuntimePanel = lazy(() => import("./runtime/TeacherRuntimePanel").then(m => ({ default: m.TeacherRuntimePanel })));
const TeacherGroupsPanel = lazy(() => import("./groups/pages/TeacherGroupsPanel").then(m => ({ default: m.TeacherGroupsPanel })));
const StoragePanel = lazy(() => import("./storage/StoragePanel").then(m => ({ default: m.StoragePanel })));
const UsersPanel = lazy(() => import("./users/UsersPanel").then(m => ({ default: m.UsersPanel })));
const StudentWorkspacePanel = lazy(() => import("./student/StudentWorkspacePanel").then(m => ({ default: m.StudentWorkspacePanel })));
const LlmConfigPanel = lazy(() => import("./llm/LlmConfigPanel").then(m => ({ default: m.LlmConfigPanel })));
const StudentProfilePanel = lazy(() => import("./student-profile/StudentProfilePanel").then(m => ({ default: m.StudentProfilePanel })));

const SuspenseLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <RiLoader4Line className="text-3xl animate-spin text-primary" />
      <span className="text-sm font-medium text-slate-600">Cargando módulo...</span>
    </div>
  </div>
);

function DebugSwitcher({ onAuthSuccess }: { onAuthSuccess: (_res: AuthResponse) => void }) {
  const { sessions, activeSessionId, setActiveSessionId, removeSession } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const response = await authApi.login({ email, password });
      onAuthSuccess(response);
      setEmail("");
      setPassword("");
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Login fallido");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    setActiveSessionId(sessionId);
    if (session?.role === "STUDENT") {
      navigate("/mi-espacio");
    } else {
      navigate("/summary");
    }
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border shadow-sm transition-colors ${
          open
            ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:border-slate-700"
            : "bg-app-surface text-app-text-secondary border-app-border hover:bg-app-bg-subtle"
        }`}
      >
        <RiSpyLine className="text-base" />
        Debug
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-72 bg-app-surface border border-app-border rounded-lg shadow-lg p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <div className="ui-label mb-2">Sesiones activas</div>
            {sessions.length === 0 ? (
              <p className="text-xs text-app-text-muted italic">No hay sesiones.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSwitch(s.id)}
                      className={`flex flex-1 items-center justify-between rounded-md px-3 py-2 text-xs text-left transition border ${
                        s.id === activeSessionId
                          ? "bg-primary-subtle border-primary/30 text-primary"
                          : "bg-app-surface border-app-border text-app-text-secondary hover:bg-app-bg-subtle"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-app-text">{s.email}</div>
                        <div className="text-[10px] text-app-text-muted mt-0.5">
                          {s.role} {s.id === activeSessionId && "· activa"}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSession(s.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-app-text-muted hover:text-danger-600 hover:bg-danger-50 text-base shrink-0"
                      title="Eliminar sesión"
                      aria-label="Eliminar sesión"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleQuickLogin} className="border-t border-app-border pt-3 space-y-2">
            <div className="ui-label">Añadir sesión</div>
            <input
              type="email"
              placeholder="email"
              aria-label="Correo para login rápido"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input-field text-xs py-1.5"
            />
            <input
              type="password"
              placeholder="contraseña"
              aria-label="Contraseña para login rápido"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-field text-xs py-1.5"
            />
            {error && <div className="text-[10px] text-danger-600">{error}</div>}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-md bg-primary hover:bg-primary-hover disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              {loading ? "Entrando..." : "Login rápido"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function App(): JSX.Element {
  const {
    activeSession,
    activeSessionId,
    authWarning,
    addSession,
    removeSession,
    clearAuthWarning,
  } = useSession();
  const { pushToast } = useToast();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authWarning) return;
    pushToast({
      title: "Sesión actualizada",
      description: authWarning,
      tone: "warning",
      durationMs: 6500,
    });
    clearAuthWarning();
  }, [authWarning, clearAuthWarning, pushToast]);

  const handleAuthSuccess = (response: AuthResponse) => {
    addSession(response);
    if (response.user.role === 'STUDENT') {
      navigate("/mi-espacio");
    } else {
      navigate("/summary");
    }
  };

  const hasAuthenticatedSession = Boolean(activeSession);
  const activeTab = location.pathname.split("/")[1] || (activeSession?.role === 'STUDENT' ? "mi-espacio" : "summary");

  // Public routes: `/` es la landing y `/acceso` el formulario. `/auth` se
  // conserva como alias del enlace antiguo.
  if (PUBLIC_PATHS.includes(location.pathname)) {
    if (hasAuthenticatedSession) {
      return <Navigate to={activeSession?.role === 'STUDENT' ? "/mi-espacio" : "/summary"} replace />;
    }

    // La landing enlaza a la pestaña de registro con `?modo=crear`.
    const initialMode = new URLSearchParams(location.search).get('modo') === 'crear'
      ? 'REGISTER'
      : 'LOGIN';

    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/acceso"
          element={<AuthPanel onAuthSuccess={handleAuthSuccess} initialMode={initialMode} />}
        />
        <Route path="/auth" element={<Navigate to="/acceso" replace />} />
      </Routes>
    );
  }

  // Auth check for protected routes. Va a `/acceso`, no a `/`: quien llega a
  // una ruta interna sin sesión quiere el formulario, no la portada.
  if (!hasAuthenticatedSession) {
    return <Navigate to="/acceso" replace />;
  }

  const isStudent = activeSession?.role === 'STUDENT';
  // La configuración de proveedores incluye credenciales de facturación: es
  // administración de la instancia, no del aula.
  const isAdmin = activeSession?.role === 'ADMIN';
  const activeStudentTab = isStudent ? (new URLSearchParams(location.search).get('tab') || 'summary') : undefined;

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => navigate(`/${tab}`)}
      userRole={activeSession?.role}
      userEmail={activeSession?.email}
      onLogout={() => activeSessionId && removeSession(activeSessionId)}
      activeStudentTab={activeStudentTab}
      onStudentTabChange={isStudent ? (tab) => navigate(`/mi-espacio?tab=${tab}`) : undefined}
      topBar={!isStudent ? (
        <>
          <WorkspaceBar />
          <CommandPalette />
        </>
      ) : undefined}
    >
      <DebugSwitcher onAuthSuccess={handleAuthSuccess} />

      <div className="px-4 py-5 sm:px-6 lg:px-8">
        {authWarning && (
          <div className="mb-5 flex items-center justify-between rounded-md border border-warning-200 bg-warning-50 px-4 py-3">
            <span className="text-sm font-medium text-warning-800">{authWarning}</span>
            <button
              className="text-xs font-semibold text-warning-700 hover:text-warning-900 px-2 py-1 rounded-md hover:bg-warning-100"
              onClick={clearAuthWarning}
            >
              Cerrar
            </button>
          </div>
        )}

        <ErrorBoundary>
          <Suspense fallback={<SuspenseLoader />}>
            <Routes>
              {isStudent && (
                <>
                  <Route path="/mi-espacio" element={<StudentWorkspacePanel />} />
                  <Route path="*" element={<Navigate to="/mi-espacio" replace />} />
                </>
              )}

              {!isStudent && (
                <>
                  <Route path="/summary" element={<TeacherHomePanel />} />
                  <Route path="/users" element={<UsersPanel />} />
                  <Route path="/students/:studentId" element={<StudentProfilePanel />} />
                  <Route path="/groups" element={<TeacherGroupsPanel />} />
                  <Route path="/projects" element={<TeacherProjectsPanel />} />
                  <Route path="/deliveries" element={<TeacherDeliveriesPanel />} />
                  <Route path="/storage" element={<StoragePanel />} />
                  <Route path="/runtime" element={<TeacherRuntimePanel />} />
                  {isAdmin && <Route path="/llm" element={<LlmConfigPanel />} />}
                  <Route path="/builder" element={<Navigate to="/runtime" replace />} />
                  <Route path="*" element={<Navigate to="/summary" replace />} />
                </>
              )}
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
    </AppShell>
  );
}

export default App;
