import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import React, { useEffect, useState, Suspense, lazy } from "react";
import { AuthPanel } from "./auth/AuthPanel";
import { AppShell } from "./shared/components/ui/AppShell";
import { WorkspaceBar } from "./shared/workspace/WorkspaceBar";
import { CommandPalette } from "./shared/components/CommandPalette";
import { useSession } from "./shared/session/SessionContext";
import { authApi } from "./shared/api/services";
import type { AuthResponse } from "./features/auth/types";
import { useToast } from "./shared/toast/ToastContext";
import { RiSpyLine, RiLoader4Line } from "react-icons/ri";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";

// Lazy-loaded route components (Code Splitting)
const TeacherHomePanel = lazy(() => import("./summary/TeacherHomePanel").then(m => ({ default: m.TeacherHomePanel })));
const TeacherDeliveriesPanel = lazy(() => import("./deliveries/TeacherDeliveriesPanel").then(m => ({ default: m.TeacherDeliveriesPanel })));
const TeacherProjectsPanel = lazy(() => import("./projects/TeacherProjectsPanel").then(m => ({ default: m.TeacherProjectsPanel })));
const TeacherRuntimePanel = lazy(() => import("./runtime/TeacherRuntimePanel").then(m => ({ default: m.TeacherRuntimePanel })));
const TeacherGroupsPanel = lazy(() => import("./groups/pages/TeacherGroupsPanel").then(m => ({ default: m.TeacherGroupsPanel })));
const StoragePanel = lazy(() => import("./storage/StoragePanel").then(m => ({ default: m.StoragePanel })));
const UsersPanel = lazy(() => import("./users/UsersPanel").then(m => ({ default: m.UsersPanel })));
const StudentWorkspacePanel = lazy(() => import("./student/StudentWorkspacePanel").then(m => ({ default: m.StudentWorkspacePanel })));

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
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
        }`}
      >
        <RiSpyLine className="text-base" />
        Debug
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-72 bg-white border border-app-border rounded-lg shadow-lg p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <div className="ui-label mb-2">Sesiones activas</div>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No hay sesiones.</p>
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
                          : "bg-white border-app-border text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.email}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {s.role} {s.id === activeSessionId && "· activa"}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSession(s.id)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 text-base shrink-0"
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
              className="w-full rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            <input
              type="password"
              placeholder="contraseña"
              aria-label="Contraseña para login rápido"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
            {error && <div className="text-[10px] text-red-600">{error}</div>}
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

  // Public routes
  if (location.pathname === "/" || location.pathname === "/auth") {
    if (hasAuthenticatedSession) {
      return <Navigate to={activeSession?.role === 'STUDENT' ? "/mi-espacio" : "/summary"} replace />;
    }

    return (
      <Routes>
        <Route path="/" element={<AuthPanel onAuthSuccess={handleAuthSuccess} />} />
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Auth check for protected routes
  if (!hasAuthenticatedSession) {
    return <Navigate to="/" replace />;
  }

  const isStudent = activeSession?.role === 'STUDENT';
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
          <div className="mb-5 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-sm font-medium text-amber-800">{authWarning}</span>
            <button
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 px-2 py-1 rounded-md hover:bg-amber-100"
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
                  <Route path="/groups" element={<TeacherGroupsPanel />} />
                  <Route path="/projects" element={<TeacherProjectsPanel />} />
                  <Route path="/deliveries" element={<TeacherDeliveriesPanel />} />
                  <Route path="/storage" element={<StoragePanel />} />
                  <Route path="/runtime" element={<TeacherRuntimePanel />} />
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
