/**
 * @fileoverview Tipos de las secciones de prompt.
 *
 * Contexto:
 * - Estos tipos los definía `builder-prompt-composer.ts`, pero `builder.types.ts`
 *   importaba `PromptSectionTrace` desde él, creando un ciclo de dependencias
 *   (dominio → composer → dominio). Extraerlos a un módulo de tipos propio
 *   rompe el ciclo sin alterar comportamiento.
 *
 * @module prompt-composer.types
 */

export type PromptSectionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PromptSectionBudget {
  preferredChars?: number;
  reserveChars?: number;
}

export interface PromptSectionInput {
  label: string;
  content: string;
  priority: PromptSectionPriority;
  budget?: PromptSectionBudget;
}

export interface PromptSectionTrace {
  label: string;
  priority: PromptSectionPriority;
  originalChars: number;
  renderedChars: number;
  truncated: boolean;
}

export interface ComposedPromptPayload {
  prompt: string;
  sections: PromptSectionTrace[];
}
