# Frontend: Shared Workspace

`shared/workspace` centraliza la selección transversal usada por vistas de profesor y estudiante: proyecto, asignación, entrega y run activo. Es la pieza que mantiene sincronizadas barras de contexto, paneles de runtime, entregas y reportes.

## Archivos

- `WorkspaceContext.tsx`: provider React y hook `useWorkspace()` para leer/modificar la selección global.
- `WorkspaceBar.tsx`: barra visual que refleja la selección actual y permite navegar entre contexto relacionado.

## Reglas de Mantenibilidad

- El flujo de datos debe seguir siendo unidireccional a través de `WorkspaceContext.tsx`.
- No duplicar estado crítico de selección en componentes locales si otros paneles deben reaccionar a él.
- Mantener componentes funcionales con hooks y Tailwind.
- Usar únicamente el sistema visual institucional actual (`app.*`, `primary.*`, `accent.*`, `slate.*`, `bg-white`, `border-app-border`).
- No reintroducir Glassmorphism/Academic ni tokens `brand-*`/`academic-*`.
- Cualquier cambio en la forma de selección debe revisarse contra `TeacherProjectsPanel`, `TeacherDeliveriesPanel`, `TeacherRuntimePanel` y las vistas de estudiante.
