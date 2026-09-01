# Tests del frontend (`frontend/test/`)

Todo el código de tests del frontend vive fuera de `src/` y se organiza por
responsabilidad:

```text
test/
├── unit/                 # Tests Vitest por dominio, reflejando el árbol de src/
└── support/              # Setup global y helpers de Testing Library
```

Los tests unitarios conservan la extensión `*.spec.ts` o `*.spec.tsx` y usan
`@/*` para importar código de producción y `@test/*` para utilidades de test.

```bash
npm test
npm run test:compile
```

La configuración de Vitest permanece en `../vitest.config.ts` y la de
TypeScript para tests en `../tsconfig.tests.json`.
