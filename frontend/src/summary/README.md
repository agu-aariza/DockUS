# Panel de inicio del profesor (`src/summary/`)

> **Resumen rápido:** `TeacherHomePanel.tsx`, la página de aterrizaje de un profesor: estado general del curso, cola de entregas por revisar, auditoría de integridad y analíticas del cohorte. Es el primer panel que ve un profesor al entrar.

---

## Los cuatro componentes que compone `TeacherHomePanel.tsx`

| Fichero | Qué muestra |
| --- | --- |
| `CourseStatusStrip.tsx` | Franja de indicadores de estado general (entregas pendientes, alertas, etc.) — un componente de presentación puro, recibe `CourseStatusReading[]` ya calculado. |
| `ReviewQueue.tsx` | Cola de entregas que necesitan revisión manual del profesor (recibe `DeliveryEntity[]`), con acceso directo a calificarlas. |
| `IntegrityAudit.tsx` | Panel de auditoría — señales relacionadas con posibles irregularidades detectadas en las entregas. |
| `CohortAnalyticsDashboard.tsx` | Dashboard de analíticas agregadas del grupo: distribución de notas, progreso temporal. |

## Estructura interna

```text
summary/
├── TeacherHomePanel.tsx    # Página: obtiene los datos agregados y compone los cuatro componentes de abajo
└── components/
    ├── CourseStatusStrip.tsx
    ├── ReviewQueue.tsx
    ├── IntegrityAudit.tsx
    └── CohortAnalyticsDashboard.tsx
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/summary
```

Los componentes de `components/` son mayormente de presentación (reciben datos ya resueltos por el panel) — si necesitas añadir una fuente de datos nueva, resuélvela en `TeacherHomePanel.tsx` con React Query y pásala como prop, no dupliques *fetching* dentro de un componente hijo.

## Ver también

- [`../deliveries/README.md`](../deliveries/README.md) — a dónde lleva `ReviewQueue.tsx` al seleccionar una entrega.
