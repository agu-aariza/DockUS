/**
 * @fileoverview Componente compartido de la interfaz DockUS (ErrorBoundary).
 *
 * @module ErrorBoundary
 */

import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura errores de renderizado en componentes hijos y muestra
 * un fallback en lugar de romper toda la aplicación.
 */
export class ErrorBoundary extends Component<
  PropsWithChildren,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  // `.hash` es un no-op bajo BrowserRouter; `assign` cambia el pathname de
  // verdad, así que un error reproducible en la ruta actual deja de ser un
  // bucle. Navegación real (no remount local) porque las dos instancias de
  // este boundary envuelven <App/> y <Routes> enteros, no una vista puntual.
  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="h-16 w-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 text-3xl">
            ⚠️
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Algo ha salido mal</h2>
          <p className="text-slate-500 mb-8 max-w-md">
            Se ha producido un error inesperado al renderizar esta vista.
            {this.state.error && (
              <span className="block mt-2 text-xs font-mono text-slate-400 bg-slate-100 p-2 rounded-lg text-left overflow-auto max-h-32">
                {this.state.error.message}
              </span>
            )}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-sm"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
