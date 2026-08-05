# Infraestructura del Builder (`builder/infrastructure/`)

> **Resumen rápido:** Las implementaciones concretas de los puertos de `domain/`: repositorios TypeORM, publicación de eventos en tiempo real vía Redis, persistencia de evidencias, y utilidades de extracción segura de archivos subidos por alumnos.

---

## Estructura interna

```text
infrastructure/
├── database/    # Implementaciones TypeORM de los 6 puertos de domain/repositories/
├── events/      # builder-run-events.service.ts — publica eventos de un run en Redis Pub/Sub
├── evidence/    # evidence.service.ts — persiste y sirve artefactos (logs, ficheros) de un run
└── utils/       # Extracción segura de ZIP/tar.gz, recorte de logs, helpers de análisis de rutas
```

`config/` **no existe aquí** aunque podría esperarse: `BuilderLlmConfigService`/`BuilderLlmProviderTester` vivían en esta carpeta pero se movieron a `application/services/config/` — son casos de uso (leen/escriben configuración a través del puerto `ILlmConfigurationRepository`), no infraestructura cruda de acceso a un servicio externo.

## `events/`: cómo llega el progreso en vivo al frontend

`BuilderRunEventsService` usa Redis Pub/Sub (no BullMQ) para difundir eventos de un `BuildRun` mientras se ejecuta. El proceso API los consume y los reexpone al frontend como Server-Sent Events (`GET /builder/runs/:id/stream`, ver `useBuilderRunStream` en el frontend) — así el navegador ve el progreso etapa por etapa sin hacer polling constante. Es un canal efímero: los eventos también se persisten como `BuildRunEvent` (vía `infrastructure/database/build-run-event.repository.ts`) para poder reconstruir el historial si alguien se conecta al stream tarde o se reconecta.

## `evidence/`: por qué los artefactos llevan hash

`EvidenceService` persiste cada artefacto (log completo, ficheros de salida) como `BuildRunArtifact`, calculando su huella SHA-256 (`toSha256Hex`) antes de guardarlo — mismo principio que en `storage/`: la integridad del artefacto se verifica con un hash calculado por el propio servidor, nunca confiado del origen. El binario real se sube al almacenamiento de objetos a través del puerto `IObjectStorage` (`domain/ports/object-storage.port.ts`), nunca hablando con MinIO directamente desde aquí.

## `utils/`: extracción segura de archivos de alumnos

Un ZIP/tar.gz subido por un alumno **no es de confianza**. `archive-extractor.util.ts` + `builder-analysis.util.ts` existen específicamente para evitar ataques de *path traversal* durante la descompresión: `isUnsafeRelativePath()` rechaza cualquier entrada del archivo cuya ruta sea absoluta o contenga `..` (que intentaría escribir fuera del directorio de destino), y hay límites explícitos de número de ficheros (`DEFAULT_MAX_EXTRACTED_FILES`) y de bytes totales (`DEFAULT_MAX_EXTRACTED_BYTES`, definidos en `domain/builder.constants.ts`) para evitar una *zip bomb*. `builder-log-trimmer.util.ts` es un problema distinto: recorta el log de ejecución para no reventar la ventana de contexto del LLM, priorizando las líneas finales y las que contienen errores (no un recorte ciego por longitud).

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder/infrastructure
```

Si tocas `archive-extractor.util.ts`, cualquier cambio debe mantener las tres protecciones (path traversal, límite de ficheros, límite de bytes) — es la única barrera entre "un ZIP subido por un desconocido" y el sistema de ficheros del Worker.

## Ver también

- [`../domain/README.md`](../domain/README.md) — los puertos que estos adaptadores implementan.
- [`../../../../shared/infrastructure/cache/README.md`](../../../../shared/infrastructure/cache/README.md) — el cliente Redis usado por `events/`.
