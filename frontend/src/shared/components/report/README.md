# Componentes de Reportes de Evaluación (shared/components/report)

> **Resumen rápido:** Insignias de severidad y resultado, tarjetas de reportes y visualizadores de hallazgos técnicos.

---

## Propósito y Responsabilidades
Presentar los resultados de las evaluaciones y análisis estáticos/dinámicos de forma visual y accesible.
- **Insignias Visuales:** `OutcomeBadge.tsx` (Éxito, Fallo, Advertencia) y `SeverityBadge.tsx` (Crítico, Alto, Medio, Bajo).
- **Tarjetas y Cabeceras:** `ReportCard.tsx`, `ReportHeader.tsx` y `TechnicalFindingCard.tsx`.

---

## Estructura Interna

```text
.
├── OutcomeBadge.tsx          # Insignia del resultado general de la evaluación
├── ReportCard.tsx            # Tarjeta resumen de informe de evaluación
├── ReportHeader.tsx          # Cabecera detallada del reporte con puntuación final
├── SeverityBadge.tsx         # Insignia codificada por color para la severidad del error
└── TechnicalFindingCard.tsx  # Tarjeta para detallar un hallazgo o error técnico específico
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Report View ] ──> [ ReportHeader ] ──> [ OutcomeBadge + SeverityBadge ]
                └──> [ TechnicalFindingCard ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de reporte:
```bash
npm run test -- src/shared/components/report
```
