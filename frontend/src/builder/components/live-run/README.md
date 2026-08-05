# Piezas de la ejecución en vivo (`builder/components/live-run/`)

> **Resumen rápido:** Los ocho componentes que `BuilderLiveRunPane.tsx` compone para mostrar una ejecución: metadatos, estado, consola de logs, línea de tiempo, evidencias y el veredicto del LLM.

---

## Los ocho ficheros

| Fichero | Qué muestra |
| --- | --- |
| `RunMetaBar.tsx` | Cabecera con metadatos del run (ID, tiempos, quién lo lanzó). |
| `RunStatusStrip.tsx` | Franja de estado actual (`QUEUED`/`RUNNING`/`SUCCESS`/`FAILED`/`CANCELLED`), coloreada según el estado del backend (`BuildRunStatus`). |
| `TimelinePanel.tsx` | Línea de tiempo de los eventos del run — mapea los eventos que llegan por SSE a hitos visuales (una entrada por etapa del pipeline). |
| `LiveConsolePanel.tsx` | La consola: streaming de stdout/stderr según llega, con auto-scroll. |
| `EvidenceSection.tsx` | Artefactos/evidencias persistidas del run (logs completos, ficheros de salida) — enlaza a las URLs firmadas que expone el backend. |
| `LlmAssessmentPanel.tsx` | El veredicto del LLM ya consolidado (nunca el razonamiento crudo). |
| `liveRunUtils.ts` | Helpers de formateo compartidos entre los componentes de arriba. |
| `timelineEvent.ts` | Mapeo de tipos de evento del backend (`BuildRunEventType`) a la forma que consume `TimelinePanel`. |

## Cómo fluye un evento SSE hasta la pantalla

```text
useBuilderRunStream (../../hooks/) recibe un evento SSE
        │
        ▼
timelineEvent.ts lo normaliza a la forma de UI
        │
        ├──▶ TimelinePanel.tsx    (añade un hito)
        ├──▶ RunStatusStrip.tsx   (actualiza el estado global)
        └──▶ LiveConsolePanel.tsx (si el evento trae líneas de log, las añade)
```

## Cómo trabajar aquí

```bash
npm run test -- src/builder/components/live-run
```

Si el backend añade un tipo de evento nuevo (`BuildRunEventType`), el punto de entrada para soportarlo en la UI es `timelineEvent.ts` — no repartas el `switch` de tipos de evento por varios componentes.

## Ver también

- [`../../README.md`](../../README.md) — visión general del streaming del Builder.
