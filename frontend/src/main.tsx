import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { SessionProvider } from './shared/session/SessionContext';
import { ToastProvider } from './shared/toast/ToastContext';
import { WorkspaceProvider } from './shared/workspace/WorkspaceContext';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <WorkspaceProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </WorkspaceProvider>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
