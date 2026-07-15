## Propósito de la carpeta
Contiene el contexto global de entorno de trabajo, permitiendo cambiar el scope de la aplicación (ej. de qué proyecto estamos viendo datos) y controlar el estado del UI chrome.

## Estructura
- `WorkspaceSelectionContext.tsx`: selección jerárquica `project → assignment → delivery → lastRun`.
- `WorkspaceUIContext.tsx`: estado de chrome (`isMinimized` de la barra lateral).
- `WorkspaceContext.tsx`: provider combinado y re-exports. También expone `useWorkspace()` (deprecated).
- `WorkspaceBar.tsx`: barra flotante de scope.

## Límites y Reglas Estrictas
Modificar el workspace debe invalidar o recargar los datos de la vista dependiente. Toda vista que dependa de un proyecto debe suscribirse al contexto de selección.

## Anti-Patrones y Gotchas ⚠️
- No mantener el identificador del proyecto activo en estado local, ni pasarlo manualmente en un taladro de props (prop-drilling) infinito.
- No usar `useWorkspace()` en nuevo código; prefiere `useWorkspaceSelection()` o `useWorkspaceUI()` para evitar re-renders por cambios no relacionados.

## Dependencias de Contexto Asumidas
Requiere que `WorkspaceProvider` envuelva las rutas donde se deba poder interactuar con un entorno seleccionado (ej. dentro del AppShell).

## Inputs / Outputs Esperados
`useWorkspaceSelection` retorna `selection` con `projectId`, `assignmentId`, `deliveryId`, `lastRunId` y setters.
`useWorkspaceUI` retorna `isMinimized` y `setIsMinimized`.

## Ejemplo de uso
```tsx
import { useWorkspaceSelection, useWorkspaceUI } from '@/shared/workspace/WorkspaceContext';

const { selection, setProject } = useWorkspaceSelection();
const { isMinimized, setIsMinimized } = useWorkspaceUI();
```

## Formato de Archivos
Archivos de Contexto y UI relacionada directamente con el bar de selección (`WorkspaceSelectionContext.tsx`, `WorkspaceUIContext.tsx`, `WorkspaceContext.tsx`, `WorkspaceBar.tsx`).
