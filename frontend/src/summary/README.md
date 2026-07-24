# Módulo de Resumen y Analíticas del Cohorte (src/summary)

> **Resumen rápido:** Dashboard analítico con métricas globales de entregas, distribución de notas, fallos frecuentes y progreso del grupo.

---

## Propósito y Responsabilidades
Ofrecer a los docentes una visión agregada del rendimiento académico de la clase.
- **Gráficos Estadísticos:** Distribución de calificaciones y progreso temporal.
- **Alertas Tempranas:** Identificación de patrones de errores comunes en las entregas.

---

## Estructura Interna

```text
.
└── components/
    └── CohortAnalyticsDashboard.tsx # Panel de control con gráficos interactivos
```

---

## Flujo de Trabajo / Arquitectura

```text
[ CohortAnalyticsDashboard ] ──> [ Analytics API ] ──> (Gráficos y Métricas)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del dashboard de analíticas:
```bash
npm run test -- src/summary
```
