## Propósito de la carpeta
Contiene el contexto global de entorno de trabajo, permitiendo cambiar el scope de la aplicación (ej. de qué proyecto estamos viendo datos).

## Límites y Reglas Estrictas
Modificar el workspace debe invalidar o recargar los datos de la vista dependiente. Toda vista que dependa de un proyecto debe suscribirse a este contexto.

## Anti-Patrones y Gotchas ⚠️
No mantener el identificador del proyecto activo en estado local, ni pasarlo manualmente en un taladro de props (prop-drilling) infinito.

## Dependencias de Contexto Asumidas
Requiere que `WorkspaceContext` envuelva las rutas donde se deba poder interactuar con un entorno seleccionado (ej. dentro del AppShell).

## Inputs / Outputs Esperados
El hook retorna el `currentProject`, `currentAssignment` y funciones de mutación como `setWorkspace()`.

## Ejemplo de uso
```tsx
import { useWorkspace } from '@/shared/workspace/WorkspaceContext';

const { currentProject } = useWorkspace();
```

## Formato de Archivos
Archivos de Contexto y UI relacionada directamente con el bar de selección (`WorkspaceContext.tsx`, `WorkspaceBar.tsx`).
