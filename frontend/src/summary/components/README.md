# Componentes del panel de inicio (`summary/components/`)

> **Resumen rápido:** Los cuatro bloques visuales que `TeacherHomePanel.tsx` compone — ver la tabla completa en [`../README.md`](../README.md), que los describe todos juntos porque forman una sola página. Este README existe como punto de navegación para quien llega directo a esta subcarpeta.

---

## Los cuatro ficheros

```text
CourseStatusStrip.tsx        # Franja de indicadores — componente puro, recibe CourseStatusReading[]
ReviewQueue.tsx                # Cola de entregas pendientes de revisión — recibe DeliveryEntity[]
IntegrityAudit.tsx               # Señales de auditoría de integridad
CohortAnalyticsDashboard.tsx       # Distribución de notas y progreso del grupo
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/summary/components
```

## Ver también

- [`../README.md`](../README.md) — la descripción completa de cómo `TeacherHomePanel.tsx` compone estos cuatro componentes.
