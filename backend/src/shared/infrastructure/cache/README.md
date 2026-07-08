## Propósito de la carpeta
Implementa el cliente Redis transversal (`RedisClientService`) para operaciones ajenas al ciclo de vida de las colas de trabajo, como healthchecks o Pub/Sub.

## Límites y Reglas Estrictas
- Esta conexión a Redis es independiente de la conexión usada por BullMQ.
- El cliente debe tener configuración de "fail-fast" extrema (e.g. `connectTimeout: 2000`, `maxRetriesPerRequest: 1`) para evitar bloqueos durante los healthchecks de NestJS.
- No debe encolar comandos offline (`enableOfflineQueue: false`).

## Anti-Patrones y Gotchas ⚠️
- Usar este servicio para encolar o procesar trabajos pesados (para eso usar BullMQ).
- Bloquear el event loop principal si Redis cae. El método `withTimeout` envuelve las llamadas para mitigarlo.

## Dependencias de Contexto Asumidas
- Se asume el entorno de configuración `buildRedisConnectionOptions` provisto en `shared/config/redis.config.ts`.

## Inputs / Outputs Esperados
- Provee un cliente inyectable con métodos `ping()`, `publish()`, y `createSubscriber()`.

## Ejemplo de uso
```typescript
constructor(private readonly redisClient: RedisClientService) {}

async check() {
  await this.redisClient.ping();
}
```

## Formato de Archivos
- Exporta un servicio inyectable con ciclo de vida manejado por Nest (`OnApplicationShutdown`).
