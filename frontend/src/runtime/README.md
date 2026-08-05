# Runtime — inspección y salud (`src/runtime/`)

> **Resumen rápido:** Dos cosas distintas en un mismo panel: (1) una herramienta de navegación en cascada proyecto → asignación → entrega → ejecución, para que un profesor/admin inspeccione cualquier `BuildRun` sin pasar por el flujo normal de calificación, y (2) una franja de salud del backend (`RuntimeStatusBar.tsx`) que sondea `GET /health/readiness`.

---

## `TeacherRuntimePanel.tsx`: la cascada de selección

```text
Selector de Proyecto ──▶ Selector de Asignación ──▶ Selector de Entrega ──▶ Lista de Runs ──▶ BuilderLiveRunPane
```

Cada nivel es su propia query de React Query, habilitada solo cuando el nivel anterior tiene un valor seleccionado (`enabled: !!selectedProjectId`, etc.) — si cambias de proyecto a mitad de selección, React Query aborta por su cuenta la petición obsoleta del nivel siguiente en vez de necesitar un `AbortController` manual. Las claves de caché (`queryKeys.projects.*`, `queryKeys.assignments.*`, `queryKeys.deliveries.*`) son las mismas que usan `deliveries/` y `projects/` — al navegar entre paneles, la caché se comparte, no se vuelve a pedir lo mismo dos veces.

Una vez seleccionado un run, este panel reutiliza `useBuilderRunStream` (de `../builder/hooks/`) — es el mismo mecanismo de streaming en vivo que usa el resto de la app, no una implementación paralela.

## `RuntimeStatusBar.tsx`: salud de infraestructura, no de una ejecución

Sondea `healthApi` (que llama a `GET /health/readiness`) cada 30 segundos y muestra el estado de las cuatro dependencias del backend: `database`, `redis`, `docker`, `bedrock`. Es información operativa sobre el propio sistema, no sobre el run que se está inspeccionando en ese momento — no la confundas con `RunStatusStrip.tsx` (`builder/components/live-run/`), que muestra el estado de un `BuildRun` concreto.

## Estructura interna

```text
runtime/
├── TeacherRuntimePanel.tsx        # La cascada de selección + panel de ejecución
├── components/RuntimeStatusBar.tsx  # Salud del backend, sondeo cada 30s
└── hooks/useRuntimeManagement.ts      # Las cuatro queries en cascada + integración con useBuilderRunStream
```

## Cómo trabajar aquí

```bash
npm run test -- src/runtime
```

## Ver también

- [`../builder/README.md`](../builder/README.md) — `useBuilderRunStream`, reutilizado aquí.
- [`../../../backend/src/modules/health/README.md`](../../../backend/src/modules/health/README.md) — el endpoint que consume `RuntimeStatusBar.tsx`.
