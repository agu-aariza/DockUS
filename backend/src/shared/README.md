# backend/src/shared/

Código transversal compartido por todos los módulos de dominio del backend. Aquí viven la configuración, la infraestructura externa (base de datos, colas, Docker, LLM, storage) y las utilidades comunes.

## Estructura

```
shared/
├── config/              # Validación de variables de entorno, logger, Redis/BullMQ
├── database/            # Utilidades de base de datos
├── http/                # Constantes de respuesta HTTP
├── infrastructure/      # Módulos de infraestructura reutilizables
│   ├── ai/              # Generación LLM (Bedrock) + prompts
│   ├── cache/           # Cliente Redis compartido
│   ├── database/        # Configuración TypeORM
│   ├── docker/          # Abstracción sobre Docker CLI
│   ├── queue/           # Reservado; config de BullMQ en shared/config/redis.config.ts
│   ├── security/        # Rate limiting
│   ├── seed/            # Semillas de admin y demo
│   └── storage/         # Cliente MinIO/S3
├── utils/               # Utilidades generales
└── test-support/        # Helpers para tests
```

## Infraestructura clave

| Carpeta | Responsabilidad | Archivos importantes |
|---------|-----------------|----------------------|
| `config/` | Validar y tipar variables de entorno; configurar logger y Redis/BullMQ. | `env.validation.ts`, `logger.config.ts`, `redis.config.ts` |
| `infrastructure/ai/` | Cliente LLM y registro de prompts. | `bedrock-generation.service.ts`, `prompts.json` |
| `infrastructure/database/` | Configuración de TypeORM y conexión a PostgreSQL. | `typeorm.config.ts` |
| `infrastructure/queue/` | Carpeta reservada; la configuración de BullMQ se importa desde `config/redis.config.ts`. | — |
| `infrastructure/docker/` | Servicios para redes, contenedores y ejecución efímera. | `docker-execution.service.ts`, `docker-container.service.ts`, `docker-network.service.ts`, `docker-host.service.ts` |
| `infrastructure/storage/` | Cliente MinIO/S3 para artefactos. | `minio-storage.service.ts` |
| `infrastructure/cache/` | Cliente Redis independiente para healthchecks y servicios transversales. | `redis-client.service.ts` |
| `infrastructure/security/` | Rate limiting con `@nestjs/throttler`. | `throttler.config.ts` |
| `infrastructure/seed/` | Semillas de admin y datos de demo. | `admin-seed.service.ts`, `demo-seed.service.ts` |

## Archivos más importantes

| Archivo | Función |
|---------|---------|
| [`config/env.validation.ts`](./config/env.validation.ts) | Esquema Joi que valida todas las variables de entorno al arrancar. |
| [`config/logger.config.ts`](./config/logger.config.ts) | Configuración de `pino-http` según entorno. |
| [`config/redis.config.ts`](./config/redis.config.ts) | Opciones de conexión Redis y configuración de BullMQ. |
| [`infrastructure/infrastructure.module.ts`](./infrastructure/infrastructure.module.ts) | Módulo raíz de infraestructura: config, logger, throttler, TypeORM, BullMQ, Docker, AI, storage. |
| [`infrastructure/ai/prompts.json`](./infrastructure/ai/prompts.json) | **Source of truth** de los prompts del pipeline LLM. |
| [`infrastructure/ai/bedrock-generation.service.ts`](./infrastructure/ai/bedrock-generation.service.ts) | Cliente AWS Bedrock para inferencia LLM. |
| [`infrastructure/database/typeorm.config.ts`](./infrastructure/database/typeorm.config.ts) | Configuración de PostgreSQL con TypeORM. |

## Notas

- Ningún módulo de dominio debería depender directamente de librerías externas; deben usar los adaptadores de `shared/infrastructure/`.
- `prompts.json` es la única fuente de verdad de los prompts; no dupliques reglas de negocio en Modelfiles u otras fuentes.
- Los seeds crean un usuario admin por defecto y proyectos de demo al arrancar en desarrollo.
