# .github/

Configuración de GitHub para el proyecto DockUS: workflows de CI/CD, plantillas de issues/PRs (si se añaden en el futuro) y otros ajustes de GitHub.

## Estructura

```
.github/
└── workflows/
    └── backend-ci.yml   # Pipeline de integración continua
```

## Workflows

| Archivo | Descripción |
|---------|-------------|
| [`workflows/backend-ci.yml`](./workflows/backend-ci.yml) | Pipeline de CI que se ejecuta en push/PR a `main` y `feature/*`. Valida frontend (`typecheck` + `build`) y backend (`typecheck` + `build` + tests unitarios + tests e2e). |

## CI en detalle

### Triggers

- Push o pull request a `main` o `feature/*`.
- Filtrado por paths: cambios en `backend/**`, `frontend/**`, `README.md`, `.env.example` o el propio workflow.

### Jobs

1. **frontend-verify**
   - Checkout del repositorio.
   - Setup de Node.js 22 con caché de `npm`.
   - `npm ci` en `frontend/`.
   - `npm run typecheck`.
   - `npm run build`.

2. **backend-verify**
   - Servicios de apoyo: PostgreSQL 16 y Redis 7.
   - Variables de entorno de test configuradas.
   - `npm ci` en `backend/`.
   - `npm run typecheck`.
   - `npm run build`.
   - `npm test -- --runInBand`.
   - `npm run test:e2e -- --runInBand`.

## Notas

- El workflow asume que los tests e2e pueden ejecutarse contra PostgreSQL/Redis en `127.0.0.1`.
- Para añadir despliegues automáticos, crear nuevos workflows en `.github/workflows/`.
