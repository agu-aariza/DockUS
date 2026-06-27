# frontend/scripts/

Scripts de soporte para desarrollo, testing y automatización del frontend.

## Archivos

| Archivo | Función |
|---------|---------|
| [`run-node-tests.mjs`](./run-node-tests.mjs) | Busca archivos `.test.js` compilados en `.tmp-test-dist/tests/` y los ejecuta con el runner nativo de Node (`node --test`). |

## Tests

- No existe una carpeta `frontend/tests/` en la configuración actual.
- El script `test:compile` (`npm run test:compile`) compila `src` + `tests` a `.tmp-test-dist/` usando `tsconfig.tests.json`.
- `run-node-tests.mjs` ejecuta los tests compilados con el runner nativo de Node.

## Cómo ejecutar

```bash
# Compilar tests
npm run test:compile

# Ejecutar tests
npm test
```

## Notas

- La suite de tests de componentes aún no está implementada.
- La validación principal del frontend es `npm run typecheck` y `npm run build`.
