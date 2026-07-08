## Propósito de la carpeta
Aloja los sub-componentes específicos del dominio de "Resumen/Analítica", como dashboards interactivos de métricas y cohortes.

## Límites y Reglas Estrictas
Solo componentes altamente acoplados al dominio de reportes agregados y gráficas del profesor. No colocar componentes UI genéricos aquí.

## Anti-Patrones y Gotchas ⚠️
Exportar y re-usar estos componentes en otras partes de la app como el entorno del estudiante. Están diseñados asumiendo roles de profesor/admin.

## Dependencias de Contexto Asumidas
Requiere datos pasados mediante props desde el Panel principal, a menudo dependiendo de llamadas al backend previamente resueltas.

## Inputs / Outputs Esperados
Componentes React que aceptan métricas o arreglos de datos estadísticos para renderizarlos en dashboards.

## Ejemplo de uso
```tsx
import { CohortAnalyticsDashboard } from '@/summary/components/CohortAnalyticsDashboard';

<CohortAnalyticsDashboard cohortStats={data} />
```

## Formato de Archivos
Componentes de presentación complejos en PascalCase (`CohortAnalyticsDashboard.tsx`).
