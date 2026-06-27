# Frontend: Runtime

## Descripción General

El módulo `runtime` contiene la vista que el cuerpo docente utiliza para ejecutar y supervisar *builder runs*: evaluaciones de entregas de estudiantes mediante ejecución efímera de código y auditoría por LLM. No gestiona contenedores Docker ni telemetría de infraestructura; su responsabilidad es orquestar la selección de proyecto, alumno y entrega, lanzar runs y visualizar su historial y su progreso en tiempo real vía SSE.

## Árbol de Directorios

```text
runtime/
├── README.md
├── TeacherRuntimePanel.tsx
├── components/
│   └── (Componentes auxiliares de UI)
└── hooks/
    └── useRuntimeManagement.ts
```

## Detalle Exhaustivo de Ficheros

### `TeacherRuntimePanel.tsx`

- **Propósito:** Panel docente para ejecutar evaluaciones y revisar builder runs.
- **Responsabilidad:**
  - Renderiza el flujo de selección en tres niveles: proyecto → alumno asignado → versión de entrega.
  - Permite lanzar una evaluación (`handleStartRun`), cancelar una ejecución activa (`handleCancelRun`) y previsualizar el código de una entrega.
  - Muestra métricas del runtime (estado de la plataforma, capacidad de evaluación, runs recientes y secuencia SSE).
  - Navega entre tres pestañas: **Control**, **Historial** (lista de runs previos) y **En vivo** (stream de eventos y artefactos).
  - Delega la renderización del historial y de la ejecución en vivo a `BuilderRunsTable` y `BuilderLiveRunPane` respectivamente.
- **Sistema visual:** Diseño sobrio e institucional (B2B dashboard) basado en tokens del proyecto (`bg-app-bg`, `bg-white`, `border-app-border`, `text-slate-900`, `text-slate-500`, `bg-primary`, `text-accent`). Usa componentes compartidos del UI kit: `PageHeader`, `Tabs`, `MetricCard`, `StatusBadge`, `Button`, `VisualPicker` y `ProjectSelectionHub`. Evita gradientes, marcos decorativos, sombras grandes y bordes redondeados extremos.
- **Conexiones:** Consume el estado y las mutaciones expuestas por `useRuntimeManagement.ts` y sincroniza la selección con `WorkspaceContext`.

### `hooks/useRuntimeManagement.ts`

- **Propósito:** Lógica de estado y peticiones API para los builder runs.
- **Responsabilidad:**
  - Obtiene proyectos, asignaciones, entregas y runs del backend.
  - Gestiona la conexión SSE para eventos de ejecución en vivo.
  - Expone funciones para iniciar, cancelar, descargar y previsualizar artefactos de un run.
  - Maneja estados de carga y errores mediante notificaciones toast.

## Información para la IA

Este módulo asume que el usuario autenticado tiene rol `TEACHER` o `ADMIN`. Cualquier ampliación de `TeacherRuntimePanel` debe mantener el diseño institucional del UI kit, prever estados vacíos con mensajes claros y conservar la separación entre selección, historial y ejecución en vivo. No introducir dependencias con gestión de contenedores Docker ni telemetría de infraestructura en este panel.
