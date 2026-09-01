# Módulo de salud (`health/`)

> **Resumen rápido:** Dos endpoints, `/health/live` y `/health/readiness`, usados por Docker/orquestadores para saber si el proceso API está vivo y si sus dependencias críticas (Postgres, Redis, Docker, Bedrock) responden. No tiene persistencia propia ni lógica de negocio.

---

## Liveness vs. readiness: por qué son dos endpoints distintos

Son preguntas diferentes y confundirlas rompe despliegues:

- **`GET /health/live`** (`getLiveness()`): "¿el proceso Node sigue vivo y respondiendo?" No comprueba nada externo — si esto responde `200`, el proceso no está colgado ni en deadlock. Un healthcheck de Docker/Kubernetes que falla aquí debería **reiniciar el contenedor**.
- **`GET /health/readiness`** (`getReadiness()`): "¿puede este proceso atender tráfico de verdad ahora mismo?" Comprueba en paralelo (`Promise.all`) cuatro dependencias reales: PostgreSQL (`SELECT 1`), Redis (`PING`), el daemon Docker y AWS Bedrock. Si cualquiera falla, devuelve `status: 'error'` (los detalles por dependencia van en `checks.*`). Un balanceador de carga que falla aquí debería **sacar la instancia del pool sin reiniciarla** — puede que solo esté esperando a que Postgres vuelva.

## Un detalle no obvio: cómo se comprueba Docker

El proceso **API** no habla con el daemon Docker directamente para el healthcheck (`checkDocker()` en `health.service.ts`). En su lugar, lee una clave en Redis (`DOCKER_DAEMON_STATUS_REDIS_KEY`) que el proceso **Worker** publica periódicamente (`shared/infrastructure/docker/docker-daemon-status-publisher.service.ts`). Esto evita que el proceso API necesite acceso al socket de Docker solo para reportar salud, y refleja el estado del daemon tal como lo ve quien realmente lo usa (el Worker). Si esa clave está ausente o expirada en Redis, `readiness` reporta Docker como `down` — incluso si el daemon está perfectamente sano — porque significa que el Worker lleva un rato sin publicar.

## Estructura interna

```text
health/
├── health.module.ts        # Registra HealthController y HealthService
├── health.controller.ts     # GET /health/live, GET /health/readiness
└── health.service.ts         # Las cuatro comprobaciones + agregación del estado global
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/health
```

Si añades una dependencia externa nueva al sistema (otro servicio que el backend necesite para funcionar), considera si `readiness` debería comprobarla también — sigue el patrón de `checkDatabase`/`checkRedis`/`checkDocker`/`checkBedrock`: mide latencia, captura el error sin dejarlo propagar, y añade la entrada a `ReadinessReport.checks`.

## Ver también

- [`../../shared/infrastructure/docker/README.md`](../../shared/infrastructure/docker/README.md) — quién publica el estado del daemon que este módulo lee.
- [`../../shared/infrastructure/cache/README.md`](../../shared/infrastructure/cache/README.md) — el cliente Redis usado para el `PING` y para leer el estado de Docker.
