# DockUS Backend

API NestJS 11 para autenticación, dominio académico, almacenamiento de artefactos y ejecución del builder de evaluación. El backend coordina el ciclo completo de una entrega: subida de artefactos, generación de `BuildRun`, ejecución aislada en Docker y persistencia de evidencias.

## Arquitectura

- `auth`, `users`: identidad, JWT y RBAC.
- `projects`, `assignments`, `deliveries`, `storage`: dominio académico y artefactos.
- `builder`: pipeline asíncrono sobre BullMQ para análisis, build, despliegue y validación.
- `runtime`: provisión de la red workspace por proyecto y diagnóstico operativo.
- `shared/infrastructure`: configuración, TypeORM, Redis, seeds, logs y scheduling.

## Modelo de ejecución actual

DockUS ya no usa Kubernetes. El aislamiento de entregas se hace con Docker puro:

- una `workspace network` de larga vida por proyecto;
- una `execution network` efímera por run;
- contenedores efímeros para batch, tests y healthchecks;
- contenedores detached para servicios evaluables;
- limpieza inmediata por run y recolección nocturna de recursos etiquetados.

Hardening vigente:

- `--read-only`
- `--security-opt=no-new-privileges`
- `--cap-drop=ALL`
- `--tmpfs /tmp`
- límites `--cpus` y `--memory`
- redes internas Docker para evitar salida a internet cuando no es necesaria

Producción debe ejecutar el backend con `BUILDER_DOCKER_RUNTIME=runsc`. Desarrollo puede seguir con `runc`.

## Flujo del builder

El pipeline estándar recorre:

1. `ANALYSIS`
2. `BUILD`
3. `DEPLOY`
4. `PROBES`
5. `STABILITY`
6. `TESTS`
7. `CLEANUP`

Durante el run se persisten:

- eventos incrementales de timeline;
- artefactos de build, runtime y tests;
- hallazgos de static review;
- traza de self-healing;
- reporte final enriquecido.

## Configuración

La fuente efectiva del backend es el `.env` de la raíz del repositorio:

- [../.env](/home/dit/DockUS/.env)
- [../.env.example](/home/dit/DockUS/.env.example)
- [backend/.env.example](/home/dit/DockUS/backend/.env.example)
- [env.validation.ts](/home/dit/DockUS/backend/src/shared/config/env.validation.ts)

El backend carga ese archivo con `ConfigModule.forRoot({ envFilePath: '../.env' })`, y `docker-compose.yml` también usa ese mismo `.env`.

Variables clave:

- aplicación: `NODE_ENV`, `PORT`, `FRONTEND_URL`
- base de datos: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- colas: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- storage: `MINIO_ENDPOINT`, `MINIO_API_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_BUCKET_NAME`
- runtime Docker: `DOCKER_HOST`, `BUILDER_DOCKER_RUNTIME`, `BUILDER_WORKSPACE_NETWORK_PREFIX`, `BUILDER_EXECUTION_NETWORK_PREFIX`
- límites de ejecución: `BUILDER_BATCH_CPU_LIMIT`, `BUILDER_BATCH_MEMORY_LIMIT`, `BUILDER_SERVICE_CPU_LIMIT`, `BUILDER_SERVICE_MEMORY_LIMIT`, `BUILDER_TEST_CPU_LIMIT`, `BUILDER_TEST_MEMORY_LIMIT`
- timeouts: `BUILDER_DOCKER_BUILD_TIMEOUT_MS`, `BUILDER_BATCH_TIMEOUT_SECONDS`, `BUILDER_SERVICE_READY_TIMEOUT_SECONDS`, `PROJECT_RUNTIME_*`

## Requisitos locales

- Node.js 22
- npm 10+
- PostgreSQL
- Redis
- MinIO o S3 compatible
- Docker daemon accesible
- `python3`, `pip`, `ruff`, `bandit`

Si el backend corre dentro de un contenedor, necesita acceso al socket del host:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

## Desarrollo

Instalar dependencias:

```bash
cd backend
npm install
```

Arranque en desarrollo:

```bash
npm run start:dev
```

Compilar:

```bash
npm run build
```

## Tests

Los tests usan el wrapper [run-jest.cjs](/home/dit/DockUS/backend/test/run-jest.cjs), que fija temporales en `/tmp` y evita fallos por caché del host.

Comandos habituales:

```bash
npm test -- --runInBand
npm run test:cov
npm run test:e2e
npm run typecheck
```

## Operación con Docker Compose

El stack recomendado se levanta desde la raíz del repo con [docker-compose.yml](/home/dit/DockUS/docker-compose.yml). Los perfiles `dev` y `prod` mantienen el backend con acceso a Docker-out-of-Docker, y `backend-prod` fuerza `BUILDER_DOCKER_RUNTIME=runsc` por defecto.
