# Streaming del Builder (`src/builder/`)

> **Resumen rápido:** La vista en directo de una evaluación: consola de logs, línea de tiempo de eventos, estado por etapa y el veredicto del LLM, todo actualizándose en vivo mientras el pipeline del backend corre. Es donde `useBuilderRunStream` (el hook de SSE) se consume de verdad.

---

## Cómo llega el progreso en vivo hasta aquí

El backend expone `GET /builder/runs/:id/stream` como Server-Sent Events. `hooks/useBuilderRunStream.ts` abre esa conexión con `fetch` + `ReadableStream` (no la `EventSource` nativa, porque esta necesita adjuntar la cabecera `Authorization` y `EventSource` no lo permite) y expone el estado del run según va llegando, con *fallback* a polling si el stream se cae. `BuilderLiveRunPane.tsx` es el consumidor principal de ese hook: compone la consola, la línea de tiempo y el panel de evaluación en una sola vista.

## Estructura interna

```text
builder/
├── components/
│   ├── BuilderLiveRunPane.tsx        # Vista compuesta de una ejecución activa (usa useBuilderRunStream)
│   ├── BuilderRunsTable.tsx          # Tabla histórica de ejecuciones (no en vivo)
│   ├── QualityInsightsDashboard.tsx  # Agregados de calidad de código a nivel de proyecto/alumno
│   └── live-run/                     # Piezas internas de BuilderLiveRunPane — ver live-run/README.md
├── hooks/useBuilderRunStream.ts        # El cliente SSE con fallback a polling
└── utils.ts                              # Formateo compartido (duraciones, tamaños, estados)
```

## API del dominio

`api/builderApi.ts` es la fachada HTTP de runs, evidencias, cancelación y chat. El streaming SSE sigue encapsulado en `hooks/useBuilderRunStream.ts` y ambos reutilizan el transporte genérico de `shared/api/http.ts`.

## Fronteras

- **No decide cuándo se lanza un run** — eso vive en `student/` (el alumno) y `deliveries/`/`projects/` (el profesor relanzando). Este directorio solo *observa* y *muestra* un run que ya existe.
- **No transforma el veredicto del LLM.** `LlmAssessmentPanel.tsx` (en `live-run/`) muestra el informe consolidado tal como lo sirve el backend — el razonamiento crudo del LLM nunca llega aquí para un `STUDENT` (regla del backend, no de este componente).

## Cómo trabajar aquí

```bash
npm run test -- src/builder
```

## Ver también

- [`components/live-run/README.md`](components/live-run/README.md) — el desglose de `BuilderLiveRunPane`.
- [`../student/README.md`](../student/README.md) — quien reutiliza el mismo mecanismo de streaming desde el lado del alumno (`student/hooks/useBuildRunStream.ts`, un hook paralelo).
