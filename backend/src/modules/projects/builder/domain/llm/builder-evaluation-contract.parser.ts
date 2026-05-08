import { BuilderEvaluationContractV2 } from '../builder.types';
import {
  alignCapabilitiesWithRecipe,
  assertEvaluationSemanticConsistency,
  normalizeCapabilities,
  normalizeConfidence,
  normalizeGrade,
  normalizeObservedEvidence,
  normalizeOptionalString,
  normalizeRecipe,
  normalizeRuntimeDescriptor,
  normalizeSchemaVersion,
  normalizeStage,
  normalizeString,
  normalizeStringArray,
  parseRawContract,
  normalizeEvaluativeState,
} from './builder-llm-contract.parser.shared';

export function parseBuilderEvaluationContractV2(
  raw: string,
): BuilderEvaluationContractV2 {
  const sourceName = 'evaluador LLM';
  const object = parseRawContract(raw, sourceName);

  const contract: BuilderEvaluationContractV2 = {
    schemaVersion: normalizeSchemaVersion(object.schemaVersion, sourceName),
    stage: normalizeStage(object.stage, 'evaluation', sourceName),
    thought: normalizeOptionalString(
      object.thought,
      'thought',
      'Sin razonamiento previo documentado.',
    ),
    structuralType: normalizeString(object.structuralType, 'structuralType'),
    capabilities: normalizeCapabilities(object.capabilities),
    evaluativeState: normalizeEvaluativeState(object.evaluativeState, sourceName),
    confidence: normalizeConfidence(object.confidence, sourceName),
    rationale: normalizeOptionalString(
      object.rationale,
      'rationale',
      'Sin justificación detallada.',
    ),
    recommendedGrade: normalizeGrade(object.recommendedGrade),
    externalRequirements: normalizeStringArray(
      object.externalRequirements,
      'externalRequirements',
    ),
    runtime: normalizeRuntimeDescriptor(object.runtime, sourceName),
    recipe: normalizeRecipe(object.recipe, sourceName),
    evidenceSummary: normalizeOptionalString(
      object.evidenceSummary,
      'evidenceSummary',
      '',
    ),
    observedEvidence: normalizeObservedEvidence(object.observedEvidence),
    evaluationLimits: normalizeStringArray(
      object.evaluationLimits,
      'evaluationLimits',
    ),
  };

  contract.capabilities = alignCapabilitiesWithRecipe(
    contract.capabilities,
    contract.recipe,
  );

  assertEvaluationSemanticConsistency(
    contract.capabilities,
    contract.recipe,
    contract.observedEvidence,
  );
  return contract;
}
