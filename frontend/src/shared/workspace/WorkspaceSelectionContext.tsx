/**
 * @fileoverview Contexto y componentes de navegación del espacio de trabajo (WorkspaceSelectionContext).
 *
 * @module WorkspaceSelectionContext
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useSession } from '../session/SessionContext';

export interface WorkspaceSelection {
  projectId: string | null;
  projectTitle: string | null;
  assignmentId: string | null;
  assignmentLabel: string | null;
  deliveryId: string | null;
  deliveryLabel: string | null;
  lastRunId: string | null;
}

export interface WorkspaceSelectionContextValue {
  selection: WorkspaceSelection;
  setProject: (id: string, title?: string) => void;
  setAssignment: (id: string, label?: string) => void;
  clearAssignment: () => void;
  setDelivery: (id: string, label?: string) => void;
  setRun: (id: string) => void;
  clearWorkspace: () => void;
}

const WorkspaceSelectionContext = createContext<WorkspaceSelectionContextValue | null>(null);

export const DEFAULT_SELECTION: WorkspaceSelection = {
  projectId: null,
  projectTitle: null,
  assignmentId: null,
  assignmentLabel: null,
  deliveryId: null,
  deliveryLabel: null,
  lastRunId: null,
};

function getStorageKey(sessionId: string) {
  return `educodeai_workspace_${sessionId}`;
}

export function WorkspaceSelectionProvider({ children }: PropsWithChildren): JSX.Element {
  const { activeSessionId } = useSession();

  const [selection, setSelection] = useState<WorkspaceSelection>(() => {
    if (!activeSessionId) return DEFAULT_SELECTION;
    const stored = localStorage.getItem(getStorageKey(activeSessionId));
    if (stored) {
      try {
        return JSON.parse(stored) as WorkspaceSelection;
      } catch {
        return DEFAULT_SELECTION;
      }
    }
    return DEFAULT_SELECTION;
  });

  useEffect(() => {
    if (!activeSessionId) {
      setSelection(DEFAULT_SELECTION);
      return;
    }
    const stored = localStorage.getItem(getStorageKey(activeSessionId));
    if (stored) {
      try {
        setSelection(JSON.parse(stored) as WorkspaceSelection);
      } catch {
        setSelection(DEFAULT_SELECTION);
      }
    } else {
      setSelection(DEFAULT_SELECTION);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(getStorageKey(activeSessionId), JSON.stringify(selection));
    }
  }, [selection, activeSessionId]);

  const setProject = (id: string, title?: string) => {
    setSelection(prev => {
      if (prev.projectId !== id) {
        return {
          ...DEFAULT_SELECTION,
          projectId: id,
          projectTitle: title ?? null,
        };
      }
      return {
        ...prev,
        projectId: id,
        projectTitle: title ?? prev.projectTitle,
      };
    });
  };

  const setAssignment = (id: string, label?: string) => {
    setSelection(prev => {
      if (prev.assignmentId !== id) {
        return {
          ...prev,
          assignmentId: id,
          assignmentLabel: label ?? null,
          deliveryId: null,
          deliveryLabel: null,
          lastRunId: null,
        };
      }
      return {
        ...prev,
        assignmentId: id,
        assignmentLabel: label ?? prev.assignmentLabel,
      };
    });
  };

  const clearAssignment = () => {
    setSelection(prev => ({
      ...prev,
      assignmentId: null,
      assignmentLabel: null,
      deliveryId: null,
      deliveryLabel: null,
      lastRunId: null,
    }));
  };

  const setDelivery = (id: string, label?: string) => {
    setSelection(prev => {
      if (prev.deliveryId !== id) {
        return {
          ...prev,
          deliveryId: id,
          deliveryLabel: label ?? null,
          lastRunId: null,
        };
      }
      return {
        ...prev,
        deliveryId: id,
        deliveryLabel: label ?? prev.deliveryLabel,
      };
    });
  };

  const setRun = (id: string) => {
    setSelection(prev => ({ ...prev, lastRunId: id }));
  };

  const clearWorkspace = () => {
    setSelection(DEFAULT_SELECTION);
  };

  const value = useMemo(
    () => ({
      selection,
      setProject,
      setAssignment,
      clearAssignment,
      setDelivery,
      setRun,
      clearWorkspace,
    }),
    [selection],
  );

  return (
    <WorkspaceSelectionContext.Provider value={value}>
      {children}
    </WorkspaceSelectionContext.Provider>
  );
}

export function useWorkspaceSelection(): WorkspaceSelectionContextValue {
  const context = useContext(WorkspaceSelectionContext);
  if (!context) {
    throw new Error('useWorkspaceSelection must be used within a WorkspaceSelectionProvider');
  }
  return context;
}
