# Datos, contratos y eventos

## Principio de ownership

El estado duradero vive en el backend. El frontend consume proyecciones autorizadas y el worker publica progreso; Redis y la memoria local aceleran el flujo, pero no reemplazan la fuente canónica.

```text
PostgreSQL  → estado transaccional, runs, informes, eventos y proyecciones
Redis       → BullMQ, pub/sub, caché, locks, throttling y circuit breakers
MinIO/S3    → entregas, suites, logs y evidencias binarias
Contratos   → formas TypeScript compartidas entre backend y frontend
```

## Contratos compartidos

[shared/contracts/index.ts](../shared/contracts/index.ts) es un paquete de tipos puros: no exporta lógica de runtime, constantes ejecutables ni acceso a servicios. En él se definen, entre otros:

- estados de entrega: `DRAFT`, `SUBMITTED`, `IN_REVIEW`, `EVALUATED`;
- estados de `BuildRun`: `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED`;
- tipos de evento del Builder;
- contratos de evidencia, progreso, rúbrica, calidad y report v3;
- vistas `StudentReportView`, `TeacherReportView` y mensajes de chat.

Backend y frontend apuntan al mismo paquete local para evitar dos modelos incompatibles del mismo payload.

## PostgreSQL

PostgreSQL es la fuente canónica para el ciclo de vida de una ejecución. Las entidades más relevantes son:

| Entidad | Datos |
| --- | --- |
| `BuildRun` | entrega, actor, estado, secuencia, evaluación JSONB, calidad, informe, warnings, costes y timestamps |
| `BuildRunEvent` | secuencia por run, tipo, mensaje, estado y payload |
| `BuildRunArtifact` | metadatos de prompt, trace, informe o evidencia almacenados en object storage |
| `CodeQualityFinding` | proyección consultable de hallazgos por proyecto/alumno/categoría/archivo/línea |
| `LlmConfiguration` | proveedor, modelo, endpoint, roles asignados y credenciales cifradas |

Las transiciones críticas se hacen con actualizaciones atómicas. `latestEventSequence` y la secuencia del evento permiten ordenar y reanudar streams. En producción `DB_SYNCHRONIZE` debe permanecer desactivado y el esquema se actualiza con migraciones TypeORM.

## Redis

Redis cumple varios papeles, con garantías distintas:

- cola BullMQ `builder-runs` para trabajo asíncrono;
- Pub/Sub para que la API reciba eventos emitidos por workers;
- caché de identidad y configuración;
- locks distribuidos para imágenes de entorno;
- clave rápida de cancelación;
- estado Docker del worker para readiness;
- contador/estado de circuit breaker y throttling.

Si falla Pub/Sub, los eventos del mismo proceso siguen pudiendo consumirse localmente; si falla Redis al encolar, el comando marca el run como fallido. Las consultas históricas siempre deben poder reconstruirse desde PostgreSQL.

## MinIO / S3

Object storage contiene el archivo de entrega, la suite docente y evidencias o artefactos grandes. La aplicación registra metadatos y emite URLs firmadas para descargas autorizadas. La suite docente se descarga en un directorio separado del código del alumno y se monta en solo lectura durante la ejecución.

La retención de evidencias se configura con `STORAGE_EVIDENCE_RETENTION_DAYS`; el Compose actual aplica la regla a `runs/`. Los backups de MinIO y PostgreSQL deben coordinarse si se necesita reconstruir un informe con sus evidencias.

## Eventos del Builder

Los eventos tienen id, run, secuencia, tipo, timestamp y payload. El worker los persiste y publica; la API los autoriza, filtra y sirve:

| Familia | Ejemplos |
| --- | --- |
| ciclo de vida | `RUN_ENQUEUED`, `RUN_STARTED`, `RUN_STATUS_CHANGED`, `RUN_COMPLETED` |
| ejecución | `LOG_CHUNK`, `WARNING_ADDED` |
| artefactos | `ARTIFACT_ADDED`, `REPORT_READY` |
| cancelación/error | `RUN_CANCELLED`, `RUN_FAILED` |

El stream comienza con backlog y continúa desde `afterSequence`. La proyección estudiantil elimina información de staff, prompts, respuestas crudas, tests docentes y texto sensible antes de enviarlo.

## Informe v3

El informe se almacena como contrato versionado `builder-report/v3`. Su contenido combina:

- grade provisional/oficial y estado;
- comparación con expectativas;
- rúbrica y evidencias;
- narrativas pedagógicas;
- hallazgos y limitaciones;
- preview específico del alumno;
- auditoría y flags de revisión para docentes.

El backend compone la forma autorizada; el frontend decide cómo presentarla, pero no calcula notas ni expone el JSON interno del LLM.

## Consistencia y lectura

1. Una petición puede devolver `202` antes de que exista cualquier resultado.
2. El cliente debe consultar el run y sus eventos por id.
3. El evento SSE es una notificación de progreso, no la única fuente de verdad.
4. Tras una reconexión, el cliente debe pedir backlog desde la última secuencia conocida.
5. Para auditoría, usar PostgreSQL y artefactos autorizados; no confiar solo en logs de Redis.

## Referencias

- Flujo completo: [pipeline.md](pipeline.md).
- Seguridad de datos y artefactos: [security.md](security.md).
- Entidades: [backend/src/modules/projects/builder/domain/entities](../backend/src/modules/projects/builder/domain/entities).

