# Setup global de tests (`test/support/`)

> **Resumen rápido:** Lo que Vitest carga antes de cada archivo de test (`setup.ts`) más un helper compartido, `renderWithProviders.tsx`, para montar hooks/componentes envueltos en los providers reales de la app (React Query, router, workspace) en vez de mockearlos uno a uno en cada test. Es el equivalente frontend de `backend/test/` — mismo propósito, mecanismo distinto porque aquí no hay una app NestJS que levantar, hay un DOM que preparar.

---

## `setup.ts`: qué prepara antes de cada test

```typescript
import '@testing-library/jest-dom';        // matchers de DOM (toBeInTheDocument, etc.)
afterEach(() => cleanup());                 // desmonta el árbol de React entre tests
```

Registrado como `setupFiles` en la configuración de Vitest — se ejecuta automáticamente, ningún test lo importa a mano.

## `renderWithProviders.tsx`: por qué no se mockean React Query/router/workspace en cada test

Un hook o componente real de la aplicación normalmente asume que existen un `QueryClientProvider`, un `Router` y un `WorkspaceProvider` por encima — sin ellos, renderizarlo en un test lanza inmediatamente. En vez de mockear esos tres contextos por separado en cada archivo de test, `renderHookWithProviders` los monta todos de una vez con una única llamada:

```typescript
const { result } = renderHookWithProviders(() => useDeliveryManagement(), {
  route: '/deliveries',
  withWorkspace: true,   // por defecto ya es true — 3 de los 4 hooks de dominio lo necesitan
});
```

Un detalle importante y fácil de pasar por alto: `createTestQueryClient()` **parte de los mismos `queryDefaultOptions` reales de la app** (incluido `staleTime`) y solo desactiva reintentos y refetch por foco/reconexión (innecesarios en `jsdom`, que no dispara esos eventos, pero se desactivan explícitamente en vez de confiar en que `jsdom` los ignore por su cuenta). Si el `QueryClient` de test perdiera `staleTime`, cada remount de un componente en un test parecería "stale" y volvería a pedir datos siempre — exactamente el comportamiento que muchas de estas suites existen para comprobar que **no** ocurre. Usar un `QueryClient` de test más "limpio" que el real rompería silenciosamente esa cobertura.

## Estructura interna

```text
test/support/
├── setup.ts                  # Configuración global cargada antes de cada archivo de test
└── renderWithProviders.tsx   # renderHookWithProviders() — ver arriba
```

El smoke test del entorno vive en `../unit/setup.spec.ts`, junto al resto de
tests unitarios.

## Cómo trabajar aquí

```bash
npm test
```

Si un test nuevo necesita renderizar un hook o componente que depende de sesión, tema o toasts además de React Query/router/workspace, añade ese provider como opción de `renderHookWithProviders` en vez de envolver manualmente en cada test — mantiene un único punto de verdad de "cómo se monta algo real de la app en un test".

## Ver también

- [`../../src/shared/query/README.md`](../../src/shared/query/README.md) — `queryDefaultOptions`, la base que reutiliza `createTestQueryClient()`.
- [`../../../backend/test/README.md`](../../../backend/test/README.md) — el equivalente del backend (tests e2e contra una app NestJS real, en vez de un DOM simulado).
