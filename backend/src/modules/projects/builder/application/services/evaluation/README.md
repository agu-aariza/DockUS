# Servicios de Evaluación y Feedback (builder/application/services/evaluation)

> **Resumen rápido:** Servicios de evaluación pedagógica, filtrado anti-alucinación de respuestas de IA, agregación de métricas de calidad y composición del reporte final.

---

## Propósito y Responsabilidades
Garantizar la veracidad y calidad pedagógica de las evaluaciones automatizadas.
- **Filtro Anti-Alucinación:** `builder-hallucination-guard.service.ts` para contrastar las observaciones del LLM contra los artefactos reales producidos por la ejecución.
- **Composición del Reporte:** `builder-report-composer.service.ts` para consolidar calificaciones de rúbricas, outputs de tests y notas pedagógicas (`builder-pedagogical.service.ts`).

---

## Estructura Interna

```text
.
├── builder-hallucination-guard.service.ts  # Guardia de veracidad que valida las afirmaciones del LLM
├── builder-pedagogical.service.ts          # Generador de recomendaciones pedagógicas y feedback
├── builder-quality-aggregation.service.ts  # Agregador de métricas y puntuaciones de calidad
└── builder-report-composer.service.ts      # Composidor del informe final de evaluación
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Salida LLM + Output Tests ] ──> [ BuilderHallucinationGuard ]
                                              │
                                              ▼
                                 [ BuilderQualityAggregation ]
                                              │
                                              ▼
                                  [ BuilderReportComposer ] ──> Reporte Final JSON
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de evaluación del builder:
```bash
npm run test -- src/modules/projects/builder/application/services/evaluation
```
