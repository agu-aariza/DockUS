import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { SessionProvider } from './shared/session/SessionContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
