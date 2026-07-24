# Componentes de Ejecución en Vivo (builder/components/live-run)

> **Resumen rápido:** Componentes de la vista de monitorización en tiempo real: consola de streaming, timeline de eventos, barra de metadatos y evidencias de evaluación.

---

## Propósito y Responsabilidades
Renderizar de forma reactiva los eventos y logs emitidos por la ejecución de un contenedor de evaluación en el builder.
- **Consola y Logs:** `LiveConsolePanel.tsx` para streaming de salida estándar.
- **Visualización de Eventos:** `TimelinePanel.tsx`, `EvidenceSection.tsx`, `LlmAssessmentPanel.tsx` y barra de estado `RunStatusStrip.tsx`.

---

## Estructura Interna

```text
.
├── EvidenceSection.tsx       # Sección de inspección de evidencias y artefactos producidos
├── LiveConsolePanel.tsx      # Consola de streaming de logs de stdout/stderr
├── LlmAssessmentPanel.tsx    # Panel de evaluación cualitativa generada por el LLM
├── RunMetaBar.tsx            # Barra superior con metadatos de la ejecución (ID, tiempo, RAM)
├── RunStatusStrip.tsx        # Franja indicadora del estado actual de la run
├── TimelinePanel.tsx         # Panel de línea de tiempo con los eventos del pipeline
├── liveRunUtils.ts           # Utilidades de formateo de estado de ejecución
└── timelineEvent.ts          # Mapeadores de tipos de evento de la línea de tiempo
```

---

## Flujo de Trabajo / Arquitectura

```text
[ SSE Stream Event ] ──> [ liveRunUtils ] ──> [ LiveConsolePanel + TimelinePanel ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de live-run:
```bash
npm run test -- src/builder/components/live-run
```
