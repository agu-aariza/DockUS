# El motor Builder (`projects/builder/`)

> **Resumen rápido:** El subsistema que realmente ejecuta el código de un alumno en un contenedor Docker aislado, lo evalúa con un LLM, y produce el informe pedagógico final. Es el módulo más grande y complejo del backend — si solo vas a leer un README de este repositorio para entender "qué hace EduCodeAI de verdad", es este.

---

## Vocabulario imprescindible antes de seguir

Estos cuatro términos aparecen por todo el módulo; sin ellos el resto no tiene sentido:

- **`BuildRun`**: una instancia de evaluación — "esta entrega, evaluada esta vez". Tiene un `status` (`QUEUED → RUNNING → SUCCESS | FAILED | CANCELLED`) y es la entidad central de todo el módulo (`domain/entities/build-run.entity.ts`). Solo puede existir **un `BuildRun` activo por entrega** (índice único parcial `UQ_build_runs_delivery_active`).
- **Trace**: el log cronológico estructurado de lo que pasó durante la ejecución (comandos lanzados, salida, tiempos). Es lo que ve el frontend en tiempo real y lo que el LLM lee para no "alucinar" resultados.
- **Recipe**: la imagen Docker + los comandos + los timeouts que el sistema infiere para poder ejecutar la entrega de un alumno (p. ej. "es un proyecto Python con FastAPI, usa esta imagen, instala así, ejecuta así").
- **Evaluation Contract**: el esquema JSON estandarizado que el LLM está obligado a devolver al evaluar/calificar. Los parsers de `domain/ai/` son defensivos frente a un LLM que no lo respete al pie de la letra.

## ¿Por qué es tan grande este módulo?

Porque hace, en secuencia, seis cosas muy distintas para una sola entrega: entender qué es el código subido, compilarlo/prepararlo, ejecutarlo de forma aislada, extraer hechos verificables de lo que pasó, evaluarlo pedagógicamente con un LLM, analizar su calidad estática, y componer un informe final — todo ello con reintentos, cuotas de gasto, cancelación cooperativa, recuperación ante caídas, y sin jamás dejar que el LLM alucine una nota que los logs no respaldan. Cada una de esas responsabilidades tiene su propio servicio; de ahí el volumen.

## Las dos puertas de entrada

```text
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  presentation/               │        │  presentation/                │
│  builder.controller.ts       │        │  builder.processor.ts          │
│  (proceso API — HTTP)        │        │  (proceso Worker — BullMQ)      │
│                               │        │                                │
│  POST /builder/deliveries/   │──enqueue──▶  @Processor('builder-runs')   │
│    :deliveryId/run           │        │  extends WorkerHost              │
│  GET  /builder/runs/:id      │        │  ejecuta BuilderPipelineOrchestrator│
│  GET  /builder/runs/:id/stream│ (SSE) │  (nunca en el proceso API)         │
│  POST /builder/runs/:id/cancel│       │                                    │
│  GET  /builder/runs/:id/evidence│     │                                    │
│  POST /builder/runs/:id/chat  │       │                                    │
└─────────────────────────────┘        └──────────────────────────────────┘
```

`builder.controller.ts` (14 endpoints bajo `/builder`) solo encola trabajo y consulta estado — nunca ejecuta el pipeline en el proceso API. El pipeline real solo corre dentro de `builder.processor.ts`, en el proceso **Worker** (ver `../../README.md` para la distinción API/Worker). La cola se llama `builder-runs` (BullMQ) y tiene dos prioridades (`BUILDER_JOB_PRIORITY`: `INTERACTIVE=1` para reejecuciones manuales de un profesor, `BATCH=2` para entregas de alumnos) — en BullMQ, menor número es mayor prioridad, así que un profesor revisando una entrega en directo no espera detrás de una avalancha de entregas de última hora. No es un mecanismo de justicia entre alumnos: dentro de cada prioridad se respeta el orden de llegada.

## El pipeline de seis etapas

