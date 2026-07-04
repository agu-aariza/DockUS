# Frontend: Gestión de Proyectos

Este módulo contiene la experiencia de profesor/admin para crear, editar, asignar y supervisar proyectos. La vista viva es `TeacherProjectsPanel.tsx`, que coordina catálogo, detalle, creación, seguimiento y ajustes desde una única superficie.

## Estructura

- `TeacherProjectsPanel.tsx`: panel principal de proyectos; contiene selección, creación, detalle, asignaciones y edición.
- `ProgressDashboard.tsx`: panel analítico de progreso por proyecto.
- `components/ProjectSubPanels.tsx`: subpaneles auxiliares compartidos por la vista principal.
- `hooks/useProjectManagement.ts`: CRUD y lifecycle de proyectos.
- `hooks/useProjectAssignmentManagement.ts`: asignaciones a estudiantes/grupos.
- `hooks/useProjectTestSuiteManagement.ts`: gestión de suite de tests docente.
- `hooks/projectManagement.types.ts`: tipos locales de los hooks.
- `hooks/projectManagement.utils.ts`: helpers puros de transformación/formato.

## Mantenibilidad

- No crear componentes duplicados si solo los usa `TeacherProjectsPanel`; extraerlos únicamente cuando tengan reutilización real o reduzcan complejidad clara.
- Mantener las llamadas HTTP detrás de `shared/api/*`; los componentes no deben usar Axios directamente.
- Tokens válidos: `app.*`, `primary.*`, `accent.*`, `slate.*`, `bg-white`, `border-app-border`.
- No introducir clases legacy `academic-*`, `brand-maroon`, `brand-blue` ni `shadow-academic`.
- Si se añade un archivo en `components/` o `hooks/`, actualizar este README y verificar `npm run knip`.
