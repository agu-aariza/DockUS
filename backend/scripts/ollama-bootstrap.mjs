// Using native fetch from Node 22

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const PLAN_MODEL_NAME = process.env.PLAN_MODEL_NAME || 'dockus-builder-plan';
const EVAL_MODEL_NAME = process.env.EVAL_MODEL_NAME || 'dockus-builder-eval';
const PLAN_BASE_MODEL = process.env.PLAN_BASE_MODEL || 'qwen2.5-coder:7b';
const EVAL_BASE_MODEL = process.env.EVAL_BASE_MODEL || 'deepseek-r1:7b';

async function bootstrap() {
  console.log(`[BOOTSTRAP] Iniciando aprovisionamiento de modelos en ${OLLAMA_HOST}...`);

  try {
    // 1. Pull Base Models
    for (const model of [PLAN_BASE_MODEL, EVAL_BASE_MODEL]) {
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
      { name: PLAN_MODEL_NAME, from: PLAN_BASE_MODEL },
      { name: EVAL_MODEL_NAME, from: EVAL_BASE_MODEL },
    ];

    for (const custom of customModels) {
      console.log(`[BOOTSTRAP] Creando modelo personalizado: ${custom.name} desde ${custom.from}...`);
      
      const modelfile = `FROM ${custom.from}\nPARAMETER num_ctx ${process.env.OLLAMA_NUM_CTX || 16384}`;
      
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
