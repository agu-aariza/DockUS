/**
 * @fileoverview Infraestructura de clientes y despacho de LLMs (llm-generation.token).
 *
 * @module llm-generation.token
 */

import type { LlmGenerateRequest, LlmGenerateResult } from './llm.types';

export interface ILlmGenerationService {
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
}

/**
 * Plan de arquitectura hexagonal, Fase 1 (P1-3, ver
 * audit/areas/arquitectura/plan_accion.md). Este puerto ya existía como
 * interfaz — las 5 clases de proveedor y `LlmGenerationRouter` ya declaraban
 * `implements ILlmGenerationService` — pero ningún consumidor lo inyectaba a
 * través de un token: `BuilderLlmDispatcherService` y
 * `BuilderLlmProviderTesterService` inyectaban `LlmGenerationRouter` directo.
 * Este símbolo es lo único que faltaba para que el puerto fuera real, no solo
 * de facto (mismo patrón que `IProjectRepository` en la Fase 0 original).
 */
export const LLM_GENERATION_SERVICE = Symbol('ILlmGenerationService');
