// Using native fetch from Node 22
import { readFile } from 'fs/promises';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const PLAN_MODEL_NAME = process.env.PLAN_MODEL_NAME || 'dockus-builder-plan';
const EVAL_MODEL_NAME = process.env.EVAL_MODEL_NAME || 'dockus-builder-eval';
const QUALITY_MODEL_NAME = process.env.QUALITY_MODEL_NAME || 'dockus-builder-quality';
const PLAN_BASE_MODEL = process.env.PLAN_BASE_MODEL || 'qwen2.5-coder:7b';
const EVAL_BASE_MODEL = process.env.EVAL_BASE_MODEL || 'deepseek-r1:8b';
const QUALITY_BASE_MODEL = process.env.QUALITY_BASE_MODEL || EVAL_BASE_MODEL;
const CHAT_MODEL_NAME = process.env.CHAT_MODEL_NAME || 'dockus-builder-chat';
const CHAT_BASE_MODEL = process.env.CHAT_BASE_MODEL || 'qwen2.5-coder:7b';
const OLLAMA_NUM_CTX = process.env.OLLAMA_NUM_CTX || 16384;
const PLAN_MODELFILE_URL = new URL('./ollama-plan.Modelfile', import.meta.url);
const EVAL_MODELFILE_URL = new URL('./ollama-eval.Modelfile', import.meta.url);
const QUALITY_MODELFILE_URL = new URL('./ollama-quality.Modelfile', import.meta.url);
const CHAT_MODELFILE_URL = new URL('./ollama-chat.Modelfile', import.meta.url);

async function loadModelfileTemplate(fileUrl, fromModel) {
  const template = await readFile(fileUrl, 'utf8');

  return template
    .replace(/^FROM\s+.+$/m, `FROM ${fromModel}`)
    .replace(/^PARAMETER num_ctx\s+.+$/m, `PARAMETER num_ctx ${OLLAMA_NUM_CTX}`);
}

async function bootstrap() {
  console.log(`[BOOTSTRAP] Iniciando aprovisionamiento de modelos en ${OLLAMA_HOST}...`);

  try {
    // 1. Pull Base Models
    for (const model of [...new Set([PLAN_BASE_MODEL, EVAL_BASE_MODEL, QUALITY_BASE_MODEL, CHAT_BASE_MODEL])]) {
      console.log(`[BOOTSTRAP] Asegurando modelo base: ${model}...`);
      const pullRes = await fetch(`${OLLAMA_HOST}/api/pull`, {
        method: 'POST',
        body: JSON.stringify({ name: model, stream: false }),
      });
      if (!pullRes.ok) throw new Error(`Falló pull de ${model}`);
      console.log(`[BOOTSTRAP] Modelo base ${model} listo.`);
    }

    // 2. Create Custom Models (Plan & Eval)
    const customModels = [
      {
        name: PLAN_MODEL_NAME,
        from: PLAN_BASE_MODEL,
        modelfileUrl: PLAN_MODELFILE_URL,
      },
      {
        name: EVAL_MODEL_NAME,
        from: EVAL_BASE_MODEL,
        modelfileUrl: EVAL_MODELFILE_URL,
      },
      {
        name: QUALITY_MODEL_NAME,
        from: QUALITY_BASE_MODEL,
        modelfileUrl: QUALITY_MODELFILE_URL,
      },
      {
        name: CHAT_MODEL_NAME,
        from: CHAT_BASE_MODEL,
        modelfileUrl: CHAT_MODELFILE_URL,
      },
    ];

    for (const custom of customModels) {
      console.log(`[BOOTSTRAP] Creando modelo personalizado: ${custom.name} desde ${custom.from}...`);

      const modelfile = await loadModelfileTemplate(
        custom.modelfileUrl,
        custom.from,
      );

      const createRes = await fetch(`${OLLAMA_HOST}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custom.name,
          from: custom.from, // Some versions prefer this
          modelfile: modelfile, // Some versions require this
          stream: false
        }),
      });

      if (!createRes.ok) {
        const error = await createRes.text();
        throw new Error(`Error al crear ${custom.name}: ${error}`);
      }
      console.log(`[BOOTSTRAP] Modelo ${custom.name} creado exitosamente.`);
    }

    console.log('[BOOTSTRAP] Aprovisionamiento completado con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('[BOOTSTRAP] ERROR CRÍTICO:', err.message);
    process.exit(1);
  }
}

bootstrap();
