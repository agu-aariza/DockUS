import type { BuilderCapabilityMap, BuilderRecipeV2 } from '../../builder.types';

export function normalizeGrade(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;

  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (Number.isNaN(parsed)) {
    throw new Error('recommendedGrade debe ser numérico.');
  }

  const clamped = Math.max(0, Math.min(10, parsed));
  return Math.round(clamped * 100) / 100;
}

export function assertEvaluationSemanticConsistency(
  capabilities: BuilderCapabilityMap,
  recipe: BuilderRecipeV2,
  observedEvidence: string[],
): void {
  if (observedEvidence.length < 1) {
    throw new Error(
      'observedEvidence debe incluir al menos 1 evidencia concreta.',
    );
  }

  if (capabilities.C3.status === 'yes' && recipe.service === null) {
    throw new Error('C3=yes requiere recipe.service.');
  }

  if (capabilities.C5.status === 'yes' && recipe.service?.healthcheck === null) {
    throw new Error('C5=yes requiere recipe.service.healthcheck.');
  }
}

