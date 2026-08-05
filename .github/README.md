# GitHub Actions (`.github/`)

> **Resumen rápido:** Un único workflow (`workflows/backend-ci.yml`, con nombre heredado — en realidad cubre **frontend y backend**) que valida lint, tipos, build y tests unitarios en cada push/PR a `main` o `feature/*`. No ejecuta tests e2e (no hay Docker disponible en este pipeline) ni despliega nada.

---

## El nombre del fichero es engañoso

`backend-ci.yml` sugiere que solo valida el backend, pero define **dos jobs independientes**: `frontend-verify` y `backend-verify`, cada uno con su propio checkout, Node.js 22 y caché de `npm`. Si vas a añadir un paso de CI nuevo, decide primero a cuál de los dos jobs pertenece — no los mezcles.

## Cuándo se dispara

```yaml
on: push / pull_request
  branches: [main, "feature/*"]
  paths: ["backend/**", "frontend/**", "README.md", ".env.example", ".github/workflows/backend-ci.yml"]
```

Solo corre si el cambio toca alguna de esas rutas — un commit que solo modifique, por ejemplo, `memoria_tfg/` o `audit/` (ambos gitignored, ni siquiera llegarían a un push real) no dispararía este workflow de todos modos.

## Los dos jobs

| Job | Pasos |
| --- | --- |
| `frontend-verify` | `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` → `npm test` (Vitest). |
| `backend-verify` | Levanta **servicios Postgres 16 y Redis 7** como contenedores del propio runner → `npm ci` → `npm run lint` → `npm run boundaries` (fronteras de arquitectura hexagonal) → `npm run typecheck` → `npm run build` → `npm test -- --runInBand` (Jest, secuencial). |

Las variables de entorno del job de backend (`DB_*`, `JWT_*`, `REDIS_*`) son credenciales de un solo uso, generadas para este pipeline — no reutilices esos valores fuera de CI.

## Qué NO hace este workflow

- **No ejecuta `npm run test:e2e`.** Los tests e2e (`backend/test/`) requieren Docker real además de Postgres/Redis, y este runner no lo levanta — por eso `npm run test:e2e` usa `--passWithNoTests` y no se invoca aquí.
- **No construye ni publica imágenes Docker**, ni despliega a ningún entorno. Es puramente un gate de verificación de calidad sobre el código.

## Estructura interna

```text
.github/
└── workflows/
    └── backend-ci.yml   # Los dos jobs descritos arriba (a pesar del nombre)
```

## Cómo reproducir el CI localmente

```bash
# Frontend
cd frontend && npm ci && npm run lint && npm run typecheck && npm run build && npm test

# Backend (requiere Postgres y Redis accesibles con las mismas env vars que el job)
cd backend && npm ci && npm run lint && npm run boundaries && npm run typecheck && npm run build && npm test -- --runInBand
```

## Ver también

- [`../backend/README.md`](../backend/README.md), [`../frontend/README.md`](../frontend/README.md) — los comandos que este workflow ejecuta, explicados en contexto.
