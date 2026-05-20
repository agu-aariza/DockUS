import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import React, { useEffect, useState, Suspense, lazy } from "react";
import { AuthPanel } from "./auth/AuthPanel";
import { Sidebar } from "./shared/components/Sidebar";
import { WorkspaceBar } from "./shared/workspace/WorkspaceBar";
import { CommandPalette } from "./shared/components/CommandPalette";
import { useSession } from "./shared/session/SessionContext";
import { authApi } from "./shared/api/services";
import type { AuthResponse } from "./shared/types";
import { useToast } from "./shared/toast/ToastContext";
import { RiMenuLine, RiCloseLine, RiSpyLine, RiLoader4Line } from "react-icons/ri";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";

// Lazy-loaded route components (Code Splitting)
const TeacherHomePanel = lazy(() => import("./resumen/TeacherHomePanel").then(m => ({ default: m.TeacherHomePanel })));
const TeacherDeliveriesPanel = lazy(() => import("./deliveries/TeacherDeliveriesPanel").then(m => ({ default: m.TeacherDeliveriesPanel })));
const TeacherProjectsPanel = lazy(() => import("./projects/TeacherProjectsPanel").then(m => ({ default: m.TeacherProjectsPanel })));
const TeacherRuntimePanel = lazy(() => import("./runtime/TeacherRuntimePanel").then(m => ({ default: m.TeacherRuntimePanel })));
const TeacherGroupsPanel = lazy(() => import("./groups/pages/TeacherGroupsPanel").then(m => ({ default: m.TeacherGroupsPanel })));
const StoragePanel = lazy(() => import("./storage/StoragePanel").then(m => ({ default: m.StoragePanel })));
const UsersPanel = lazy(() => import("./users/UsersPanel").then(m => ({ default: m.UsersPanel })));
const StudentWorkspacePanel = lazy(() => import("./student/StudentWorkspacePanel").then(m => ({ default: m.StudentWorkspacePanel })));

const SuspenseLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3 text-academic-outline">
      <RiLoader4Line className="text-3xl animate-spin text-brand-blue" />
      <span className="text-sm font-medium">Cargando módulo...</span>
    </div>
  </div>
);

