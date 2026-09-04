# Orquestación del Builder (`.../services/orchestration/`)

> **Resumen rápido:** El "cerebro" del motor de evaluación — decide cuándo arranca, avanza, se cancela o falla un `BuildRun`, controla cuánto se gasta en LLM, y recupera runs que quedaron colgados si el Worker murió a mitad de ejecución.

---

## Los once ficheros

| Fichero | Qué hace |
| --- | --- |
| `builder-run-commands.service.ts` | Punto de entrada para **encolar** un run nuevo (`POST /builder/deliveries/:id/run`). Usa `throwIfUniqueViolation` para convertir el índice único `UQ_build_runs_delivery_active` en un `409` limpio si ya hay un run activo para esa entrega. |
| `builder-pipeline-orchestrator.service.ts` | Compone las seis etapas del pipeline (`../stages/`) en orden y **es la única pieza autorizada a marcar un run como `FAILED`** — cada etapa debe lanzar, no capturar, sus errores. |
| `builder-run-lifecycle.service.ts` | Las transiciones de estado válidas de `BuildRunStatus` (`QUEUED → RUNNING → SUCCESS/FAILED/CANCELLED`). |
| `builder-run-cancellation.service.ts` | Cancelación **cooperativa**: no mata el proceso Docker a la fuerza, marca una señal (vía el puerto `distributed-cache.port.ts`) que las etapas comprueban en puntos seguros. |
| `run-cancelled.error.ts` | El error tipado que las etapas lanzan cuando detectan la señal de cancelación — así el orquestador distingue "cancelado a propósito" de "fallo real". |
| `builder-run-queries.service.ts` | Lecturas para la API: estado de un run, lista por entrega, últimos runs por lote de entregas. |
| `builder-run-support.service.ts` | Utilidades compartidas entre los servicios de esta carpeta que no encajan en ninguno concreto (evita duplicar helpers pequeños entre lifecycle/commands/queries). |
| `builder-run-metrics.service.ts` | Recoge métricas de la ejecución (duración por etapa, etc.) para observabilidad. |
| `builder-spend-quota.service.ts` | Corta la ejecución si un proyecto supera `BUILDER_PROJECT_SPEND_QUOTA_USD` (0 = sin límite) — protección contra un LLM desbocado consumiendo presupuesto. |
| `builder-stale-run-recovery.service.ts` | Al arrancar el Worker, busca runs que quedaron en `RUNNING`/`QUEUED` sin resolver (el proceso murió a mitad) y los marca como fallidos o los reencola, según el umbral `DEFAULT_STALE_RUN_THRESHOLD_MS`. |
| `builder-image-retention.service.ts` | Poda periódica de imágenes Docker de entorno ya no usadas (`BUILDER_CLEANUP_IMAGES`/`BUILDER_IMAGE_TTL_MS`). |

## El ciclo de vida completo

```text
POST /builder/deliveries/:id/run
        │
        ▼
BuilderRunCommandsService.enqueue()
  · valida que no haya un run activo ya (índice único → 409 si lo hay)
  · crea el BuildRun en estado QUEUED
  · encola el job en BullMQ con prioridad INTERACTIVE o BATCH
        │
        ▼ (en el proceso Worker, ver builder.processor.ts)
BuilderPipelineOrchestrator.run(buildRunId)
  · BuilderRunLifecycleService transiciona QUEUED → RUNNING
  · ejecuta las 6 etapas de ../stages/ en orden
  · si cualquier etapa lanza (incluida RunCancelledError) → FAILED o CANCELLED
  · si todo va bien → SUCCESS
```

En paralelo, `builder-stale-run-recovery.service.ts` corre al arrancar el Worker (y `builder-image-retention.service.ts` periódicamente) para que el sistema se auto-repare tras un reinicio o caída inesperada.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/orchestration
```

Si tu cambio afecta a **cuándo** algo pasa (no a qué pasa dentro de una etapa concreta), casi seguro pertenece aquí. Si necesitas marcar un run como fallido desde una etapa, lanza el error — no llames a `builder-run-lifecycle.service.ts` directamente desde dentro de un `*-stage.handler.ts`; deja que `BuilderPipelineOrchestrator` decida.

## Ver también

- [`../stages/README.md`](../stages/README.md) — lo que se ejecuta dentro de cada transición.
- [`../../../README.md`](../../../README.md) — visión general del Builder y el ciclo QUEUED→RUNNING→SUCCESS/FAILED/CANCELLED.
