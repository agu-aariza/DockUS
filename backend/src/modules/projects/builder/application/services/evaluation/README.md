# Evaluación y feedback (`.../services/evaluation/`)

> **Resumen rápido:** Cuatro servicios que se ejecutan *después* de que el LLM haya respondido, para verificar que lo que dice es cierto, agregar métricas de calidad, generar feedback pedagógico útil, y componer el informe final. Es la capa que evita que una evaluación automatizada acabe alucinando una nota.

---

## `builder-hallucination-guard.service.ts` — la pieza más importante de este directorio

El LLM evalúa a partir del Trace (el log de ejecución) y del código fuente, pero un LLM puede afirmar cosas que los logs no respaldan (p. ej. "el programa imprimió el resultado correcto" cuando en realidad el log solo contiene errores de compilación). Este servicio **contrasta cada afirmación relevante de la evaluación contra la evidencia real** — si detecta una discrepancia, la marca como alucinación detectada y fuerza una reconciliación del estado (por ejemplo, degradando la nota de un estado optimista `E2` a uno más conservador `E1` si los logs solo muestran mensajes de compilación sin salida real del programa). Esto ocurre siempre, en cada evaluación, no es un chequeo opcional.

## Los otros tres servicios

| Fichero | Qué hace |
| --- | --- |
| `builder-quality-aggregation.service.ts` | Combina los hallazgos de calidad estática (uno por hallazgo/`CodeQualityFinding`) en métricas agregadas por categoría, usadas tanto en el informe individual como en los "quality insights" a nivel de proyecto. |
| `builder-pedagogical.service.ts` | Genera las recomendaciones pedagógicas legibles por un alumno a partir del veredicto ya verificado — el texto que realmente enseña algo, no solo lista errores. |
| `builder-report-composer.service.ts` | El último paso: combina calificación de rúbrica, resultado de tests, calidad y feedback pedagógico en el objeto de informe final que persiste `report-stage.handler.ts`. |

## Flujo

```text
Salida del LLM (evaluation-stage) + Trace real
        │
        ▼
BuilderHallucinationGuardService   ── detecta y corrige afirmaciones no respaldadas por evidencia
        │
        ▼
BuilderQualityAggregationService   ── agrega hallazgos de calidad (paralelo, desde quality-stage)
        │
        ▼
BuilderPedagogicalService          ── redacta el feedback que realmente lee el alumno
        │
        ▼
BuilderReportComposerService       ── ensambla el informe final consolidado
```

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder/application/services/evaluation
```

Si cambias el criterio de qué cuenta como "alucinación" en `builder-hallucination-guard.service.ts`, hazlo con mucho cuidado y con tests — es el único cortafuegos entre "lo que el LLM dice" y "la nota que recibe el alumno".

## Ver también

- [`../../../domain/ai/README.md`](../../../domain/ai/README.md) — los parsers de contrato que producen la entrada de estos servicios.
- [`../stages/README.md`](../stages/README.md) — `evaluation-stage.handler.ts` y `quality-stage.handler.ts`, quienes invocan este directorio.
