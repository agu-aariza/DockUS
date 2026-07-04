# Frontend: Panel de Entregas

Este módulo permite a profesores/admin listar, revisar y calificar entregas de estudiantes. La vista principal es `TeacherDeliveriesPanel.tsx`; el estado y las llamadas de dominio viven en `hooks/`.

## Estructura

- `TeacherDeliveriesPanel.tsx`: vista principal de entregas.
- `teacherReviewNavigation.ts`: navegación entre entregas y extracción de evidencias legacy.
- `utils.ts`: helpers de presentación/formato.
- `components/AssignmentLabel.tsx`: etiqueta de asignación individual/grupal.
- `components/DeliveriesSidebar.tsx`: cola lateral con búsqueda, filtros y métricas.
- `components/DeliveryDetailHeader.tsx`: encabezado de la entrega seleccionada.
- `components/DeliveryOverview.tsx`: resumen operativo y adjuntos.
- `components/DeliveryGrading.tsx`: calificación/manual feedback.
- `components/DeliveryReport.tsx`: reporte técnico/pedagógico.
- `components/DeliveryListItem.tsx`: tarjeta de entrega en la cola.
- `components/TeacherReviewSummary.tsx`: resumen de revisión docente.
- `hooks/useDeliveriesPanel.ts`: estado local de filtros/selección.
- `hooks/useDeliveryManagement.ts`: integración con API de entregas.

## Sistema Visual

Usa el UI kit compartido (`PageHeader`, `Button`, `Tabs`, `StatusBadge`, `SearchInput`, `MetricCard`, `EmptyState`) y los tokens institucionales (`bg-app-bg`, `bg-white`, `border-app-border`, `text-primary`, `text-accent`, `text-slate-*`).

No se usan tokens legacy (`academic-*`, `brand-maroon`, `brand-blue`, `shadow-academic`) ni microcomponentes de estado propios cuando `StatusBadge` cubre el caso.

## Mantenibilidad

- Mantener navegación y mapeos de review en `teacherReviewNavigation.ts`.
- Mantener side effects y API en hooks, no en componentes presentacionales.
- Si se añade o elimina un componente, actualizar este README y verificar `npm run knip`.
