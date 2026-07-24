# Componentes de Analíticas del Cohorte (summary/components)

> **Resumen rápido:** Dashboards e indicadores gráficos para el resumen estadístico de la clase.

---

## Propósito y Responsabilidades
Renderizar gráficos interactivos y métricas agregadas del rendimiento del grupo.
- **Dashboard:** `CohortAnalyticsDashboard.tsx` para análisis visual de calificaciones.

---

## Estructura Interna

```text
.
└── CohortAnalyticsDashboard.tsx # Componente de cuadro de mando estadístico
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Cohort Summary Page ] ──> [ CohortAnalyticsDashboard ] ──> Chart Visualizations
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de resumen:
```bash
npm run test -- src/summary/components
```
