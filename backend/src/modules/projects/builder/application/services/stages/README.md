# Etapas del pipeline (`.../services/stages/`)

> **Resumen rápido:** Los seis `handler`, uno por etapa del pipeline de evaluación, más un utilitario de logs. Cada handler recibe una entrada tipada, hace su trabajo y devuelve una salida tipada. Deben ser ejecutables de forma aislada y aplicar una política explícita de error: propagar los fallos no recuperables o devolver una degradación documentada cuando la etapa lo permita.

---

## Las seis etapas, en orden

```text
1. plan-stage.handler.ts        Infiere la Recipe: qué lenguaje/framework es, qué imagen Docker usar,
                                 qué comandos ejecutar. Llama al LLM con rol "planner".

2. compile-stage.handler.ts     Prepara/compila según la Recipe (p. ej. `npm install`, `mvn package`)
                                 dentro del workspace ya montado.

3. execution-stage.handler.ts   Ejecuta de verdad en el contenedor Docker aislado (sin red, sin
                                 privilegios). Produce el Trace: el log cronológico de la ejecución.
                                 Nombra el contenedor `educodeai-run-<runId>-<sufijo>` (ver docker/).

4. evaluation-stage.handler.ts  Dos sub-pasos con el LLM (rol "eval" para ambos): extrae hechos
                                 verificables del Trace, y evalúa pedagógicamente contra la rúbrica.
                                 El resultado pasa por la guardia anti-alucinación de ../evaluation/.

5. quality-stage.handler.ts     Análisis estático de calidad de código (rol "quality"), independiente
                                 de si el programa funcionó o no.

6. report-stage.handler.ts      Consolida todo lo anterior en el informe final y genera la
                                 proyección que ve cada rol (profesor o alumno).
```

`builder-execution-log-batcher.ts` no es una etapa — es un utilitario que usa `execution-stage.handler.ts` para agrupar líneas de log antes de emitirlas (por SSE al frontend, y a persistencia), en vez de emitir/escribir una a una.

## El contrato que todo handler respeta

- Input y output **tipados propios** (no comparten el objeto `BuildRun` completo mutable entre etapas — cada uno declara justo lo que necesita y justo lo que produce).
- **La política depende de la etapa.** Los fallos no recuperables suben al orquestador (`BuilderPipelineOrchestrator`), que decide si el run termina en `FAILED`, `CANCELLED` o se reintenta. `quality-stage.handler.ts` y `report-stage.handler.ts` tienen además degradaciones controladas: persisten advertencias, contratos vacíos o copias fallback cuando todavía pueden producir un resultado honesto.
- Cada etapa que llama al LLM usa el rol correspondiente de `domain/ai/builder-llm-roles.ts` (`plan→planner`, `facts`/`evaluation`/`reporting→eval`, `quality→quality`), nunca hardcodea qué proveedor/modelo usar — eso lo resuelve `ai/builder-llm-dispatcher.service.ts` según la configuración que el administrador eligió para ese rol.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/modules/projects/builder/application/services/stages
```

Si necesitas añadir una etapa nueva al pipeline (poco frecuente): créala aquí siguiendo el mismo patrón (`handle(input): Promise<Output>`), define su política de degradación si procede y regístrala en el orden correcto dentro de `BuilderPipelineOrchestrator`.

## Ver también

- [`../orchestration/README.md`](../orchestration/README.md) — quién las invoca y decide el resultado final.
- [`../../../domain/ai/README.md`](../../../domain/ai/README.md) — los parsers de contrato que interpretan lo que devuelve el LLM en cada etapa.
