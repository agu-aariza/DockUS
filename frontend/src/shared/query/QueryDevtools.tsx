/**
 * @fileoverview Devtools de React Query, cargadas solo en desarrollo (QueryDevtools).
 *
 * @module QueryDevtools
 */

import { lazy, Suspense } from 'react';

// `import.meta.env.DEV` se reemplaza estáticamente por `false` en el build de producción,
// así que Rollup elimina esta rama (y el chunk de devtools) por completo. Un simple
// `{import.meta.env.DEV && <ReactQueryDevtools/>}` con import estático NO bastaría: el
// import ya viajaría en el bundle aunque nunca se renderizara.
const LazyDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : null;

export function QueryDevtools() {
  if (!LazyDevtools) return null;
  return (
    <Suspense fallback={null}>
      <LazyDevtools initialIsOpen={false} />
    </Suspense>
  );
}
