/**
 * @fileoverview Módulo de la interfaz de usuario (main).
 *
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { SessionProvider } from './shared/session/SessionContext';
import { ThemeProvider } from './shared/theme/ThemeContext';
import { ToastProvider } from './shared/toast/ToastContext';
import { WorkspaceProvider } from './shared/workspace/WorkspaceContext';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>
            <WorkspaceProvider>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </WorkspaceProvider>
          </ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
