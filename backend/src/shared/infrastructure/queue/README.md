# Colas (`shared/infrastructure/queue/`)

> **Resumen rápido:** Este directorio existe en la convención documentada de `shared/` pero **no contiene ningún fichero de código actualmente** — solo este README. La configuración real de BullMQ vive en [`../../config/redis.config.ts`](../../config/README.md) (`buildBullConfig`), y la cola concreta del Builder (`builder-runs`) se registra directamente en `builder.module.ts` con `BullModule.registerQueue(...)`.

---

## Por qué está vacío

El proyecto solo tiene, hasta ahora, una cola BullMQ (`builder-runs`, para las ejecuciones del Builder — ver [`../../../modules/projects/builder/README.md`](../../../modules/projects/builder/README.md)). No ha hecho falta todavía una capa de abstracción genérica de "productor de colas" reutilizable entre distintos dominios: la conexión Redis compartida ya vive en `shared/config/redis.config.ts`, y la única cola real se registra donde se usa. Si en el futuro aparece una segunda cola con necesidades genéricas comunes (reintentos estándar, un productor compartido), esta carpeta es el sitio natural para esa abstracción — hoy no existe porque no habría nada que generalizar todavía con un único caso de uso.

## Si necesitas trabajar con colas hoy

- Configuración de conexión: `shared/config/redis.config.ts` (`buildBullConfig`).
- Registro y consumo de la cola del Builder: `modules/projects/builder/builder.module.ts` (`BullModule.registerQueue`), productor en `application/services/orchestration/builder-run-commands.service.ts`, consumidor en `presentation/builder.processor.ts`.

## Ver también

- [`../../config/README.md`](../../config/README.md) — `buildBullConfig`, la fábrica de configuración real.
- [`../../../modules/projects/builder/README.md`](../../../modules/projects/builder/README.md) — la única cola que existe hoy en el sistema.
