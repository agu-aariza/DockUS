# DockUS

[![Backend CI](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-e0234e.svg?logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-316192?logo=postgresql)](https://www.postgresql.org/)

Plataforma para entornos reproducibles y evaluación de proyectos, con backend en NestJS y enfoque en autenticación, RBAC y operaciones administrativas de usuarios.

## Estado actual

- Backend operativo con NestJS 11 + TypeScript.
- Frontend smoke tester con React + TypeScript + Vite (`frontend/`).
- Módulos de dominio: `auth`, `users`, `projects`, `deliveries`, `storage` y `health`.
- Capa de infraestructura separada (`config` + `infrastructure`) para configuración, logging, rate limit, PostgreSQL y Redis/BullMQ.
- Hardening activo: Helmet, Throttler, validación global y logging estructurado con Pino.
- CI en GitHub Actions con lint, auditoría, build, tests unitarios y e2e.

## Estructura del repositorio

```text
.
├── backend/                         # API NestJS
│   ├── src/
│   │   ├── modules/                 # Dominios (auth, users, projects, health)
│   │   ├── shared/                  # Config e infraestructura técnica
│   │   ├── bootstrap.ts             # Config global HTTP compartida
│   │   ├── app.module.ts            # Composición de módulos
│   │   └── main.ts                  # Entry point
│   ├── test/                        # Tests e2e
│   ├── ARCHITECTURE.md              # Convenciones de arquitectura backend
│   └── package.json
├── frontend/                        # Cliente smoke para probar endpoints
├── docker-compose.yml               # PostgreSQL, Redis, MinIO y frontend dev
├── .env.example
└── .github/workflows/backend-ci.yml
```

Documentación más detallada del backend: [backend/README.md](./backend/README.md)

## Requisitos

- Node.js 22
- npm >= 9
- Docker + Docker Compose v2

## Puesta en marcha local

```bash
# 1) Crear entorno local
cp .env.example .env

# 2) Levantar infraestructura (sin frontend)
docker compose up -d postgres redis minio

# 3) Levantar API
npm --prefix backend ci
npm --prefix backend run start:dev

# 4) Levantar frontend smoke tester
npm --prefix frontend install
npm --prefix frontend run dev
```

Con la API levantada:

- Liveness oficial: `GET http://localhost:3000/api/health/live`
- Readiness oficial: `GET http://localhost:3000/api/health/readiness`
- Swagger: `GET http://localhost:3000/api/docs`
- Frontend smoke tester: `http://localhost:5173`

También puedes levantar el frontend con Docker Compose:

```bash
docker compose up -d frontend
```

## Endpoints principales

### IAM

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile` (JWT)

### Usuarios (RBAC)

- `GET /api/users` (ADMIN, TEACHER)
- `GET /api/users/:id` (ADMIN, TEACHER)
- `POST /api/users` (ADMIN)
- `PATCH /api/users/:id` (ADMIN)
- `DELETE /api/users/:id` (ADMIN, soft delete)
- `PATCH /api/users/:id/restore` (ADMIN)
- `PATCH /api/users/:id/status/:status` (ADMIN)

### Projects

- `POST /api/projects` (ADMIN, TEACHER)
- `GET /api/projects` (ADMIN, TEACHER, STUDENT)
- `GET /api/projects/:id` (ADMIN, TEACHER, STUDENT)
- `PATCH /api/projects/:id` (ADMIN, TEACHER)
- `PATCH /api/projects/:id/status/:status` (ADMIN, TEACHER)
- `DELETE /api/projects/:id` (ADMIN, soft delete)
- `PATCH /api/projects/:id/restore` (ADMIN)

Parámetros de listado en `GET /api/projects`:

- `page`, `limit`
- `status`, `creatorId`, `search`
- `createdFrom`, `createdTo`
- `sortBy`, `sortOrder`

### Deliveries

- `POST /api/deliveries` (ADMIN, TEACHER, STUDENT)
- `GET /api/deliveries` (ADMIN, TEACHER, STUDENT)
- `GET /api/deliveries/:id` (ADMIN, TEACHER, STUDENT)
- `PATCH /api/deliveries/:id` (ADMIN, TEACHER)
- `PATCH /api/deliveries/:id/status/:status` (ADMIN, TEACHER)
- `DELETE /api/deliveries/:id` (ADMIN, TEACHER, soft delete)
- `PATCH /api/deliveries/:id/restore` (ADMIN)

Parámetros de listado en `GET /api/deliveries`:

- `page`, `limit`
- `projectId`, `authorId`, `status`, `search`
- `createdFrom`, `createdTo`
- `sortBy`, `sortOrder`

### Storage

- `POST /api/storage/upload` (ADMIN, TEACHER, STUDENT)
- `GET /api/storage` (ADMIN, TEACHER, STUDENT)
- `GET /api/storage/:id` (ADMIN, TEACHER, STUDENT)
- `POST /api/storage/:id/download-url` (ADMIN, TEACHER, STUDENT)
- `DELETE /api/storage/:id` (ADMIN, TEACHER, soft delete)
- `DELETE /api/storage/:id/purge` (ADMIN, purge física)
- `PATCH /api/storage/:id/restore` (ADMIN)

Parámetros de listado en `GET /api/storage`:

- `page`, `limit`
- `deliveryId`, `uploaderId`
- `createdFrom`, `createdTo`
- `sortBy`, `sortOrder`

Respuesta típica del listado:

```json
{
  "data": [
    {
      "id": "uuid",
      "deliveryId": "uuid",
      "logicalName": "main.py",
      "logicalPath": "src/main.py",
      "contentType": "text/x-python",
      "sizeBytes": 2048,
      "hash": "sha256...",
      "uploaderId": "uuid",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

## Variables de entorno

Variables principales usadas por el backend:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `VITE_API_BASE_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Variables de infraestructura local (`docker-compose.yml`):

- `POSTGRES_PORT`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_API_PORT`
- `MINIO_CONSOLE_PORT`
- `MINIO_ENDPOINT`
- `MINIO_BUCKET_NAME`
- `MINIO_USE_SSL`
- `STORAGE_SIGNED_URL_TTL_SECONDS`
- `STORAGE_BOOTSTRAP_ON_STARTUP`

Nota: `DATABASE_URL` puede existir para tooling externo, pero la configuración activa del backend usa los parámetros `DB_*`.

## Scripts útiles

Desde la raíz del repo:

```bash
npm --prefix backend run start:dev
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend run lint:fix
npm --prefix backend run test
npm --prefix backend run test:e2e
npm --prefix frontend run dev
npm --prefix frontend run build
```

## Calidad y flujo

- Convención recomendada de commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`).
- Pipeline CI: [`.github/workflows/backend-ci.yml`](./.github/workflows/backend-ci.yml).
