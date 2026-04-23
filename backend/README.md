# DockUS Backend

El backend de DockUS es una API en NestJS 11 que concentra autenticación, RBAC, gestión académica, almacenamiento y ejecución del builder. Su objetivo no es sólo exponer CRUDs, sino coordinar un flujo completo de evaluación técnica sobre entregas versionadas.

## Responsabilidad del backend

El backend resuelve cinco áreas principales:

- identidad y acceso (`auth`, `users`);
- salud y observabilidad (`health`, `nestjs-pino`, throttling);
- dominio académico (`projects`, `assignments`, `deliveries`);
- almacenamiento de artefactos (`storage` sobre MinIO);
- builder asíncrono (`builder` sobre BullMQ, Redis, Docker, kubectl y kind).

## Stack técnico

| Área | Tecnología |
| --- | --- |
| Framework HTTP | NestJS 11 |
| Persistencia | PostgreSQL + TypeORM |
| Colas | Redis + BullMQ |
| Storage | MinIO / S3 compatible |
| Observabilidad | `nestjs-pino` |
| Validación | `class-validator`, `Joi` |
| Builder | Docker, `kubectl`, `kind`, Ollama |

## Estructura del código

```text
backend/
├── src/
│   ├── app.module.ts
│   ├── bootstrap.ts
│   ├── main.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── health/
│   │   ├── projects/
│   │   │   ├── assignments/
│   │   │   ├── builder/
│   │   │   ├── deliveries/
│   │   │   ├── dto/
│   │   │   ├── entities/
│   │   │   └── storage/
│   │   └── users/
│   └── shared/
│       ├── config/
│       ├── infrastructure/
│       └── utils/
├── scripts/
└── test/
```

## Módulos principales

### `auth`

- registro, login y perfil autenticado;
- JWT como mecanismo de sesión;
- protección por guards y throttling.

