/**
 * @fileoverview Tarifas de referencia por modelo y cálculo de coste.
 *
 * Contexto:
 * - La tarifa buena es la que el profesor declara por proveedor en la pestaña
 *   "Modelos de IA". Esta tabla es solo el respaldo para los modelos servidos
 *   desde variables de entorno, sin configuración en base de datos.
 * - Un modelo desconocido devuelve `null`, no una tarifa inventada: es
 *   preferible reportar coste 0 (y avisar) a facturar un modelo local a precio
 *   de Sonnet.
 *
 * @module BuilderPricingUtility
 */

export interface ModelPricing {
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export interface StageTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  // Anthropic Claude (Bedrock y API nativa)
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  'anthropic.claude-3-5-sonnet-20241022-v2:0': {
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  'claude-3-5-sonnet-20241022': {
    inputCostPerMillion: 3.0,
    outputCostPerMillion: 15.0,
  },
  'anthropic.claude-3-5-haiku-20241022-v1:0': {
    inputCostPerMillion: 0.8,
    outputCostPerMillion: 4.0,
  },
  'us.anthropic.claude-3-haiku-20240307-v1:0': {
    inputCostPerMillion: 0.25,
    outputCostPerMillion: 1.25,
  },

  // OpenAI
  'gpt-4o-mini': { inputCostPerMillion: 0.15, outputCostPerMillion: 0.6 },
  'gpt-4o': { inputCostPerMillion: 2.5, outputCostPerMillion: 10.0 },

  // Google Gemini
  'gemini-1.5-flash': { inputCostPerMillion: 0.075, outputCostPerMillion: 0.3 },
  'gemini-1.5-pro': { inputCostPerMillion: 1.25, outputCostPerMillion: 5.0 },

  // Qwen 3 Coder en Bedrock (modelo por defecto del Builder)
  'us.qwen.qwen3-coder-480b-a35b-v1:0': {
    inputCostPerMillion: 1.5,
    outputCostPerMillion: 6.0,
  },
};

/**
 * Claves ordenadas de más larga a más corta: el emparejamiento por subcadena
 * debe preferir `gpt-4o-mini` sobre `gpt-4o` para un id como
 * `gpt-4o-mini-2024-07-18`, que si no se tarifaría 16 veces más caro.
 */
const PRICING_KEYS_BY_SPECIFICITY = Object.keys(PRICING_TABLE).sort(
  (a, b) => b.length - a.length,
);

/** Devuelve la tarifa del modelo, o null si no está en la tabla. */
export function resolveModelPricing(modelId: string): ModelPricing | null {
  const exact = PRICING_TABLE[modelId];
  if (exact) {
    return exact;
  }

  const lowerId = modelId.toLowerCase();
  const matchKey = PRICING_KEYS_BY_SPECIFICITY.find((key) =>
    lowerId.includes(key.toLowerCase()),
  );

  return matchKey ? PRICING_TABLE[matchKey] : null;
}

/** Coste en USD de un consumo concreto. Sin tarifa conocida, el coste es 0. */
export function calculateCost(
  pricing: ModelPricing | null,
  usage: StageTokenUsage,
): number {
  if (!pricing) {
    return 0;
  }

  return (
    (usage.inputTokens / 1_000_000) * pricing.inputCostPerMillion +
    (usage.outputTokens / 1_000_000) * pricing.outputCostPerMillion
  );
}
