# Módulo de la Experiencia del Estudiante (src/student)

> **Resumen rápido:** Asistente paso a paso para la entrega de ejercicios, superficie de workspace de trabajo, secciones de inicio, asignaciones, entregas, expedientes y notificaciones de evaluación.

---

## Propósito y Responsabilidades
Guiar al alumno de manera fluida y clara a lo largo del proceso de entrega y revisión de sus prácticas.
- **Secciones Principales:** Inicio (`StudentHomeSection`), asignaciones activas (`StudentAssignmentsSection`), entregas realizadas (`StudentDeliveriesSection`), expedientes (`StudentRecordSection`) y reportes (`StudentReportsSection`).
- **Flujo de Entrega (Stepper):** Proceso guiado en varios pasos gestionado por `StudentSubmissionFlow.tsx` y `PipelineStepper.tsx`.
- **Notificaciones y Banners:** Avisos en tiempo real sobre el estado de la evaluación (`EvaluationNotificationBanner.tsx`).

---

## Estructura Interna

```text
.
├── components/                     # Subcomponentes del flujo de entrega y sidebar
├── hooks/                          # Custom hooks (useSubmissionFlow, useEvaluationNotifications)
├── EvaluationNotificationBanner.tsx# Banner visual de notificaciones de evaluación
├── PipelineStepper.tsx             # Indicador gráfico de progreso en el pipeline
├── StudentAssignmentsSection.tsx   # Sección de asignaciones pendientes
├── StudentDeliveriesSection.tsx    # Sección de historial de entregas
├── StudentHomeSection.tsx          # Panel principal del estudiante
├── StudentRecordSection.tsx        # Sección de expediente académico
├── StudentReportsSection.tsx       # Sección de consulta de reportes y calificaciones
├── StudentSubmissionFlow.tsx       # Contenedor principal del modal/flujo de entrega
├── StudentWorkspacePanel.tsx       # Panel de trabajo e inspección
└── studentWorkflowState.ts         # Definición y helpers del estado de la entrega
```

---

## Flujo de Trabajo / Arquitectura

```text
[ StudentHomeSection ] ──> [ Seleccionar Proyecto ] ──> [ StudentSubmissionFlow ]
                                                                  │
                                                                  ▼
                                                      [ PipelineStepper (Pasos) ]
                                                                  │
                                                                  ▼
                                                  [ EvaluationNotificationBanner ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del flujo de estudiantes:
```bash
npm run test -- src/student
```
