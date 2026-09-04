# Configuración (`shared/config/`)

> **Resumen rápido:** Validación de variables de entorno con Joi (falla rápido si algo crítico falta al arrancar), configuración del logger estructurado Pino, y las fábricas de conexión a Redis reutilizadas por BullMQ y por el cliente de caché.

---

## `env.validation.ts` — por qué falla rápido

Este esquema Joi se evalúa al arrancar el proceso (API o Worker), antes de que NestJS termine de construir el grafo de inyección de dependencias. Si falta una variable requerida o tiene un formato inválido, el proceso **no arranca**. El esquema contiene variables generales y seis claves dinámicas de modelo (`BUILDER_BEDROCK_{PLAN,FACTS,EVALUATION,QUALITY,REPORTING,CHAT}_MODEL_ID`); por eso no conviene mantener un número total escrito a mano. Este fichero, junto con `.env.example` y `docker-compose.yml`, es la lista autoritativa de configuración.

## `logger.config.ts` — trazabilidad entre API y Worker

Configura Pino (`nestjs-pino`) para loguear JSON estructurado en producción y un formato legible (`pino-pretty`) en desarrollo. Propaga la cabecera `x-correlation-id` entre peticiones HTTP y las ejecuciones asíncronas que dispara — así se puede seguir el rastro completo de una petición del frontend hasta el job de BullMQ que procesó en el Worker, algo imprescindible al depurar un `BuildRun` que falló.

## `redis.config.ts` — una única fuente de conexión

`buildRedisConnectionOptions` y `buildBullConfig` son las **únicas** fábricas autorizadas para construir opciones de conexión a Redis en todo el backend — nunca crear una conexión ioredis/BullMQ "a mano" en otro sitio. Esto importa porque Redis se usa aquí para dos propósitos con requisitos muy distintos (colas BullMQ vs. caché de vida corta con `enableOfflineQueue: false`, ver `shared/infrastructure/cache/README.md`) y centralizar la construcción evita que un consumidor nuevo copie la configuración equivocada.

## Estructura interna

```text
config/
├── env.validation.ts       # Esquema Joi, evaluado al arrancar (fail-fast)
├── logger.config.ts        # Configuración de nestjs-pino + correlation-id
└── redis.config.ts         # buildRedisConnectionOptions() / buildBullConfig()
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/config
```

Al añadir una variable de entorno nueva: (1) añádela al esquema Joi aquí con su tipo/default, (2) documenta su propósito en `.env.example` (raíz del repo), (3) actualiza `docker-compose.yml` si la inyecta o sobrescribe y (4) añade la explicación operativa en [`docs/development.md`](../../../../docs/development.md) si afecta al arranque o al despliegue.

## Ver también

- [`../README.md`](../README.md) — infraestructura compartida en conjunto.
- [`../infrastructure/cache/README.md`](../infrastructure/cache/README.md) — por qué hay dos conexiones Redis distintas.
