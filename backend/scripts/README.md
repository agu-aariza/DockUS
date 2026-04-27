# Scripts del Builder DockUS

Scripts de soporte para el pipeline Builder: modelos LLM, análisis estático y testing.

## Prompts LLM

El Builder usa 4 prompts especializados, cada uno inyectado en un punto distinto del pipeline:

| Prompt | Archivo | Modelo Derivado | Uso |
|--------|---------|-----------------|-----|
| **Planner** | `plan-system-prompt.txt` | `dockus-builder-plan` | Clasifica el proyecto y genera la receta de ejecución |
| **Evaluator** | `eval-system-prompt.txt` | `dockus-builder-eval` | Emite el veredicto final comparando hipótesis vs evidencia |
| **Repair** | `repair-system-prompt.txt` | — (runtime) | Corrige la receta cuando falla un intento de ejecución |
| **Technical Feedback** | `technical-feedback-system-prompt.txt` | — (runtime) | Genera feedback pedagógico estructurado para el alumno |

Los prompts de **Plan** y **Eval** se compilan en modelos derivados de Ollama (via `ollama-bootstrap.mjs`). Los de **Repair** y **Technical Feedback** se inyectan en runtime directamente por sus servicios NestJS.

## Modelfiles

| Archivo | Modelo resultante | Descripción |
|---------|-------------------|-------------|
| `ollama-plan.Modelfile` | `dockus-builder-plan` | Modelfile para `ollama create` manual |
| `ollama-eval.Modelfile` | `dockus-builder-eval` | Modelfile para `ollama create` manual |

Los Modelfiles sirven para creación manual (`ollama create -f ollama-plan.Modelfile dockus-builder-plan`). En producción, usa `ollama-bootstrap.mjs`.

## Bootstrap

```bash
# Arranca Ollama y crea los modelos derivados
node scripts/ollama-bootstrap.mjs
```

Variables de entorno:
- `OLLAMA_HOST` — URL del servidor Ollama (default: `http://ollama:11434`)
- `MODEL_NAME` — modelo base (default: `qwen2.5-coder:7b`)
- `PLAN_MODEL_NAME` — nombre del modelo plan (default: `dockus-builder-plan`)
- `EVAL_MODEL_NAME` — nombre del modelo eval (default: `dockus-builder-eval`)
- `OLLAMA_NUM_CTX` — ventana de contexto (default: `16384`)

## Análisis Estático

| Archivo | Lenguaje | Dependencias | Uso |
|---------|----------|--------------|-----|
| `ast_analyzer.py` | Python 3 | stdlib (`ast`, `json`, `sys`) | Extrae estructura AST de archivos Python del alumno |

No requiere dependencias externas — usa solo la biblioteca estándar de Python.

## Testing

| Archivo | Uso |
|---------|-----|
| `run-jest.cjs` | Wrapper para ejecutar Jest con la configuración correcta de paths |
