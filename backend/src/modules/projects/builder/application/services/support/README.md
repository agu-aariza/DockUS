# Soporte de evaluación (`application/services/support/`)

> **Resumen rápido:** Un único fichero, `builder-fallback-assessment.util.ts` — funciones puras que garantizan que el pipeline **siempre** produce una evaluación, incluso cuando el LLM falla o devuelve un contrato inválido. Es la red de seguridad final antes de que un `BuildRun` se marque `FAILED` sin más explicación.

---

## El problema que resuelve

Un LLM puede fallar de formas que no son "el proveedor está caído": puede devolver JSON malformado, omitir campos requeridos, o simplemente no completar la respuesta a tiempo. Sin este módulo, cualquiera de esos casos propagaría un error crudo hasta el alumno/profesor sin ningún veredicto útil. En su lugar, estas funciones construyen una evaluación **degradada pero honesta** a partir de lo que sí se sabe con certeza (el Trace real de ejecución), en vez de fallar sin más.

## Las siete funciones

| Función | Qué hace |
| --- | --- |
| `requireParsedContract(trace)` | Extrae el contrato ya parseado de un `BuilderLlmStageTrace`, o lanza con el mensaje de error más específico disponible si no se pudo obtener uno válido. |
| `buildFallbackObservedEvidence(execution, errorMessage)` | Construye evidencia observable a partir de `stdout`/`stderr` **estructurados** (no un blob de texto que haya que volver a filtrar por prefijos como `"STDOUT:"`) cuando no hay un contrato de evaluación fiable del LLM. |
| `buildFallbackEvaluationLimits(...)` | Límites conservadores para una evaluación degradada (p. ej. nota máxima alcanzable), para que un fallo del LLM nunca produzca accidentalmente una nota más alta de la que la evidencia real respalda. |
| `reconcileStateWithGradeBreakdown(...)` | Ajusta el estado evaluativo (`E1`–`E4`) para que sea coherente con el desglose de nota calculado — evita que el informe final se contradiga a sí mismo. |
| `resolveEvaluationAssessment(...)` | El punto de entrada principal: decide si usar el contrato real del LLM o construir uno degradado, y devuelve la evaluación final que consume `evaluation-stage.handler.ts`. |
| `buildEmptyCodeQualityContract()` | Un `BuilderCodeQualityContractV2` vacío pero válido, para cuando la etapa de calidad falla — el informe muestra "sin hallazgos disponibles" en vez de romperse. |
| `resolveCodeQualityFindings(...)` | Resuelve la lista final de hallazgos de calidad, real o vacía según corresponda. |

## Por qué es `support/` y no `evaluation/`

`evaluation/` (ver su propio README) contiene los servicios que procesan una evaluación que **ya se obtuvo correctamente** del LLM (guardia anti-alucinación, agregación de calidad, composición del informe). `support/` es específicamente el camino cuando eso **no** ocurrió — la lógica de qué hacer ante un fallo del LLM es distinta en espíritu de la lógica de qué hacer con un éxito, así que se mantiene separada en vez de mezclar ambos casos en los mismos servicios.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/support
```

Si el LLM empieza a fallar de una forma nueva no cubierta aquí, el punto de entrada es `resolveEvaluationAssessment(...)` — añade el caso ahí en vez de dejar que el fallo se propague sin control hasta el orquestador.

## Ver también

- [`../evaluation/README.md`](../evaluation/README.md) — el camino "feliz" que este módulo complementa.
- [`../stages/README.md`](../stages/README.md) — `evaluation-stage.handler.ts` y `quality-stage.handler.ts`, los consumidores principales.
