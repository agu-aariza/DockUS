/**
 * @fileoverview Contexto y componentes de navegación del espacio de trabajo (WorkspaceUIContext).
 *
 * @module WorkspaceUIContext
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export interface WorkspaceUIContextValue {
  isMinimized: boolean;
  setIsMinimized: (min: boolean) => void;
}

const WorkspaceUIContext = createContext<WorkspaceUIContextValue | null>(null);

const MINIMIZED_STORAGE_KEY = 'educodeai_workspace_bar_minimized';

export function WorkspaceUIProvider({ children }: PropsWithChildren): JSX.Element {
  const [isMinimized, setIsMinimizedState] = useState(() => {
    return localStorage.getItem(MINIMIZED_STORAGE_KEY) === 'true';
  });

  const setIsMinimized = (min: boolean) => {
    setIsMinimizedState(min);
    localStorage.setItem(MINIMIZED_STORAGE_KEY, String(min));
  };

  const value = useMemo(
    () => ({
      isMinimized,
      setIsMinimized,
    }),
    [isMinimized],
  );

  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI(): WorkspaceUIContextValue {
  const context = useContext(WorkspaceUIContext);
  if (!context) {
    throw new Error('useWorkspaceUI must be used within a WorkspaceUIProvider');
  }
  return context;
}
