# backend/src/modules/health/

Módulo de health checks para liveness y readiness del backend.

## Endpoints

| Endpoint | Tipo | Descripción |
|----------|------|-------------|
| `GET /health/live` | Liveness | Confirma que el proceso HTTP está vivo. |
| `GET /health/ready` | Readiness | Verifica que PostgreSQL, Redis, Docker daemon y AWS Bedrock están accesibles. |

## Archivos principales

| Archivo | Función |
|---------|---------|
| `health.controller.ts` | Expone los endpoints `/health/live` y `/health/ready`. |
| `health.service.ts` | Ejecuta los chequeos reales sobre cada dependencia y reporta latencia y estado. |
| `health.module.ts` | Módulo NestJS que registra controlador y servicio. |

## Dependencias verificadas

- **PostgreSQL**: ejecuta `SELECT 1` a través del `DataSource` de TypeORM.
- **Redis**: envía `PING` mediante `RedisClientService`.
- **Docker daemon**: ejecuta `docker info` mediante `DockerHostService`.
- **AWS Bedrock**: lista modelos foundation disponibles en la región configurada.

## Notas

- Útil para balanceadores de carga, monitoreo y Docker health checks.
- Cada chequeo incluye `latencyMs` y, en caso de fallo, un mensaje descriptivo.
- El endpoint de readiness requiere credenciales AWS válidas; en entornos sin Bedrock accesible reportará `down`.
