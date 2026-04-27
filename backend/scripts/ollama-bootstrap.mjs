/**
 * @fileoverview Bootstrap de modelos Ollama para DockUS Builder.
 *
 * Crea modelos derivados con system prompts especializados:
 * - dockus-builder-plan  → planificación de ejecución
 * - dockus-builder-eval  → evaluación final
 *
 * Los prompts de repair y technical-feedback se inyectan en runtime
 * directamente por sus servicios, no necesitan modelo derivado.
 *
 * Uso:
 *   node scripts/ollama-bootstrap.mjs
 *
 * Variables de entorno:
 *   OLLAMA_HOST         (default: http://ollama:11434)
 *   MODEL_NAME          (default: qwen2.5-coder:7b)
 *   PLAN_MODEL_NAME     (default: dockus-builder-plan)
 *   EVAL_MODEL_NAME     (default: dockus-builder-eval)
 *   OLLAMA_NUM_CTX      (default: 16384)
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const BASE_MODEL = process.env.MODEL_NAME || 'qwen2.5-coder:7b';
const PLAN_MODEL = process.env.PLAN_MODEL_NAME || 'dockus-builder-plan';
const EVAL_MODEL = process.env.EVAL_MODEL_NAME || 'dockus-builder-eval';
const NUM_CTX = Number.parseInt(process.env.OLLAMA_NUM_CTX || '16384', 10);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(endpoint, payload) {
  const url = `${OLLAMA_HOST}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed = null;

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(
      `Ollama ${endpoint} returned ${response.status}: ${raw.slice(0, 500)}`,
    );
  }

  if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
    throw new Error(`Ollama ${endpoint} error: ${String(parsed.error)}`);
  }

  return parsed;
}

async function withRetry(label, fn) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[${label}] Attempt ${attempt}/${MAX_RETRIES} failed: ${msg}. Retrying in ${RETRY_DELAY_MS / 1000}s...`,
        );
        await sleep(RETRY_DELAY_MS);
      } else {
        throw error;
      }
    }
  }
}

async function ensureBaseModel() {
  await withRetry('pull', async () => {
    console.log(`Pulling base model ${BASE_MODEL}...`);
    await postJson('/api/pull', { model: BASE_MODEL, stream: false });
    console.log(`✓ Base model ${BASE_MODEL} ready.`);
  });
}

async function createDerivedModel(modelName, systemPromptPath) {
  const systemPrompt = await readFile(systemPromptPath, 'utf8');
  await withRetry(modelName, async () => {
    console.log(`Creating derived model ${modelName} from ${BASE_MODEL}...`);
    await postJson('/api/create', {
      model: modelName,
      from: BASE_MODEL,
      system: systemPrompt.trim(),
      parameters: {
        num_ctx: NUM_CTX,
        temperature: 0.1,
        repeat_penalty: 1.1,
      },
      stream: false,
    });
    console.log(`✓ Derived model ${modelName} ready.`);
  });
}

async function main() {
  console.log(`DockUS Ollama Bootstrap`);
  console.log(`  Host:       ${OLLAMA_HOST}`);
  console.log(`  Base model: ${BASE_MODEL}`);
  console.log(`  Context:    ${NUM_CTX} tokens`);
  console.log();

  const planPromptPath = path.resolve(__dirname, 'plan-system-prompt.txt');
  const evalPromptPath = path.resolve(__dirname, 'eval-system-prompt.txt');

  await ensureBaseModel();
  await createDerivedModel(PLAN_MODEL, planPromptPath);
  await createDerivedModel(EVAL_MODEL, evalPromptPath);

  console.log();
  console.log('✓ Ollama bootstrap complete. Models ready:');
  console.log(`  - ${PLAN_MODEL} (planning)`);
  console.log(`  - ${EVAL_MODEL} (evaluation)`);
  console.log();
  console.log('Note: repair and technical-feedback prompts are injected at');
  console.log('runtime by their respective services, no derived model needed.');
}

main().catch((error) => {
  console.error(
    `\n✗ Ollama bootstrap failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