```text
PlanStage → CompileStage → ExecutionStage → EvaluationStage → QualityStage → ReportStage
  │              │               │                 │               │             │
  │              │               │                 │               │             └─ Compone el informe final consolidado
  │              │               │                 │               └─ Análisis estático de calidad de código
  │              │               │                 └─ Extrae hechos + evalúa pedagógicamente con LLM (con guardia anti-alucinación)
  │              │               └─ Ejecuta en el contenedor Docker aislado (sin red, sin privilegios)
  │              └─ Prepara/compila según la Recipe inferida
  └─ Infiere el entorno de ejecución (Recipe) a partir del código subido
```

`BuilderPipelineOrchestrator` (en `application/services/orchestration/`) compone estas seis etapas y es **la única pieza que puede marcar un run como `FAILED`** — cada `*-stage.handler.ts` debe propagar sus fallos, nunca tragárselos, para que el orquestador decida. Cada etapa mapea a un **rol de IA** configurable por el profesor (`domain/ai/builder-llm-roles.ts`): `plan→planner`, `facts`/`evaluation→eval` (comparten rol porque ambas son la fase de corrección), `quality→quality`, `chat→chatbot`.

## Regla que nunca se rompe: el alumno nunca ve el razonamiento crudo del LLM

Los prompts y las respuestas brutas del modelo (`domain/ai/`, `shared/infrastructure/ai/prompts.json`) **nunca llegan a un usuario con rol `STUDENT`** — solo el informe final consolidado que produce `ReportStage`. Esto es una regla de seguridad/pedagógica explícita del proyecto, no un detalle de implementación.

## Estructura interna

```text
builder/
├── builder.module.ts        # Fachada de composición pública; no registra providers de negocio directamente
├── builder-persistence.module.ts # Entidades/adaptadores TypeORM y tokens de repositorio
├── builder-runtime.module.ts     # Configuración, workspace, Docker, storage y runtime bindings
├── builder-ai.module.ts          # Servicios LLM, evaluación, composición pedagógica y consultas/eventos usados por chat
├── builder-pipeline.module.ts    # Cola, stages, orquestador y recuperación worker-side
├── application/services/       # Toda la lógica — ver application/README.md y application/services/README.md
├── domain/                       # BuildRun y entidades relacionadas, puertos, catálogo de runtimes, IA — ver domain/README.md
├── infrastructure/                  # Adaptadores TypeORM, eventos, evidencias — ver infrastructure/README.md
└── presentation/                       # builder.controller.ts (API) + builder.processor.ts (Worker) + DTOs
```

`BuilderAiModule` expone también las consultas, eventos y evidencias que necesita el chat y que consume la composición del pipeline. `BuilderPipelineModule` importa esa capacidad en una sola dirección; no hay `forwardRef()` entre los módulos de composición y el grafo de módulos permanece acíclico. La cola BullMQ sigue registrada una sola vez en `BuilderPipelineModule` y el processor sigue siendo exclusivo de `WorkerModule`.

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/builder
```

Si añades una etapa nueva o modificas una existente, debe seguir siendo ejecutable de forma aislada del resto (input/output tipados propios) y **propagar** los fallos, no capturarlos silenciosamente — es el orquestador quien decide qué hacer con un fallo, no la etapa.

## Ver también

- [`application/README.md`](application/README.md), [`application/services/README.md`](application/services/README.md)
- [`domain/README.md`](domain/README.md), [`domain/ai/README.md`](domain/ai/README.md)
- [`infrastructure/README.md`](infrastructure/README.md)
- [`presentation/README.md`](presentation/README.md) — los 18 endpoints REST y el consumidor BullMQ.
- [`../../../shared/infrastructure/docker/README.md`](../../../shared/infrastructure/docker/README.md) — el aislamiento real de Docker.
- [`../../../shared/infrastructure/ai/README.md`](../../../shared/infrastructure/ai/README.md) — el cliente LLM (Bedrock/Gemini) que este módulo consume.
