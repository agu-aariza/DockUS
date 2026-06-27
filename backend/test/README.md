# backend/test/

Tests de extremo a extremo (e2e) y configuración adicional de Jest para el backend.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| [`jest-e2e.json`](./jest-e2e.json) | Configuración de Jest para tests e2e: busca archivos `*.e2e-spec.ts`, usa `ts-jest` y apunta al módulo raíz. |
| [`run-jest.cjs`](./run-jest.cjs) | Wrapper para ejecutar Jest gestionando caché y paths; usado por algunos scripts de test. |

## Cómo ejecutar

```bash
# Desde backend/
npm run test:e2e

# Tests unitarios (los *.spec.ts dentro de src/)
npm test -- --runInBand

# Con cobertura
npm run test:cov
```

## Notas

- Los tests unitarios viven junto al código fuente (`src/**/*.spec.ts`).
- Los tests e2e deberían ubicarse en esta carpeta con extensión `.e2e-spec.ts`.
- El runner `run-jest.cjs` ajusta la configuración para evitar problemas de caché y paths en entornos híbridos (Docker/host).
