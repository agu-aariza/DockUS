# Summary Components

Subcomponentes especializados para el panel de control y vistas de análisis agregado.

## Componentes

- **`CohortAnalyticsDashboard.tsx`**: Widget analítico por proyecto. Recibe una lista de proyectos, permite seleccionar uno y renderiza métricas de cohorte (aprobados, nota media, entregas, tests fallidos), distribución de calificaciones/estados y hallazgos de calidad.

## Convenciones

- Usar componentes del UI Kit (`SectionCard`, `MetricCard`, `StatusBadge`) para mantener consistencia visual.
- No modificar lógica de negocio ni llamadas a API; el rediseño es puramente visual/estructural.
