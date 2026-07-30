/**
 * @fileoverview Módulo de la interfaz de usuario (main).
 *
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { QueryDevtools } from './shared/query/QueryDevtools';
import { createQueryClient } from './shared/query/queryClient';
import { SessionProvider } from './shared/session/SessionContext';
import { ThemeProvider } from './shared/theme/ThemeContext';
import { ToastProvider } from './shared/toast/ToastContext';
import { WorkspaceProvider } from './shared/workspace/WorkspaceContext';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const queryClient = createQueryClient();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
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
      <QueryDevtools />
    </QueryClientProvider>
  </React.StrictMode>,
);
