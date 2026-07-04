import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useSession } from '../session/SessionContext';

interface WorkspaceSelection {
  projectId: string | null;
  projectTitle: string | null;
  assignmentId: string | null;
  assignmentLabel: string | null;
  deliveryId: string | null;
  deliveryLabel: string | null;
  lastRunId: string | null;
}

interface WorkspaceContextValue {
  selection: WorkspaceSelection;
  setProject: (id: string, title?: string) => void;
  setAssignment: (id: string, label?: string) => void;
  setDelivery: (id: string, label?: string) => void;
  setRun: (id: string) => void;
  clearWorkspace: () => void;
  isMinimized: boolean;
  setIsMinimized: (min: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const DEFAULT_SELECTION: WorkspaceSelection = {
  projectId: null,
  projectTitle: null,
  assignmentId: null,
  assignmentLabel: null,
  deliveryId: null,
  deliveryLabel: null,
  lastRunId: null,
};

function getStorageKey(sessionId: string) {
  return `dockus_workspace_${sessionId}`;
}

export function WorkspaceProvider({ children }: PropsWithChildren): JSX.Element {
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

  // Re-hydrate when session changes
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

  // Persist when selection changes
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(getStorageKey(activeSessionId), JSON.stringify(selection));
    }
  }, [selection, activeSessionId]);

  const setProject = (id: string, title?: string) => {
    setSelection(prev => {
      // If project changes, clear downstream selections
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

  const [isMinimized, setIsMinimizedState] = useState(() => {
    return localStorage.getItem("dockus_workspace_bar_minimized") === "true";
  });

  const setIsMinimized = (min: boolean) => {
    setIsMinimizedState(min);
    localStorage.setItem("dockus_workspace_bar_minimized", String(min));
  };

  const value = useMemo(() => ({
    selection,
    setProject,
    setAssignment,
    setDelivery,
    setRun,
    clearWorkspace,
    isMinimized,
    setIsMinimized,
  }), [selection, isMinimized]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
