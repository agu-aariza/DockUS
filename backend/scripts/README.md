# Scripts del Builder DockUS

Scripts de soporte para el pipeline Builder: modelos LLM, analisis estatico y benchmark offline.

## Prompts LLM

La **source of truth** del comportamiento del stack LLM vive en:

- `backend/src/shared/infrastructure/ai/prompts.json`

Cada prompt se define como un bundle estructurado con:

- `role`
- `task`
- `hard_rules`
- `schema_contract`
- `decision_policy`
- `examples`

Los servicios de `plan`, `eval` y `quality` renderizan esos bundles en runtime. Los prompts ya no deben duplicarse dentro de los Modelfiles.

## Modelfiles

| Archivo | Modelo resultante | Rol |
|---------|-------------------|-----|
| `ollama-plan.Modelfile` | `dockus-builder-plan` | Runtime profile para planning |
| `ollama-eval.Modelfile` | `dockus-builder-eval` | Runtime profile para adjudicacion |
| `ollama-quality.Modelfile` | `dockus-builder-quality` | Runtime profile para review pedagogica |

Los Modelfiles son **runtime profiles**: definen `FROM`, `num_ctx`, `temperature`, `top_p`, `repeat_penalty`, `stop` y una identidad corta. La politica de negocio y las reglas de juicio pertenecen a `prompts.json`.

## Bootstrap

```bash
# Arranca Ollama y crea los modelos derivados
node scripts/ollama-bootstrap.mjs
```

Variables de entorno:

- `OLLAMA_HOST` - URL interna canonica del servidor Ollama (default: `http://ollama:11434`)
- `PLAN_MODEL_NAME` - nombre del modelo plan (default: `dockus-builder-plan`)
- `EVAL_MODEL_NAME` - nombre del modelo eval (default: `dockus-builder-eval`)
- `QUALITY_MODEL_NAME` - nombre del modelo quality (default: `dockus-builder-quality`)
- `PLAN_BASE_MODEL` - modelo base del planner (default: `qwen2.5-coder:7b`)
- `EVAL_BASE_MODEL` - modelo base del evaluator (default: `qwen3:8b`)
- `QUALITY_BASE_MODEL` - modelo base del analisis de calidad (default: `qwen3:8b`)
- `OLLAMA_NUM_CTX` - ventana de contexto compartida por defecto (default: `16384`)

## Benchmark offline LLM

El benchmark reutiliza `fixtures`, `fixtures-error` y `academic-project-bank`.

Archivos:

- `scripts/llm-benchmark/benchmark-manifest.json`
- `scripts/llm-benchmark/benchmark-golden-results.json`
- `scripts/run-llm-benchmark.mjs`

Uso:

```bash
# Genera escenarios listos para alimentar a prompts/modelos
node scripts/run-llm-benchmark.mjs prepare > /tmp/llm-benchmark-inputs.json

# Puntua resultados ya obtenidos frente a los golden cases
node scripts/run-llm-benchmark.mjs score /tmp/llm-benchmark-results.json
```

Formato esperado para `score`:

```json
[
  {
    "caseId": "python-cli-calculator",
    "stage": "plan",
    "latencyMs": 2310,
    "parsedContract": {}
  }
]
```

## Analisis estatico

| Archivo | Lenguaje | Dependencias | Uso |
|---------|----------|--------------|-----|
| `ast_analyzer.py` | Python 3 | stdlib (`ast`, `json`, `sys`) | Extrae estructura AST de archivos Python del alumno |

## Testing

| Archivo | Uso |
|---------|-----|
| `run-jest.cjs` | Wrapper para ejecutar Jest con la configuracion correcta de paths |
