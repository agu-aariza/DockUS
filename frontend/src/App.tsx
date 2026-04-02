import { useState } from 'react';
import { AuthPanel } from './auth/AuthPanel';
import { DeliveriesPanel } from './deliveries/DeliveriesPanel';
import { ProjectsPanel } from './projects/ProjectsPanel';
import { StoragePanel } from './storage/StoragePanel';
import { UsersPanel } from './users/UsersPanel';
import { useSession } from './shared/session/SessionContext';
import type { AuthResponse } from './shared/types';

type TabKey = 'auth' | 'users' | 'projects' | 'deliveries' | 'storage';

const TAB_LABELS: Record<TabKey, string> = {
  auth: 'Auth',
  users: 'Users',
  projects: 'Projects',
  deliveries: 'Deliveries',
  storage: 'Storage',
};

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

  const [activeTab, setActiveTab] = useState<TabKey>('auth');

  const handleAuthSuccess = (response: AuthResponse, label?: string) => {
    addSession(response, label);
    setActiveTab('projects');
  };

  const hasAuthenticatedSession = Boolean(activeSession);

  const renderTab = () => {
    switch (activeTab) {
      case 'auth':
        return <AuthPanel onAuthSuccess={handleAuthSuccess} />;
      case 'users':
        return <UsersPanel session={activeSession} />;
      case 'projects':
        return <ProjectsPanel session={activeSession} />;
      case 'deliveries':
        return <DeliveriesPanel session={activeSession} />;
      case 'storage':
        return <StoragePanel session={activeSession} />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <h1>DockUS Smoke Tester</h1>
        <p>
          Cliente funcional para validar Auth, RBAC y flujos de
          Projects/Deliveries/Storage.
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
                  value={activeSessionId ?? ''}
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
                Usuario activo: <strong>{activeSession.email}</strong> / rol{' '}
                <strong>{activeSession.role}</strong>
              </p>
            ) : null}
          </>
        )}
      </section>

      <nav className="nav-tabs" aria-label="Módulos">
        {(Object.keys(TAB_LABELS) as TabKey[]).map((tabKey) => {
          const disabled = tabKey !== 'auth' && !hasAuthenticatedSession;
          return (
            <button
              key={tabKey}
              className={`tab ${activeTab === tabKey ? 'active' : ''}`}
              onClick={() => setActiveTab(tabKey)}
              disabled={disabled}
            >
              {TAB_LABELS[tabKey]}
            </button>
          );
        })}
      </nav>

      {!hasAuthenticatedSession && activeTab !== 'auth' ? (
        <p className="message">Necesitas una sesión activa para este módulo.</p>
      ) : null}

      <main>{renderTab()}</main>
    </div>
  );
}
