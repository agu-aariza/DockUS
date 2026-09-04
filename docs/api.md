# API HTTP y streaming

## Convenciones

El backend aplica el prefijo global `/api`. En desarrollo:

- base URL: `http://localhost:3000/api`;
- documentación Swagger: `http://localhost:3000/api/docs`;
- autenticación: `Authorization: Bearer <accessToken>`;
- errores: payload normalizado con `statusCode`, `error` y `message`.

Los DTOs y las vistas compartidas deben mantenerse alineados con [shared/contracts](../shared/contracts/index.ts). La autorización real siempre se valida en backend mediante JWT y roles; las rutas que desaparecen del frontend no dejan de existir como superficie de ataque.

## Patrón asíncrono del Builder

```text
POST /builder/deliveries/:deliveryId/run
        │
        └── 202 Accepted + buildRunId
                │
                ├── GET /builder/runs/:buildRunId
                ├── GET /builder/runs/:buildRunId/events
                └── GET /builder/runs/:buildRunId/stream
```

El `POST` no espera al LLM ni a Docker. El consumidor debe guardar `buildRunId`, mostrar `QUEUED`/`RUNNING` y leer eventos o consultar el detalle hasta un estado terminal.

## Endpoints del Builder

| Método y ruta | Uso |
| --- | --- |
| `POST /builder/deliveries/:deliveryId/run` | crea y encola una ejecución; responde `202` |
| `GET /builder/runs/:buildRunId` | detalle y estado de un run |
| `GET /builder/runs/:buildRunId/report` | proyección autorizada del informe v3 |
| `GET /builder/runs/:buildRunId/report/export` | exporta Markdown; acepta `audience=student|teacher` |
| `GET /builder/runs/:buildRunId/events` | backlog paginado; usa `afterSequence` |
| `GET /builder/runs/:buildRunId/stream` | stream SSE reanudable por secuencia |
| `POST /builder/runs/:buildRunId/cancel` | solicita cancelación de `QUEUED`/`RUNNING` |
| `GET /builder/deliveries/:deliveryId/runs` | historial paginado por entrega |
| `GET /builder/deliveries/latest-runs` | últimas ejecuciones de varias entregas |
| `GET /builder/runs/:buildRunId/evidence` | lista evidencias autorizadas |
| `GET /builder/runs/:buildRunId/evidence/:artifactId/download-url` | URL firmada de descarga |
| `GET /builder/runs/:buildRunId/evidence/:artifactId/content` | contenido de una evidencia |
| `GET /builder/assignments/:assignmentId/quality-insights` | agregados de calidad para personal docente |
| `GET /builder/runs/:buildRunId/chat/messages` | historial de chat del run |
| `POST /builder/runs/:buildRunId/chat` | pregunta pedagógica sobre el resultado |

La lista exacta de guards, roles y DTOs está en [builder.controller.ts](../backend/src/modules/projects/builder/presentation/builder.controller.ts).

## SSE

El stream usa `text/event-stream` y dos nombres de evento principales:

```text
event: ready
data: {"latestSequence": 12}

event: run-event
data: { ...BuildRunEvent... }
```

El cliente debe:

1. pedir primero el backlog con `afterSequence`;
2. abrir el stream con la secuencia más alta recibida;
3. deduplicar por id/secuencia;
4. reconectar con backoff si la conexión termina;
5. dejar de reconectar tras `RUN_COMPLETED`, `RUN_FAILED` o `RUN_CANCELLED`.

La API autentica el stream, autoriza el run, limita el backlog inicial y filtra datos internos para alumnos.

## Estados

| Estado | Significado |
| --- | --- |
| `QUEUED` | aceptado y pendiente en BullMQ |
| `RUNNING` | un worker lo está procesando |
| `SUCCESS` | pipeline finalizado con resultado |
| `FAILED` | error de infraestructura o etapa no recuperable |
| `CANCELLED` | cancelación aceptada/cooperada |

Un exit code no cero del programa evaluado no implica necesariamente `FAILED`: puede ser precisamente una evidencia usada por evaluación.

## Otros grupos de API

Además de Builder, la API agrupa endpoints de:

- autenticación y usuarios;
- proyectos, asignaciones y rúbricas;
- entregas y almacenamiento;
- grupos y perfiles de estudiantes;
- configuración LLM y runtime;
- salud (`/api/health/live` y `/api/health/readiness`).

Para explorarlos en el entorno local, usar Swagger en lugar de mantener una segunda lista manual de cada DTO.

## Referencias

- Pipeline: [pipeline.md](pipeline.md).
- Consumo desde React: [frontend.md](frontend.md).
- Controlador Builder: [builder.controller.ts](../backend/src/modules/projects/builder/presentation/builder.controller.ts).

