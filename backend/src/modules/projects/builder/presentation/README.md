# Presentación del Builder (`builder/presentation/`)

> **Resumen rápido:** Las dos puertas de entrada al motor de evaluación: `builder.controller.ts` (18 endpoints REST, corre en el proceso API) y `builder.processor.ts` (el consumidor BullMQ que ejecuta el pipeline de verdad, corre solo en el proceso Worker). Ninguno de los dos contiene lógica de negocio — ambos delegan en los servicios de `application/services/`.

---

## `builder.controller.ts`: 18 endpoints bajo `/builder`

Todos protegidos con `JwtAuthGuard` + `RolesGuard`; el rol requerido varía por endpoint (marcado abajo). Nótese que `STUDENT` puede lanzar y consultar sus propias ejecuciones, pero **no** cancelarlas ni ver *quality insights* agregados — esas dos acciones son exclusivas de `TEACHER`/`ADMIN`.

| Método | Ruta | Roles | Qué hace |
| --- | --- | --- | --- |
| `POST` | `deliveries/:deliveryId/run` | ADMIN/TEACHER/STUDENT | Encola una ejecución nueva (`202 Accepted`). `409` si ya hay una activa para la entrega. |
| `GET` | `runs/:buildRunId` | ADMIN/TEACHER/STUDENT | Estado actual de un run. |
| `GET` | `runs/:buildRunId/events` | ADMIN/TEACHER/STUDENT | Historial de eventos — `@SkipThrottle({ burst: true })`, porque el *fallback* a polling del frontend golpea este endpoint con más frecuencia de lo normal cuando el SSE falla. |
| `GET` | `runs/:buildRunId/stream` | ADMIN/TEACHER/STUDENT | El stream SSE en vivo — ver detalle abajo. |
| `GET` | `deliveries/latest-runs` | ADMIN/TEACHER/STUDENT | Último run por cada entrega de un lote (usado por `runtime/`, `storage/` en el frontend). |
| `GET` | `deliveries/:deliveryId/runs` | ADMIN/TEACHER/STUDENT | Historial de runs de una entrega. |
| `POST` | `runs/:buildRunId/cancel` | ADMIN/TEACHER | Cancelación cooperativa (ver `orchestration/README.md`). |
| `GET` | `runs/:buildRunId/evidence` | ADMIN/TEACHER/STUDENT | Lista de artefactos de evidencia. |
| `GET` | `runs/:buildRunId/evidence/:artifactId/download-url` | ADMIN/TEACHER/STUDENT | URL firmada de descarga de un artefacto. |
| `GET` | `runs/:buildRunId/evidence/:artifactId/content` | ADMIN/TEACHER/STUDENT | Contenido de un artefacto (ficheros pequeños, sin pasar por URL firmada). |
| `GET` | `assignments/:assignmentId/quality-insights` | ADMIN/TEACHER | Calidad agregada de todas las entregas de una asignación. |
| `GET` | `runs/:buildRunId/chat/messages` | ADMIN/TEACHER/STUDENT | Historial del chat pedagógico de un run. |
| `POST` | `runs/:buildRunId/chat` | ADMIN/TEACHER/STUDENT | Envía un mensaje al tutor pedagógico (rol `chatbot`). |
| `GET` / `POST` | `llm-configs` | ADMIN | Leer/guardar la configuración de proveedores por rol. |
| `POST` | `llm-configs/:providerId/test` | ADMIN | Prueba de conexión real contra un proveedor (`BuilderLlmProviderTester`). |

## El endpoint SSE: por qué no es un `@Get` cualquiera

`GET runs/:buildRunId/stream` no delega en un servicio que devuelva JSON — mantiene la conexión HTTP abierta y escribe eventos según BuilderRunEventsService (`infrastructure/events/`, Redis Pub/Sub) los va emitiendo. El frontend lo consume con `fetch` + `ReadableStream` (`useBuilderRunStream`, no la `EventSource` nativa, porque necesita adjuntar `Authorization`). Si el stream se cae, el frontend recurre a `GET runs/:buildRunId/events` en modo polling — de ahí que ese endpoint tenga el límite de ráfaga (`burst`) desactivado explícitamente.

## `builder.processor.ts`: el consumidor real de la cola

Un detalle no obvio que vale la pena entender antes de tocar este fichero: el decorador `@Processor(...)` de NestJS **se evalúa al importar la clase**, antes de que exista el contenedor de inyección de dependencias — así que no hay `ConfigService` disponible en ese momento. Por eso `resolveWorkerConcurrency()` y `resolveStaleRunThresholdMs()` leen `process.env` directamente en vez de inyectar configuración, con valores por defecto seguros si la variable falta o es inválida.

Dos parámetros de BullMQ están deliberadamente enlazados:

- **`concurrency`** (`BUILDER_WORKER_CONCURRENCY`, tope defensivo de 64): cada unidad de concurrencia es un contenedor Docker con su propio límite de memoria — un valor desmedido no agota la cola, agota la RAM del host, y el OOM se lleva al proceso Worker entero, no solo a un contenedor.
- **`lockDuration`** (alineado con `BUILDER_STALE_RUN_THRESHOLD_MS`): con el valor por defecto de BullMQ (30s), cualquier corte de Redis o un OOM bajo carga marcaría el job como "stalled" y lo reencolaría mientras el run original sigue vivo — duplicando la ejecución en Docker y, peor, las llamadas al LLM ya facturadas para ese mismo `BuildRun`. `maxStalledCount: 0` desactiva además el reencolado automático de BullMQ: un job "stalled" se marca `FAILED` directamente, y la recuperación real de runs huérfanos queda a cargo de `BuilderStaleRunRecoveryService` (a nivel de base de datos, no de la cola).

El processor en sí es fino: recibe el `Job<ExecuteBuildRunJobData>` y delega en `BuilderRunLifecycleService`/`BuilderPipelineOrchestrator` — no contiene lógica del pipeline.

## `dto/`

```text
dto/
├── build-run-core.dto.ts               # Formas base compartidas de BuildRun
├── build-run-response.dto.ts             # Respuesta pública de un run (toBuildRunResponseDto)
├── build-run-events.dto.ts                 # Respuesta de eventos/historial
├── build-run-evidence.dto.ts                 # Artefactos de evidencia
├── list-build-runs.dto.ts                      # Query de listado paginado
├── latest-runs-by-deliveries.dto.ts               # Query/respuesta de "último run por entrega"
├── chat-message.dto.ts                              # Mensajes del chat pedagógico
└── llm-config.dto.ts                                   # Configuración/test de proveedores LLM
```

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder/presentation
```

## Ver también

- [`../application/services/orchestration/README.md`](../application/services/orchestration/README.md) — `BuilderRunCommandsService`/`BuilderRunLifecycleService`, a quienes delega este controlador y processor.
- [`../infrastructure/README.md`](../infrastructure/README.md) — `BuilderRunEventsService`, el origen de los eventos del stream SSE.
- [`../../../../../frontend/src/builder/README.md`](../../../../../frontend/src/builder/README.md) — el consumidor del stream en el frontend.
