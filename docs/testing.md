# Testing y verificación

## Pirámide de pruebas

| Capa | Herramienta | Qué protege |
| --- | --- | --- |
| Backend unitario | Jest mediante `backend/test/run-jest.cjs` | casos de uso, contratos, parsers, runtime y servicios aislados |
| Backend e2e | Jest + infraestructura real | HTTP, DB, Redis, cola y flujos integrados |
| Frontend unitario | Vitest + Testing Library | componentes, hooks, reducer SSE y experiencia por estado |
| Fronteras | dependency-cruiser + scripts de arquitectura | dirección de dependencias y puertos de repositorio |
| Verificación documental | `scripts/check-doc-links.cjs` | enlaces locales de Markdown |

## Backend

Desde `backend/`:

```bash
npm run typecheck
npm run typecheck:tests
npm run lint
npm run boundaries
npm test
npm run test:cov
npm run test:e2e
```

Los e2e requieren PostgreSQL, Redis y Docker reales. Las pruebas del Builder deben distinguir un fallo del programa del alumno, un timeout controlado, una cancelación y un fallo de infraestructura Docker.

## Frontend

Desde `frontend/`:

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run coverage
```

La suite de streaming debe cubrir backlog, frames malformados, duplicados, reconexión con `afterSequence`, backoff y eventos terminales. Las mutaciones de entrega/run no deben reintentarse automáticamente.

## Cambios que requieren tests

- Nuevo endpoint o DTO: test de autorización, validación y respuesta de error.
- Nuevo evento: persistencia, orden, proyección por audiencia y consumo SSE.
- Nueva etapa LLM: contrato válido, JSON inválido, timeout, throttling y failover permitido.
- Nuevo runtime: catálogo, receta, límites y rechazo de entradas no soportadas.
- Cambio de informe: snapshot/forma para alumno y docente, sin filtrar artefactos internos.
- Cambio de storage: path seguro, límites de extracción, URLs firmadas y retención.

## CI local de documentación

Desde la raíz:

```bash
node scripts/check-doc-links.cjs
```

La comprobación recorre los Markdown del repositorio y detecta enlaces locales inexistentes. Si se añade un fichero con nombre enlazado desde `README.md` o `ARCHITECTURE.md`, actualizarlo en el mismo cambio.

## Antes de abrir un cambio

1. Ejecutar la suite específica durante el desarrollo.
2. Ejecutar typecheck, lint y boundaries del paquete modificado.
3. Ejecutar build del paquete si cambia el contrato o el bundle.
4. Ejecutar tests de integración si cambia cola, DB, Redis, Docker o storage.
5. Ejecutar el verificador de enlaces si cambia `docs/`, README o rutas de archivos.

Consulta [ci.md](ci.md) para el orden aplicado en GitHub Actions.