Endpoints de referencia:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`

### `users`

- catálogo de usuarios;
- roles `ADMIN`, `TEACHER`, `STUDENT`;
- soporte operativo para panel de administración.

### `projects`

Incluye el dominio académico completo:

- `Project`: metadatos del proyecto y estado funcional;
- `ProjectAssignment`: relación proyecto-estudiante;
- `Delivery`: entrega versionada;
- `StorageObject`: artefactos asociados a proyecto o entrega.

Submódulos relevantes:

- `projects.controller.ts`
- `project-assignments.controller.ts`
- `deliveries.controller.ts`
- `storage.controller.ts`

### `builder`

Es el subdominio más sofisticado del backend. Gestiona runs asíncronos de evaluación sobre una entrega concreta.

Responsabilidades:

- encolar runs por entrega;
- construir workspace temporal con código del alumno y suite docente;
- clasificar el proyecto y generar receta de ejecución;
- construir imagen Docker;
- desplegar recursos temporales en `kind`;
- validar probes, estabilidad y tests;
- recolectar evidencias, warnings y artefactos;
- producir un reporte final persistido en el propio run.

## Dominio y flujo de datos

### Entidades clave

- `Project`
- `ProjectAssignment`
- `Delivery`
- `StorageObject`
- `BuildRun`
- `BuildRunEventEntity`
- `BuildRunArtifact`

### Flujo funcional real

1. El profesor crea un proyecto.
2. Asigna estudiantes.
3. Sube la suite docente al proyecto.
4. El alumno crea una entrega y sube código fuente.
5. Se lanza un `BuildRun` sobre la entrega.
6. El run pasa por BullMQ y lo procesa el worker del builder.
7. El resultado final queda persistido en `build_runs`, incluyendo reporte, evidencias, warnings y resultados de etapa.

## Builder: arquitectura operativa

### Pipeline estándar

El pipeline principal del builder recorre estas etapas:

1. `ANALYSIS`
2. `BUILD`
3. `DEPLOY`
4. `PROBES`
5. `STABILITY`
6. `TESTS`
7. `CLEANUP`

### Capacidades activas

- soporte Python-first;
- planificación y evaluación con LLM;
- self-healing limitado para errores de build y arranque;
- static review con `ruff` y `bandit`;
- artefactos de evidencia persistidos;
- historial de eventos de run para reconstruir timeline;
- informe final enriquecido con:
  - `overallOutcome`,
  - `llmRecommendations`,
  - `technicalFeedback`,
  - `selfHealing`.

### Modelo de ejecución Kubernetes actual

Hoy el builder:

- utiliza un clúster `kind` compartido configurado por `BUILDER_KIND_CLUSTER_NAME`;
- crea un `namespace` efímero por run;
- despliega un `Job` o un `Deployment` según la receta detectada;
- ejecuta tests y comprobaciones auxiliares dentro de ese contexto;
- limpia `namespace` e imagen temporal al cerrar el run.

No existe todavía un clúster dedicado por proyecto en el estado actual del código.

## Eventos, timeline y reporte

### Eventos de run

El backend persiste eventos incrementales de un run en `build_run_events`.

Se exponen por:

- `GET /api/builder/runs/:buildRunId/events`

La UI los usa para reconstruir un timeline y seguir el run con polling incremental. El frontend ya tiene un cliente preparado para SSE, pero el contrato estable soportado hoy es el endpoint de eventos.

### Reporte final

El reporte forma parte del `BuildRun` y se recupera a través de:

- `GET /api/builder/runs/:buildRunId`

No hay un endpoint separado de informe.

## API y bootstrap HTTP

### Prefijo global

La API aplica:

- prefijo global `/api`

### Swagger

Swagger se publica en:

- `GET /api/docs`

Sólo está habilitado cuando `NODE_ENV !== production`.

### Health checks

- `GET /api/health/live`
- `GET /api/health/readiness`

## Requisitos de ejecución

### Requisitos mínimos

- Node.js 22
- npm 10+
- PostgreSQL
- Redis
- MinIO o servicio S3 compatible

### Requisitos extra para el builder

- Docker daemon accesible
- `kubectl`
- `kind`
- `python3`
- `pip`
- `ruff`
- `bandit`

Si se usa `docker compose` desde la raíz del repositorio, el contenedor backend instala lo necesario para el stack local del builder.

## Configuración

### Fuente canónica

La fuente de verdad para variables de entorno es:

- [`src/shared/config/env.validation.ts`](./src/shared/config/env.validation.ts)

El backend carga `.env` desde la raíz del repositorio mediante `ConfigModule.forRoot({ envFilePath: '../.env' })`.

### Variables más importantes

#### Aplicación

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`

#### Base de datos

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`

#### Seguridad

- `JWT_SECRET`
- `JWT_EXPIRES_IN`

#### Redis / BullMQ

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`

#### Storage / MinIO

