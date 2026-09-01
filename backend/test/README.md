# Tests del backend (`backend/test/`)

El backend mantiene todo el código de tests fuera de `src/`, separado por
responsabilidad:

```text
test/
├── unit/                 # Tests Jest unitarios, reflejando el árbol de src/
├── support/              # Builders, mocks y fixtures compartidos
├── e2e/                  # Suites end-to-end contra infraestructura real
└── run-jest.cjs          # Runner común para Jest
```

## Tests unitarios

Los tests unitarios (`*.spec.ts`) mockean sus dependencias y viven en
`test/unit/`. Los imports de producción usan `@app/*` y las utilidades de test
usan `@test/*`, evitando que el movimiento de una suite cambie su resolución.

```bash
npm test
npm run test:compile
```

Para ejecutar un subconjunto, pasa la ruta dentro de `test/unit/`, por ejemplo:

```bash
npm run test -- test/unit/modules/projects
npm run test -- test/unit/shared
```

## Soporte compartido

`test/support/` contiene builders y mocks reutilizables. No debe importarse
desde el código de producción; solo desde tests.

## Tests end-to-end

Los tests e2e (`*.e2e-spec.ts`) viven en `test/e2e/`, arrancan la aplicación
NestJS completa y hacen peticiones HTTP reales con Supertest. Requieren
PostgreSQL, Redis y Docker accesibles:

```bash
npm run test:e2e
```

La suite e2e está preparada pero actualmente vacía; el comando usa
`--passWithNoTests` hasta que se añada el primer caso.

## Configuración

- `../jest.config.json`: suites unitarias y cobertura de `src/`.
- `../jest.e2e.config.json`: suites e2e.
- `../tsconfig.spec.json`: compilación de tipos para `src/` y `test/`.