function DebugSwitcher({ onAuthSuccess }: { onAuthSuccess: (res: AuthResponse) => void }) {
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
      const res = await authApi.login({ email, password });
      onAuthSuccess(res);
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
      navigate("/resumen");
    }
  };

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100]">
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-academic border transition-all ${
          open
            ? "bg-academic-primary text-white border-academic-primary-container"
            : "bg-white text-academic-on-surface-variant border-academic-surface-variant hover:bg-academic-surface"
        }`}
      >
        <RiSpyLine className="text-base" />
        Debug
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-12 right-0 w-72 bg-white border border-academic-surface-variant rounded-2xl shadow-academic p-4 space-y-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Existing Sessions */}
          <div>
            <div className="ui-label mb-2">
              Sesiones activas
            </div>
            {sessions.length === 0 ? (
              <p className="text-xs text-academic-outline italic">No hay sesiones.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sessions.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition border cursor-pointer ${
                      s.id === activeSessionId
                        ? "bg-brand-blue/5 border-brand-blue/30 text-brand-blue"
                        : "bg-white border-academic-surface-variant text-academic-on-surface hover:bg-academic-surface"
                    }`}
                    onClick={() => handleSwitch(s.id)}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.email}</div>
                      <div className="text-[10px] text-academic-outline mt-0.5">
                        {s.role} {s.id === activeSessionId && "· activa"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeSession(s.id); }}
                      className="text-academic-outline hover:text-rose-600 text-base ml-2 shrink-0"
                      title="Eliminar sesión"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Login */}
          <form onSubmit={handleQuickLogin} className="border-t border-academic-surface-variant pt-3 space-y-2">
            <div className="ui-label">
              Añadir sesión
            </div>
            <input
              type="email"
              placeholder="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white border border-academic-outline-variant/30 px-3 py-1.5 text-xs text-academic-on-surface placeholder:text-academic-outline focus:outline-none focus:border-brand-blue/40"
            />
            <input
              type="password"
              placeholder="contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white border border-academic-outline-variant/30 px-3 py-1.5 text-xs text-academic-on-surface placeholder:text-academic-outline focus:outline-none focus:border-brand-blue/40"
            />
            {error && <div className="text-[10px] text-rose-600">{error}</div>}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-xl bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 px-3 py-1.5 text-xs font-bold text-white transition-all shadow-sm"
            >
              {loading ? "Entrando..." : "Login rápido"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function App(): JSX.Element {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!authWarning) {
      return;
    }

    pushToast({
      title: "Sesión actualizada",
      description: authWarning,
      tone: "warning",
      durationMs: 6500,
    });
    clearAuthWarning();
  }, [authWarning, clearAuthWarning, pushToast]);

  const handleAuthSuccess = (response: AuthResponse, label?: string) => {
    addSession(response, label);
    if (response.user.role === 'STUDENT') {
      navigate("/mi-espacio");
    } else {
      navigate("/resumen");
    }
  };

  const hasAuthenticatedSession = Boolean(activeSession);
  const activeTab = location.pathname.split("/")[1] || (activeSession?.role === 'STUDENT' ? "mi-espacio" : "resumen");

  // Public routes
  if (location.pathname === "/" || location.pathname === "/auth") {
    if (hasAuthenticatedSession) {
      return <Navigate to={activeSession?.role === 'STUDENT' ? "/mi-espacio" : "/resumen"} replace />;
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

  return (
    <div className="flex min-h-screen bg-academic-surface font-sans">
      <DebugSwitcher onAuthSuccess={handleAuthSuccess} />
      
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-academic-on-surface/40 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 transform xl:relative xl:translate-x-0 transition-transform duration-300 ease-in-out ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar 
          activeTab={activeTab}
          onTabChange={(tab) => {
            navigate(`/${tab}`);
            setMobileMenuOpen(false);
          }}
          userRole={activeSession?.role}
          userEmail={activeSession?.email}
          onLogout={() => activeSessionId && removeSession(activeSessionId)}
        />
        {/* Mobile close button inside drawer */}
        <button 
          className="absolute top-4 right-4 p-2 text-academic-outline hover:text-academic-on-surface xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <RiCloseLine className="text-2xl" />
        </button>
      </div>

      <main className="relative min-w-0 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="flex items-center justify-between border-b border-academic-surface-variant bg-white px-4 py-3 xl:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 -ml-2 text-academic-on-surface-variant hover:text-academic-on-surface"
              onClick={() => setMobileMenuOpen(true)}
            >
              <RiMenuLine className="text-2xl" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/logos/Logo01.png" alt="DockUS" className="h-8 w-8 rounded-lg border border-academic-surface-variant" />
              <span className="font-semibold tracking-tight text-academic-on-surface">DockUS</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs font-medium text-academic-on-surface-variant bg-academic-surface-container px-3 py-1.5 rounded-full">
              {activeSession?.email}
            </div>
            <button className="text-xs font-bold text-academic-primary uppercase tracking-widest hover:text-academic-primary-container" onClick={() => activeSessionId && removeSession(activeSessionId)}>
              Salir
            </button>
          </div>
        </div>

        {/* Workspace Context Bar - Only for Teachers/Admins */}
        {!isStudent && (
          <>
            <WorkspaceBar />
            <CommandPalette />
          </>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {authWarning && (
            <div className="mb-6 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-sm font-medium text-amber-800">{authWarning}</span>
              <button className="text-xs font-semibold text-amber-700 hover:text-amber-900" onClick={clearAuthWarning}>Cerrar</button>
            </div>
          )}

          <ErrorBoundary>
            <Suspense fallback={<SuspenseLoader />}>
              <Routes>
                {/* Student specific routes */}
                {isStudent && (
                   <>
                     <Route path="/mi-espacio" element={<StudentWorkspacePanel session={activeSession} />} />
                     <Route path="*" element={<Navigate to="/mi-espacio" replace />} />
                   </>
                )}

                {/* Teacher / Admin specific routes */}
                {!isStudent && (
                   <>
                     <Route path="/resumen" element={<TeacherHomePanel session={activeSession} />} />
                     <Route path="/users" element={<UsersPanel session={activeSession} />} />
                     <Route path="/groups" element={<TeacherGroupsPanel session={activeSession} />} />
                     <Route path="/projects" element={<TeacherProjectsPanel session={activeSession} />} />
                     <Route path="/deliveries" element={<TeacherDeliveriesPanel session={activeSession} />} />
                     <Route path="/storage" element={<StoragePanel session={activeSession} />} />
                     <Route path="/runtime" element={<TeacherRuntimePanel session={activeSession} />} />
                     <Route path="/builder" element={<Navigate to="/runtime" replace />} />
                     <Route path="*" element={<Navigate to="/resumen" replace />} />
                   </>
                )}
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export default App;
