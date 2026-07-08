## Responsabilidad del Módulo
Controla toda la experiencia y el flujo de trabajo del estudiante, incluyendo la visualización de proyectos, entregas, notificaciones de evaluación y reportes.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No incluye la lógica de revisión del profesor, ni la administración global de usuarios. No ejecuta evaluaciones directamente (depende del backend).

## Conceptos Clave (Glosario)
- **StudentSubmissionFlow**: Proceso paso a paso para que un estudiante entregue su trabajo.
- **StudentWorkspacePanel**: Panel principal centralizando las secciones del estudiante.
- **StudentBuildRun**: Ejecución de un pipeline de evaluación para la entrega de un estudiante.

## Dependencias Externas Clave
Se comunica intensamente con `deliveriesApi`, `builderApi`, `projectsApi` mediante `shared/api`. Utiliza `shared/workspace` y `shared/session`.

## Efectos Secundarios (Side Effects)
Inicia entregas y flujos de evaluación. Muestra notificaciones push locales sobre el progreso de las evaluaciones en tiempo real.

## Estado / BBDD
Gestiona el estado local del estudiante: sección activa, entregas realizadas, estado actual de la evaluación en progreso.

## Puntos de Entrada (Entrypoints)
- `StudentWorkspacePanel.tsx`
- `StudentHomeSection.tsx`
- `StudentSubmissionFlow.tsx`
