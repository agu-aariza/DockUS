# Integración continua

El workflow [`.github/workflows/backend-ci.yml`](../.github/workflows/backend-ci.yml) se llama `EduCodeAI CI`. Se dispara en pushes a `main`/`feature/*` y en pull requests hacia esas ramas cuando cambia backend, frontend, shared, corpus, docs, configuración, Compose, scripts o el propio workflow.

## Job Frontend Verify

Usa Ubuntu y Node 22, instala con `npm ci` desde `frontend/` y ejecuta:

```text
node scripts/check-test-layout.cjs
npm run lint
npm run typecheck
npm run build
npm test
```

## Job Backend Verify

Usa Ubuntu con servicios PostgreSQL y Redis, instala con `npm ci` desde `backend/` y ejecuta:

```text
npm run lint
npm run boundaries
npm run typecheck
npm run build
npm test -- --runInBand
```

El entorno CI usa una base de datos y secretos de prueba efímeros. No confundirlo con la configuración de producción ni usar esos valores fuera de CI.

## Qué no hace este workflow

El workflow valida código, tipos, fronteras, build y tests. No publica automáticamente la aplicación, no sustituye las migraciones operativas y no demuestra por sí mismo que el aislamiento Docker sea adecuado para producción.

## Cambios documentales

Modificar `docs/` activa la verificación porque la documentación contiene instrucciones operativas y enlaces a la estructura del repositorio. Antes de subir cambios, ejecutar [testing.md](testing.md) y el comprobador de enlaces desde la raíz.

