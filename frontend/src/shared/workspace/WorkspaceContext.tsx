/**
 * @fileoverview Contexto y componentes de navegación del espacio de trabajo (WorkspaceContext).
 *
 * @module WorkspaceContext
 */

import { type PropsWithChildren } from 'react';
import {
  WorkspaceSelectionProvider,
  useWorkspaceSelection,
} from './WorkspaceSelectionContext';
import { WorkspaceUIProvider, useWorkspaceUI } from './WorkspaceUIContext';

export function WorkspaceProvider({ children }: PropsWithChildren): JSX.Element {
  return (
    <WorkspaceSelectionProvider>
      <WorkspaceUIProvider>{children}</WorkspaceUIProvider>
    </WorkspaceSelectionProvider>
  );
}

export { useWorkspaceSelection, useWorkspaceUI };
