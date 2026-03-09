# DockUS

[![Backend CI](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/agu-aariza/DockUS/actions/workflows/backend-ci.yml)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-e0234e.svg?logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-316192?logo=postgresql)](https://www.postgresql.org/)

Plataforma para entornos reproducibles y evaluación de proyectos con arquitectura backend en NestJS.

## Estado actual

- Fase 2 completada: autenticación, RBAC, CRUD de usuarios, soft delete, restore y cambio de estado.
- Listado de usuarios: listado completo disponible en `GET /api/users`.
- Fase 3+ planificada: subida de proyectos, pipeline de build, logs en tiempo real y despliegue dinámico.

## Stack

- Backend: NestJS 11, TypeScript
- Base de datos: PostgreSQL 16+
- Cache/colas: Redis 7 + BullMQ
- Documentacion API: Swagger (`/api/docs`)
- CI: GitHub Actions (lint, build, test)

## Requisitos previos

- Node.js >= 20
- npm >= 9
- Docker + Docker Compose v2

## Puesta en marcha local

```bash
# desde la raiz del repo
docker compose up -d

# backend
cd backend
npm install
npm run start:dev
```

## Endpoints base

Con prefijo global `api`:

- Health check: `GET /api`
- Swagger: `GET /api/docs` (Para interactuar visualmente con la API y exportar el OpenAPI).

### IAM

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile` (JWT)

> **Nota sobre Sesiones**: La autenticación emplea JWT *stateless*. No hay endpoint de logout nativo en el backend; el token expira automáticamente tras un tiempo predefinido (configurable vía `JWT_EXPIRES_IN`).

### Usuarios (RBAC)

- `GET /api/users` (ADMIN, TEACHER)
- `GET /api/users/:id` (ADMIN, TEACHER)
- `POST /api/users` (ADMIN)
- `PATCH /api/users/:id` (ADMIN)
- `DELETE /api/users/:id` (ADMIN, soft delete, devuelve `200` con mensaje)
- `PATCH /api/users/:id/restore` (ADMIN)
- `PATCH /api/users/:id/status/:status` (ADMIN)

Ejemplo:

```http
GET /api/users
```

Respuesta:

```json
[
  {
    "id": "uuid",
    "email": "user@dockus.com",
    "firstName": "User",
    "lastName": "Name",
    "role": "STUDENT",
    "status": "ACTIVE"
  }
]
```

## Variables de entorno

El backend consume estas claves:

- `NODE_ENV`
- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `DATABASE_URL`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

Variables adicionales para infraestructura local (Docker/MinIO):

- `POSTGRES_PORT`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `MINIO_API_PORT`
- `MINIO_CONSOLE_PORT`
- `MINIO_ENDPOINT`

## Scripts útiles (backend)

```bash
npm run start:dev
npm run build
npm run lint
npm run test
npm run test:e2e
```

## Calidad y flujo

- Convención de commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `ci`)
- CI activo en `.github/workflows/backend-ci.yml`

## ERS alineada

La versión editable de la ERS con correcciones y mejoras está en:

- `docs/ERS_DockUS_v2.0_ALINEADA.md`

## Roadmap

1. Fase 1-2: base de usuarios, auth, salud del sistema.
2. Fase 3: proyectos/builds/integraciones adicionales.
3. Fase 4-5: frontend y despliegue dinámico en Kubernetes.
4. Fase 6: panel docente/administración ampliada.
