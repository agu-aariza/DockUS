/**
 * @fileoverview Roles de IA configurables y su correspondencia con las etapas.
 *
 * Un rol es lo que el administrador asigna a un proveedor en la pestaña "Modelos de
 * IA"; una etapa es lo que ejecuta el pipeline. `facts`, `evaluation` y
 * `reporting` comparten el rol `eval`, aunque sean llamadas internas distintas.
 *
 * @module BuilderLlmRoles
 */

import type { BuilderLlmPromptStage } from '../../../../../shared/infrastructure/ai/llm.types';

export const BUILDER_LLM_ROLES = [
  'planner',
  'eval',
  'quality',
  'chatbot',
] as const;

export type BuilderLlmRole = (typeof BUILDER_LLM_ROLES)[number];

const STAGE_TO_ROLE: Record<BuilderLlmPromptStage, BuilderLlmRole> = {
  plan: 'planner',
  facts: 'eval',
  evaluation: 'eval',
  quality: 'quality',
  reporting: 'eval',
  chat: 'chatbot',
};

export function roleForStage(stage: BuilderLlmPromptStage): BuilderLlmRole {
  return STAGE_TO_ROLE[stage];
}
