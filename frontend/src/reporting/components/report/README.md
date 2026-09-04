# Componentes de informe (`reporting/components/report/`)

> **Resumen rápido:** Cinco piezas visuales específicas de un informe de evaluación — insignias de resultado/severidad y las tarjetas que lo estructuran. Construidas sobre `shared/components/ui/StatusBadge.tsx`, no lo reimplementan.

---

## Los cinco ficheros

| Fichero | Qué es |
| --- | --- |
| `OutcomeBadge.tsx` | El veredicto general (Apto / Necesita mejoras / No apto) — el resumen de una línea del resultado. |
| `SeverityBadge.tsx` | Severidad de un hallazgo individual (crítico/alto/medio/bajo), usada en hallazgos de calidad de código. |
| `ReportHeader.tsx` | Cabecera del informe completo, con la puntuación final. |
| `ReportCard.tsx` | Tarjeta resumen (usada en listados, no en la vista de detalle completa). |
| `TechnicalFindingCard.tsx` | Un hallazgo técnico individual con su severidad y explicación. |

## Por qué esto no vive en `ui/`

Estos componentes ya conocen vocabulario del dominio de evaluación (qué es un "hallazgo", qué severidades existen) — por eso no cumplen la regla de `ui/` (agnóstico de negocio) y viven un nivel más arriba, en `shared/components/`, reutilizables entre `deliveries/`, `student/` y `builder/` pero no completamente "dumb".

## Cómo trabajar aquí

```bash
npm run test -- test/unit/reporting/components/report
```

Si necesitas un nuevo tono de severidad o resultado, añádelo a `StatusTone` en `shared/components/ui/StatusBadge.tsx` primero — estos componentes deberían consumir esa fuente única, no declarar sus propios colores.

## Ver también

- [`../../../shared/components/ui/README.md`](../../../shared/components/ui/README.md) — `StatusBadge`, la base de estos componentes.
- [`../../../shared/data/README.md`](../../../shared/data/README.md) — la taxonomía de códigos del contrato del builder que alimenta estos badges.
