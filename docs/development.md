# Desarrollo local

## Requisitos

- Node.js `>=20.19.0` (CI usa Node 22).
- Docker Engine/Desktop con Compose v2.
- Docker operativo para levantar la infraestructura; el worker necesita además acceso al socket Docker para ejecutar entregas.
- Credenciales de un proveedor LLM solo si se quiere ejecutar una evaluación real.

No hay un `package.json` en la raíz: backend, frontend y contratos se gestionan desde sus propios directorios.

## Opción recomendada: Compose

Desde la raíz:

```bash
docker compose --profile dev up --build
```

El perfil `dev` levanta PostgreSQL, Redis, MinIO, el API, el worker y Vite. El backend de desarrollo aplica las migraciones configuradas para ese perfil; el worker conserva el montaje de workspace necesario para que el path que ve el proceso coincida con el que ve Docker.

Para detener el stack:

```bash
docker compose --profile dev down
```

No añadir el socket Docker al servicio API. Solo el worker debe recibirlo.

## Configuración

1. Copiar [`.env.example`](../.env.example) a `.env` en la raíz.
2. Completar secretos locales, especialmente `JWT_SECRET`, `JWT_REFRESH_SECRET` y `LLM_CREDENTIALS_SECRET`; no reutilizar los valores de ejemplo.
3. Revisar `DB_*`, `REDIS_*`, `MINIO_*`, `BUILDER_*` y `AWS_*` según el entorno.
4. Para ejecutar Vite fuera de Compose, crear `frontend/.env` a partir de [frontend/.env.example](../frontend/.env.example) y apuntar `VITE_API_BASE_URL` al API accesible desde el navegador.

Variables especialmente relevantes:

| Variable | Uso |
| --- | --- |
| `PORT` / `FRONTEND_URL` | puerto HTTP y origen permitido por CORS |
| `DB_*` | conexión y timeouts de PostgreSQL |
| `REDIS_*` | cola, pub/sub, caché y locks |
| `MINIO_*` | endpoint, bucket y URLs firmadas |
| `AWS_*` / `LLM_*` | Bedrock y perfiles LLM por etapa |
| `LLM_CREDENTIALS_SECRET` | cifrado de claves de proveedores guardadas en DB |
| `BUILDER_DOCKER_*` | runtime, recursos, timeout, concurrencia y límites de archivos |
| `STORAGE_EVIDENCE_RETENTION_DAYS` | retención de evidencias en `runs/` |

En producción, `DB_SYNCHRONIZE=false`, `DB_RUN_MIGRATIONS=false` y los secretos deben venir del gestor de secretos del entorno.

## Ejecución manual

Si no se usa el perfil completo, arrancar primero PostgreSQL, Redis y MinIO. Después, en terminales separadas:

```bash
cd backend
npm install
npm run migration:run
npm run start:dev
```

Para que el Builder procese jobs:

```bash
cd backend
npm run start:worker:dev
```

Y para la SPA:

```bash
cd frontend
npm install
npm run dev
```

La API queda en `http://localhost:3000` y Vite en `http://localhost:5173` con los defaults del repositorio. Swagger está en `http://localhost:3000/api/docs` cuando el entorno no es producción.

## Migraciones

Desde `backend/`:

```bash
npm run migration:show
npm run migration:generate
npm run migration:run
npm run migration:revert
```

Revisar siempre la migración generada antes de ejecutarla. Los índices PostgreSQL con operadores específicos pueden no representarse fielmente mediante decoradores TypeORM.

## Flujo de trabajo recomendado

1. Leer [architecture.md](architecture.md) y el documento del área afectada.
2. Cambiar el módulo más cercano a la responsabilidad.
3. Mantener [shared/contracts](../shared/contracts/index.ts) sincronizado si cambia un payload.
4. Ejecutar typecheck, lint, boundaries y tests relevantes.
5. Comprobar enlaces Markdown con `node scripts/check-doc-links.cjs`.

## Referencias

- Backend: [backend.md](backend.md).
- Frontend: [frontend.md](frontend.md).
- Compose y despliegue: [operations.md](operations.md).
- Verificación: [testing.md](testing.md).

