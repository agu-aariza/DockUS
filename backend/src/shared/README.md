# Infraestructura compartida (`src/shared/`)

> **Resumen rápido:** Todo lo que los módulos de dominio necesitan para hablar con el mundo exterior (base de datos, colas, caché, Docker, LLMs, almacenamiento de ficheros) pero que no es en sí mismo lógica de negocio. Regla de dependencia estricta y unidireccional: `modules/` puede importar de `shared/`, `shared/` **nunca** puede importar de `modules/`.

---

## ¿Por qué existe esta regla de una sola dirección?

Si `shared/` pudiera importar entidades o servicios de `modules/`, dejaría de ser "compartido": cualquier cambio en un módulo de dominio podría romper la infraestructura que usan *todos los demás* módulos, y sería fácil crear dependencias circulares invisibles. Mantener `shared/` ciego a `modules/` obliga a que toda comunicación entre un módulo de dominio y, por ejemplo, Redis o Docker, pase por una interfaz (puerto) que vive en el propio módulo — `shared/` solo provee el adaptador genérico.

**Excepción documentada y permanente** (no ampliar): el subsistema de *seeding* (`infrastructure/seed/{admin,demo}-seed.service.ts` e `infrastructure/infrastructure.module.ts`) importa las entidades `User`/`Project`/`ProjectAssignment`/`Delivery`, porque poblar datos de demostración necesita inherentemente conocerlas. Es la única grieta tolerada en esta regla, y está cubierta por una excepción explícita en `.dependency-cruiser.cjs`.

## Estructura interna

```text
shared/
├── config/                # Validación Joi de variables de entorno (env.validation.ts) — falla rápido al arrancar
│                             si falta una variable requerida. También logger.config.ts y redis.config.ts.
├── application/            # Casos de uso transversales que no pertenecen a un único módulo de dominio.
│                              Ej.: GROUP_ROSTER_READER, el puerto que permite a projects/ preguntar por
│                              matrículas sin importar academic/ directamente.
├── database/                # Helpers TypeORM genéricos (ej. throwIfUniqueViolation) — NO configuración de conexión,
│                               eso vive en infrastructure/database/.
├── dto/                       # DTOs genéricos reutilizables entre módulos (ej. paginación).
├── http/                       # Constantes y utilidades de respuesta HTTP transversales.
├── utils/                       # Funciones puras sin DI de NestJS (hashing, backoff, paginación, parsing).
└── infrastructure/                # Adaptadores concretos a servicios externos — ver infrastructure/*/README.md
    ├── ai/                          # BedrockGenerationService + PromptRegistryService. Prompts en prompts.json, nunca inline.
    ├── cache/                        # RedisClientService — conexión Redis SEPARADA de la de BullMQ, para health checks.
    ├── database/                      # Conexión TypeORM real + migraciones versionadas.
    ├── docker/                         # DockerExecutionService/DockerContainerService/DockerNetworkService — CLI `docker`, no dockerode.
    ├── queue/                           # Abstracciones genéricas de BullMQ (sin lógica de negocio de ningún job concreto).
    ├── security/                         # Throttling (@nestjs/throttler) y cifrado de secretos.
    ├── seed/                              # Seeders idempotentes de datos de desarrollo/demo (nunca en producción).
    └── storage/                            # MinioStorageService — almacenamiento S3-compatible con URLs firmadas.
```

## Cómo encaja en el flujo general

```text
Módulo de dominio (ej. projects/builder)
   │  define un puerto en su propio domain/ (interfaz TypeScript)
   ▼
Implementación del puerto en su propio infrastructure/
   │  esa implementación SÍ puede importar de shared/infrastructure/
   ▼
shared/infrastructure/*  (DockerExecutionService, BedrockGenerationService, MinioStorageService, ...)
   │
   ▼
Servicio externo real (Docker daemon, AWS Bedrock, MinIO, PostgreSQL, Redis)
```

`shared/` nunca decide *cuándo* se llama a Docker o al LLM — eso es responsabilidad de `application/` dentro del módulo de dominio. `shared/` solo sabe *cómo* hablar con esos sistemas de forma segura y reutilizable.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared   # tests unitarios de toda la infraestructura compartida
```

Antes de añadir algo nuevo aquí, pregúntate: ¿esto es un adaptador genérico reutilizable por cualquier módulo, o es lógica específica de un dominio? Si es lo segundo, no pertenece a `shared/` — debería vivir dentro del módulo correspondiente (posiblemente exponiendo un puerto en `shared/application/` si otros módulos necesitan consultarlo sin acoplarse directamente entre sí).

## Ver también

- [`config/README.md`](config/README.md), [`application/README.md`](application/README.md), [`database/README.md`](database/README.md), [`dto/README.md`](dto/README.md), [`http/README.md`](http/README.md), [`utils/README.md`](utils/README.md)
- [`infrastructure/ai/README.md`](infrastructure/ai/README.md), [`infrastructure/docker/README.md`](infrastructure/docker/README.md), [`infrastructure/database/README.md`](infrastructure/database/README.md), [`infrastructure/cache/README.md`](infrastructure/cache/README.md), [`infrastructure/queue/README.md`](infrastructure/queue/README.md), [`infrastructure/security/README.md`](infrastructure/security/README.md), [`infrastructure/seed/README.md`](infrastructure/seed/README.md), [`infrastructure/storage/README.md`](infrastructure/storage/README.md)
- [`../README.md`](../README.md) — el código fuente del backend en conjunto.
