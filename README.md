# DockUS

[![Backend CI](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-e0234e.svg?logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-316192?logo=postgresql)](https://www.postgresql.org/)

Plataforma para entornos reproducibles y evaluación de proyectos, con backend en NestJS y enfoque en autenticación, RBAC y operaciones administrativas de usuarios.

## Estado actual

- Backend operativo con NestJS 11 + TypeScript.
- Módulos de dominio: `auth`, `users` y `health`.
- Capa de infraestructura separada (`config` + `infrastructure`) para configuración, logging, rate limit, PostgreSQL y Redis/BullMQ.
- Hardening activo: Helmet, Throttler, validación global y logging estructurado con Pino.
- CI en GitHub Actions con lint, auditoría, build, tests unitarios y e2e.

## Estructura del repositorio

```text
.
├── backend/                         # API NestJS
│   ├── src/
│   │   ├── modules/                 # Dominios (auth, users, health)
│   │   ├── shared/                  # Config e infraestructura técnica
│   │   ├── bootstrap.ts             # Config global HTTP compartida
│   │   ├── app.module.ts            # Composición de módulos
│   │   └── main.ts                  # Entry point
│   ├── test/                        # Tests e2e
│   ├── ARCHITECTURE.md              # Convenciones de arquitectura backend
│   └── package.json
├── docker-compose.yml               # PostgreSQL, Redis y MinIO
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

# 2) Levantar infraestructura
docker compose up -d

# 3) Levantar API
npm --prefix backend ci
npm --prefix backend run start:dev
```

Con la API levantada:

- Liveness oficial: `GET http://localhost:3000/api/health/live`
- Readiness oficial: `GET http://localhost:3000/api/health/readiness`
- Swagger: `GET http://localhost:3000/api/docs`

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

Parámetros de listado en `GET /api/users`:

- `page`, `limit`
- `role`, `status`, `search`
- `sortBy`, `sortOrder`

Respuesta típica del listado:

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@dockus.com",
      "firstName": "User",
      "lastName": "Name",
      "role": "STUDENT",
      "status": "ACTIVE"
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
```

## Calidad y flujo

- Convención recomendada de commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`, `refactor`).
- Pipeline CI: [`.github/workflows/backend-ci.yml`](./.github/workflows/backend-ci.yml).
