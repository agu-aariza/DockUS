# Libro de notas y progreso (`projects/components/progress/`)

> **Resumen rápido:** El libro de calificaciones interactivo de un proyecto: tabla filtrable, gráficos de distribución de notas, métricas de participación, y los modales de inspección/calificación de una entrega concreta.

---

## Los ocho ficheros

| Fichero | Qué hace |
| --- | --- |
| `ProjectSelector.tsx` | Elegir sobre qué proyecto se muestra el progreso (reutiliza el mismo patrón que `groups/components/GroupSelector.tsx`). |
| `GradebookFilters.tsx` | Filtros de la tabla: por grupo, estado de entrega, rango de nota. |
| `GradebookTable.tsx` | La tabla principal — una fila por alumno/entrega, con acceso rápido a calificar. |
| `DistributionCharts.tsx` | Gráficos de distribución de notas del grupo. |
| `ProgressStatsPanel.tsx` | Estadísticas agregadas (media, entregas pendientes, tasa de aprobado). |
| `ParticipationProgress.tsx` | Porcentaje de alumnos que ya han entregado, sobre el total asignado. |
| `DeliveryHistoryModal.tsx` | Historial de versiones de entrega de un alumno concreto (un alumno puede reentregar hasta `maxDeliveriesPerStudent` veces). |
| `PreviewOrGradingModal.tsx` | Modal combinado: previsualizar el código entregado o editar la nota, sin salir del libro de notas. |

## De dónde sale el dato que se muestra

Esta vista consume el mismo endpoint agregado que expone `project-gradebook.controller.ts` en el backend (`GET /projects/:id/gradebook`) — no recalcula notas en el cliente, solo las presenta y filtra. Si una nota se edita desde `PreviewOrGradingModal.tsx`, la mutación va al mismo sitio que usa `deliveries/components/DeliveryGrading.tsx` — son dos entradas a la misma operación de negocio, no dos flujos distintos.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/projects/components/progress
```

## Ver también

- [`../../../deliveries/README.md`](../../../deliveries/README.md) — la vista de detalle de una entrega individual.
- [`../../../../../backend/src/modules/projects/README.md`](../../../../../backend/src/modules/projects/README.md) — `project-gradebook.service.ts`, la fuente de estos datos.
