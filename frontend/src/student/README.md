# Frontend: Espacio del Estudiante (Student Workspace)

Este directorio es uno de los más grandes y complejos del Frontend. Contiene la interfaz de usuario completa, componentes, flujos de trabajo y lógica dedicada exclusivamente a la experiencia del **estudiante**. Es el portal a través del cual los alumnos ven sus tareas, trabajan en ellas, interactúan con la evaluación automatizada y envían sus entregas.

## Estructura de Directorios

- `components/`: Componentes visuales específicos de la interfaz del estudiante (tarjetas de tareas, previsualizadores, pasos de entrega).
- `hooks/`: Lógica de negocio del cliente, manejo de estado y conexión a las APIs para las operaciones del estudiante.
- `utils/`: Utilidades específicas para la validación y transformación de datos del estudiante.

## Archivos del Directorio Raíz (Vistas y Lógica de Negocio)

- **`StudentWorkspacePanel.tsx`**: El contenedor principal (Layout/Dashboard) del espacio de trabajo del estudiante. Orquesta la navegación entre las diferentes secciones (Home, Entregas, Reportes).
- **`StudentHomeSection.tsx`**: Vista de inicio (Landing) del estudiante, donde ve un resumen de sus proyectos activos, notificaciones importantes y plazos inminentes.
- **`StudentAssignmentsSection.tsx`**: Sección donde el estudiante ve la lista detallada de tareas/proyectos que se le han asignado (tanto individualmente como en grupo).
- **`StudentDeliveriesSection.tsx`**: Vista para que el estudiante revise el histórico de las entregas que ya ha realizado y su estado (Evaluando, Calificado).
- **`StudentReportsSection.tsx`**: Área donde el estudiante puede leer el feedback del profesor y los reportes detallados de la evaluación automática de sus proyectos pasados.
- **`StudentSubmissionFlow.tsx`**: Componente orquestador del "Flujo de Entrega" (wizard). Guía al estudiante paso a paso en el proceso de subir su trabajo.
- **`PipelineStepper.tsx`**: Un indicador visual (Stepper) que muestra en qué etapa de evaluación automática (Pipeline) se encuentra una entrega reciente (ej. Construyendo -> Pasando Tests -> Generando Feedback).
- **`EvaluationNotificationBanner.tsx`**: Banner de notificación en tiempo real que alerta al estudiante sobre actualizaciones en la evaluación de sus entregas.
- **`SubmissionCoachingPreview.tsx`**: Un componente que (opcionalmente) utiliza IA para dar un pre-análisis o "coaching" al estudiante antes de la entrega final.
- Lógica y Constantes de Flujo:
  - **`studentWorkflowState.ts`**: Define y gestiona el estado general del flujo de trabajo del alumno (ej. máquina de estados).
  - **`studentBuildRunStages.ts`**: Constantes y definiciones de las etapas de ejecución/construcción.
  - **`deadlineUtils.ts`**: Utilidades para calcular y formatear lógicamente las fechas de entrega (plazos vencidos, extensiones).
  - **`evaluationNotifications.ts`**: Lógica para suscribirse o parsear notificaciones de evaluación (ej. vía WebSockets).
  - **`studentWorkspaceInsights.ts`**: Lógica analítica para extraer métricas del estudiante (progreso).
  - **`studentRetryActions.ts`**: Configuración y lógica de qué hacer si una entrega automática falla (reintentos).

## Archivos en `components/` (Flujo de Entrega y Visuales)

- **`SubmissionStep1.tsx`**, **`SubmissionStep2.tsx`**, **`SubmissionStep3.tsx`**: Los componentes de los pasos individuales del asistente de entrega (wizard). Suelen ser: 1. Seleccionar repo/archivos, 2. Validar metadatos, 3. Confirmación final.
- **`SubmissionStepIndicator.tsx`**: El componente visual de la barra de progreso superior del wizard.
- **`SubmissionSuccess.tsx`**: Pantalla de éxito mostrada al completar la entrega.
- **`SubmissionEmptyState.tsx`**: Vista amigable cuando el estudiante no tiene entregas o tareas pendientes.
- **`SubmissionSidebar.tsx`**: Barra lateral durante el proceso de entrega con instrucciones o contexto adicional.
- **`EvaluationProgressCard.tsx`**: Una tarjeta dinámica que se actualiza en vivo mostrando el log y estado de la evaluación automatizada de una entrega.
- **`FileTreePreview.tsx`**: Un componente visual para renderizar la estructura de archivos que el estudiante está a punto de entregar.
- **`StudentWorkspaceSurface.tsx`**: Contenedor estilizado para el área de trabajo principal.

## Archivos en `hooks/` y `utils/`

- **`useSubmissionFlow.ts`**: Hook muy complejo que maneja todo el estado del wizard de entrega (avanzar paso, retroceder, validaciones asíncronas).
- **`useStudentWorkspaceData.ts`**: Hook para obtener (fetch) toda la información necesaria para el panel principal del estudiante (tareas asignadas, notificaciones).
- **`useEvaluationNotifications.ts`**: Hook para manejar la suscripción en tiempo real (Sockets/SSE) a los eventos de evaluación de una entrega.
- **`useBuildRunStream.ts`**: Hook para recibir el flujo (stream) de logs en tiempo real del contenedor que está evaluando el código del estudiante.
- **`utils/validateSubmission.ts`**: Lógica de validación pura del lado del cliente antes de permitir que el formulario de entrega se envíe.