- `MINIO_ENDPOINT`
- `MINIO_API_PORT`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_BUCKET_NAME`
- `MINIO_USE_SSL`
- `STORAGE_SIGNED_URL_TTL_SECONDS`
- `STORAGE_BOOTSTRAP_ON_STARTUP`

#### Builder LLM

- `BUILDER_OLLAMA_BASE_URL`
- `BUILDER_OLLAMA_MODEL`
- `BUILDER_OLLAMA_PLAN_MODEL`
- `BUILDER_OLLAMA_EVAL_MODEL`
- `BUILDER_OLLAMA_TIMEOUT_MS`
- `BUILDER_LLM_ASSIST_ENABLED`

#### Builder pipeline

- `BUILDER_SELF_HEAL_MAX_ATTEMPTS`
- `BUILDER_STATIC_REVIEW_ENABLED`
- `BUILDER_RUFF_BIN`
- `BUILDER_BANDIT_BIN`
- `BUILDER_STATIC_REVIEW_TIMEOUT_MS`
- `BUILDER_DOCKER_BUILD_TIMEOUT_MS`
- `BUILDER_KUBECTL_TIMEOUT_MS`
- `BUILDER_CLEANUP_IMAGES`
- `BUILDER_IMAGE_TTL_MS`
- `BUILDER_STALE_RUN_THRESHOLD_MS`
- `BUILDER_DEFAULT_PYTHON_VERSION`
- `BUILDER_BASE_PYTHON_IMAGE`
- `BUILDER_KIND_CLUSTER_NAME`
- `BUILDER_K8S_NAMESPACE_PREFIX`
- `BUILDER_BATCH_TIMEOUT_SECONDS`
- `BUILDER_SERVICE_READY_TIMEOUT_SECONDS`
- `BUILDER_STABILITY_WINDOW_SECONDS`
- `BUILDER_MAX_EXTRACTED_FILES`
- `BUILDER_MAX_EXTRACTED_BYTES`
- `BUILDER_PROMPT_MAX_CHARS`

#### Recursos por workload

- `BUILDER_BATCH_CPU_REQUEST`
- `BUILDER_BATCH_MEMORY_REQUEST`
- `BUILDER_BATCH_CPU_LIMIT`
- `BUILDER_BATCH_MEMORY_LIMIT`
- `BUILDER_SERVICE_CPU_REQUEST`
- `BUILDER_SERVICE_MEMORY_REQUEST`
- `BUILDER_SERVICE_CPU_LIMIT`
- `BUILDER_SERVICE_MEMORY_LIMIT`
- `BUILDER_TEST_CPU_REQUEST`
- `BUILDER_TEST_MEMORY_REQUEST`
- `BUILDER_TEST_CPU_LIMIT`
- `BUILDER_TEST_MEMORY_LIMIT`

## Desarrollo local

### Instalar dependencias

```bash
cd backend
npm install
```

### Arrancar en desarrollo

```bash
npm run start:dev
```

### Arrancar en modo producción local

```bash
npm run build
npm run start:prod
```

El binario compilado arranca desde `build/main`.

## Scripts disponibles

| Script | Propósito |
| --- | --- |
| `npm run build` | Compilar el backend con Nest a `backend/build`. |
| `npm run start` | Arrancar Nest en modo estándar. |
| `npm run start:dev` | Arranque con watch. |
| `npm run start:debug` | Arranque con watch y debug. |
| `npm run start:prod` | Ejecutar la build compilada. |
| `npm run lint` | Ejecutar ESLint. |
| `npm run lint:fix` | Ejecutar ESLint con fix. |
| `npm test -- --runInBand` | Ejecutar tests unitarios/integración ligera. |
| `npm run test:cov` | Ejecutar cobertura. |
| `npm run test:e2e` | Ejecutar pruebas e2e. |

## Tests y build

### Wrapper de Jest

Los tests usan [`scripts/run-jest.cjs`](./scripts/run-jest.cjs), que:

- fija `TMPDIR`, `TMP` y `TEMP`;
- usa caché de Jest bajo `/tmp` en Linux;
- evita problemas por temporales del host.

### Consideraciones de TypeORM

La configuración actual usa:

- `synchronize: true` en `development` y `test`
- `synchronize: false` en `production`

Eso implica que en producción la base de datos debe estar gobernada externamente; el repositorio no está planteado hoy como un despliegue con migraciones maduras.

## Operación con Docker Compose

La forma recomendada de levantar el backend junto con sus dependencias es usar el `docker-compose.yml` de la raíz del repositorio.

Aspectos relevantes del servicio `backend` en compose:

- instala `docker-cli`, `kubectl`, `kind`, `python3`, `pip`, `ruff` y `bandit`;
- monta el socket Docker del host;
- comparte el código fuente de `./backend`;
- apunta a PostgreSQL, Redis, MinIO y Ollama internos del stack.

## Notas de mantenimiento

- El módulo `ProjectsModule` integra también `StorageModule` y `BuilderModule`.
- El estado actual del backend está optimizado para desarrollo local y validación académica, no para multi-tenant productivo.
- Si cambias el contrato de `BuildRun`, revisa a la vez:
  - DTOs de `builder/presentation`,
  - tipos compartidos del frontend,
  - composición del reporte en `builder-report.service.ts`.
- Si cambias variables del builder, documenta y alinea:
  - `env.validation.ts`,
  - `.env.example`,
  - `docker-compose.yml`,
  - README correspondientes.
