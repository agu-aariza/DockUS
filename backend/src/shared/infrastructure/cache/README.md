# Caché y bloqueos distribuidos (`shared/infrastructure/cache/`)

> **Resumen rápido:** Una conexión Redis independiente de la de BullMQ, usada para tres cosas: cachear identidades autenticadas de corta duración, implementar bloqueos distribuidos, y servir de canal de comunicación efímera (p. ej. la señal de cancelación cooperativa del Builder).

---

## Por qué hay dos conexiones Redis distintas en el backend

`RedisClientService` (aquí) es **intencionalmente independiente** de la conexión Redis que gestiona BullMQ (configurada en `shared/config/redis.config.ts`, usada por la cola `builder-runs`). Separarlas permite: (1) ejecutar healthchecks (`modules/health/`) sin depender del estado interno de BullMQ, (2) configurar timeouts agresivos (2s, `enableOfflineQueue: false`) en esta conexión sin afectar a los workers de colas, que necesitan tolerancia distinta, (3) desacoplar el ciclo de vida de "monitorización" del de "procesamiento de jobs". **Nunca reutilices `RedisClientService` para lógica de colas**, ni conectes BullMQ a través de esta clase.

## Los cuatro ficheros

```text
cache/
├── cache.module.ts                  # Registra y exporta los tres servicios de abajo
├── redis-client.service.ts            # La conexión Redis "de propósito general" descrita arriba
├── auth-identity-cache.service.ts       # Caché de corta duración de identidad JWT (usado por JwtStrategy)
└── distributed-lock.service.ts            # Bloqueos distribuidos sobre esta misma conexión Redis
```

## `auth-identity-cache.service.ts`

Cachea `{ userId, email, role }` con TTL corto (`AUTH_IDENTITY_CACHE_TTL_SECONDS`, `0` desactiva la caché) para que `JwtStrategy` no tenga que consultar PostgreSQL en cada petición autenticada. Ver [`../../../modules/auth/README.md`](../../../modules/auth/README.md) para el flujo completo de validación de JWT.

## `distributed-lock.service.ts`

Implementa cerrojos distribuidos sobre Redis (adquirir/liberar con expiración) para coordinar operaciones que no deben ejecutarse en paralelo entre réplicas del proceso Worker — por ejemplo, que dos réplicas no reclamen el mismo `BuildRun` huérfano durante la recuperación de runs colgados (`builder/application/services/orchestration/builder-stale-run-recovery.service.ts`). El Builder no consume esta clase directamente: depende del puerto `IDistributedLock` (`builder/domain/ports/distributed-lock.port.ts`), que esta clase implementa.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/infrastructure/cache
```

Si necesitas Redis para algo nuevo que **no** sea procesamiento de colas BullMQ, esta es la conexión a reutilizar (vía `RedisClientService`) — no crees una tercera conexión Redis sin una razón de aislamiento tan fuerte como la que separa esta de BullMQ.

## Ver también

- [`../../config/README.md`](../../config/README.md) — `buildRedisConnectionOptions`/`buildBullConfig`, la otra conexión Redis (BullMQ).
- [`../../../modules/health/README.md`](../../../modules/health/README.md) — quién usa el `PING` de esta conexión para el readiness check.
