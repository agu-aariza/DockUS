# Frontend: Gestión de Proyectos (Projects)

Este directorio contiene la interfaz de usuario (UI), lógica de vista y componentes de React relacionados con la gestión administrativa y de creación de proyectos dentro de la plataforma (típicamente desde la perspectiva del profesor o administrador).

## Estructura de Directorios

- `components/`: Contiene los componentes visuales de React puros, a menudo presentacionales (dumb components) o pequeños bloques de construcción específicos para proyectos.
- `hooks/`: Contiene Custom Hooks de React (lógica de estado y efectos) que encapsulan las llamadas a la API, el manejo del estado local complejo, y reglas de negocio del lado del cliente.

## Archivos del Directorio Raíz

Estos son los componentes principales, que suelen actuar como Vistas o Paneles de control (Smart Components):

- **`TeacherProjectsPanel.tsx`**: El panel de control principal (Dashboard) para los profesores. Desde aquí pueden ver, administrar y supervisar todos sus proyectos activos, archivados y en borrador. Coordina múltiples sub-componentes.
  - Layout de dos columnas: sidebar de catálogo de proyectos + lienzo de detalle.
  - Soporta tres modos de detalle: selección de proyecto, creación de nuevo proyecto y estado vacío.
  - Usa el UI Kit institucional (`PageHeader`, `Button`, `Tabs`, `Card`, `SectionCard`, `StatusBadge`, `MetricCard`, `SearchInput`, `EmptyState`).
  - Incluye sub-vistas de resumen, asignaciones de alumnos, seguimiento (`ProgressDashboard`) y ajustes con secciones ancladas (Ajustes, Plazos, Profesores, Suite).
- **`ProgressDashboard.tsx`**: Un panel de análisis visual que permite a los profesores ver el progreso de los estudiantes o grupos en un proyecto específico, mostrando estadísticas, entregas y cuellos de botella.
- **`README.md`**: Este archivo de documentación.

## Archivos en `components/`

- **`ProjectCatalog.tsx`**: Muestra una cuadrícula, lista o catálogo de proyectos disponibles (ya sea proyectos públicos o plantillas de la plataforma).
- **`ProjectCreateForm.tsx`**: Componente de formulario complejo utilizado para crear un nuevo proyecto desde cero. Maneja la entrada de metadatos básicos (título, descripción, fechas).
- **`ProjectOverview.tsx`**: Componente de vista de detalles que muestra un resumen de un proyecto ya creado (estadísticas rápidas, estado actual).
- **`ProjectSettingsForm.tsx`**: Formulario detallado para modificar la configuración avanzada de un proyecto existente (opciones de evaluación, privacidad, límites de tiempo).
- **`ProjectStatusPill.tsx`**: Un micro-componente visual (badge/pill) que renderiza el estado de un proyecto (Ej. "Activo", "Borrador", "Completado") con colores semánticos correspondientes.
- **`ProjectSubPanels.tsx`**: Un componente contenedor que maneja la navegación por pestañas (tabs) o sub-secciones dentro de la vista detallada de un proyecto.

## Archivos en `hooks/`

- **`useProjectManagement.ts`**: Hook principal para interactuar con la API CRUD de proyectos (crear, editar, eliminar, archivar). Maneja el estado de carga (loading) y errores.
- **`useProjectAssignmentManagement.ts`**: Encapsula la lógica para gestionar a quién se asigna el proyecto (estudiantes individuales o grupos).
- **`useProjectTestSuiteManagement.ts`**: Hook para gestionar las pruebas automatizadas (test suites) asociadas a un proyecto de programación.
- **`useProjectsPanelState.ts`**: Hook dedicado a manejar el estado local de la interfaz del usuario dentro del `TeacherProjectsPanel` (filtros activos, ordenamiento, paginación, selección de vistas).
- **`projectManagement.types.ts`**: Definición de tipos de TypeScript utilizados exclusivamente por estos hooks de gestión.
- **`projectManagement.utils.ts`**: Funciones puras y utilidades de ayuda (transformaciones de datos, formateo de fechas) usadas por los hooks de proyectos.

## Sistema Visual

El panel sigue el nuevo diseño sobrio e institucional (B2B dashboard):

- Fondo: `bg-app-bg` (#f8fafc).
- Superficies: `bg-white`, bordes: `border-app-border` (#e2e8f0).
- Primario: `bg-primary` / `text-primary` (#2563EB).
- Acento institucional vino: `bg-accent` / `text-accent` (#5b040d), usado solo como acento puntual.
- Texto: `text-slate-900`, secundario `text-slate-500`.
- Tipografía: Inter / system-ui, títulos en `text-sm font-semibold` / `text-base font-semibold`.
- Bordes redondeados: `rounded-md`, `rounded-lg`, `rounded-xl`.
- Sombras mínimas o ninguna.
