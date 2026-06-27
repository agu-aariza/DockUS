# Frontend: Resumen / Panel de Control (Summary / Dashboard)

Este directorio contiene componentes y vistas enfocadas en el análisis agregado (Analytics), reportes de alto nivel y el panel de control principal (Home Dashboard) destinado principalmente a los profesores o administradores del sistema.

## Estructura de Directorios

- `components/`: Subcomponentes visuales especializados en la representación de datos agregados (estadísticas, gráficos).

## Archivos del Directorio Raíz

- **`TeacherHomePanel.tsx`**: Vista de aterrizaje principal para docentes y administradores. Integra:
  - Métricas globales del sistema (`StatsOverview`).
  - Métricas de cohorte por proyecto (`CohortAnalyticsDashboard`).
  - Auditoría de integridad y sincronización de recursos.
  - Lista de proyectos recientes.
  - Panel de prioridades con entregas pendientes y últimas evaluaciones.
  - Contexto de workspace activo para navegación sincronizada.
- **`README.md`**: Este archivo de documentación.

## Archivos en `components/`

- **`CohortAnalyticsDashboard.tsx`**: Dashboard analítico por proyecto. Muestra tasa de aprobados / éxito en tests, nota media, total de entregas, tests fallidos, distribución de calificaciones o estado de entregas, e incidencias de calidad detectadas automáticamente.

## Dependencias principales

- Componentes del UI Kit: `PageHeader`, `Button`, `SectionCard`, `StatusBadge`, `StatsOverview`.
- APIs de servicio: `projectsApi`, `deliveriesApi`, `usersApi`.
- Contextos compartidos: `WorkspaceContext`, `ToastContext`.
