# Dominio del Builder (`builder/domain/`)

> **Resumen rápido:** Las entidades reales (`BuildRun` y las cuatro tablas relacionadas), sus puertos de persistencia, los puertos hexagonales hacia Docker/MinIO/Redis, el catálogo de entornos de ejecución soportados, y el subdominio de IA (parsers de contrato LLM). Sin dependencias de TypeORM más allá de los decoradores de las propias entidades.

---

## Las cinco entidades (`entities/`)

```text
build-run.entity.ts              # BuildRun — la entidad central, ver abajo
build-run-artifact.entity.ts     # Un artefacto persistido (log, fichero de salida) de un run
build-run-event.entity.ts        # Un evento del ciclo de vida del run (para el stream SSE y auditoría)
build-run-chat-message.entity.ts # Un mensaje del chat pedagógico post-evaluación (rol "chatbot")
code-quality-finding.entity.ts   # Un hallazgo individual de calidad estática
llm-configuration.entity.ts      # Configuración de proveedor LLM por rol, elegida por el profesor
```

`BuildRun` (tabla `build_runs`) tiene `status: BuildRunStatus` (`QUEUED | RUNNING | SUCCESS | FAILED | CANCELLED`) y un índice único parcial que garantiza que **una `Delivery` no puede tener dos `BuildRun` activos simultáneos** (`UQ_build_runs_delivery_active`). Es la entidad de la que cuelgan artefactos, eventos y mensajes de chat.

## Los puertos de persistencia (`repositories/`)

Uno por entidad (`build-run.repository.interface.ts`, `build-run-artifact.repository.interface.ts`, `build-run-event.repository.interface.ts`, `build-run-chat-message.repository.interface.ts`, `code-quality-finding.repository.interface.ts`, `llm-configuration.repository.interface.ts`), implementados en `infrastructure/database/`. Mismo patrón que el resto del backend: interfaz + `Symbol` de inyección + tipos de entrada/salida propios.

## Los puertos hacia el exterior (`ports/`)

Estos son distintos de los de persistencia: no son "una tabla", son la abstracción de un servicio externo que el Builder necesita pero que vive en `shared/infrastructure/`:

- **`container-runtime.port.ts`**: cubre exactamente los 4 métodos que el Builder usa de `DockerExecutionService`/`DockerImageService` — auditado contra los consumidores reales antes de diseñarlo, no adivinado. El resto de la superficie de esas dos clases (redes, gestión del daemon) no tiene llamadores fuera de la propia infraestructura Docker, así que deliberadamente no forma parte del puerto.
- **`object-storage.port.ts`**: la superficie pública completa de `MinioStorageService` salvo el hook de ciclo de vida `onModuleInit`.
- **`distributed-lock.port.ts`**: cerrojo distribuido (usado, entre otros, para que dos réplicas del Worker no procesen el mismo run).
- **`distributed-cache.port.ts`**: solo `set`/`exists` — el único consumidor real de esta superficie reducida es `BuilderRunCancellationService`, para la señal de cancelación cooperativa.

Estos cuatro puertos son deliberadamente pequeños: cada uno cubre solo los métodos que el Builder realmente usa hoy, no la superficie completa del servicio de `shared/` que implementan — evita que `domain/` (y, por extensión, cualquiera que programe contra el puerto) dependa de más superficie de la que necesita.

## El resto de `domain/`

```text
ai/                          # Subdominio de IA: parsers de contrato, prompts, roles — ver ai/README.md
builder-config.provider.ts   # Proveedor NestJS que resuelve la configuración activa del Builder desde env vars
builder.constants.ts         # Nombre de cola BullMQ, prioridades, umbrales de recuperación de runs colgados
builder.types.ts             # Tipos compartidos por todo el módulo (no específicos de ninguna etapa)
runtime-catalog.ts           # Catálogo de entornos soportados: qué imagen Docker corresponde a cada lenguaje/framework
worker-capacity.util.ts      # Calcula cuántos runs puede procesar en paralelo un Worker según memoria disponible
code-quality-finding.util.ts # Helpers puros sobre CodeQualityFinding (agrupar, puntuar) reutilizados por evaluation/
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/domain
npm run boundaries   # domain/ no puede importar TypeORM/ioredis salvo en las propias entidades
```

Si necesitas que el Builder soporte un lenguaje/framework nuevo, `runtime-catalog.ts` es el punto de partida — es la fuente única de verdad de imágenes/versiones soportadas (antes había duplicados en `builder.constants.ts`, se consolidó a propósito, ver comentario ARQ-010 en ese fichero).

## Ver también

- [`ai/README.md`](ai/README.md) — el subdominio de IA.
- [`../infrastructure/README.md`](../infrastructure/README.md) — las implementaciones concretas de estos puertos.
