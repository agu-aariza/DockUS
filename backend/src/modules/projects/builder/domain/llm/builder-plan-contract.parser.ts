import { BuilderPlanContractV2 } from '../builder.types';
import {
  alignCapabilitiesWithRecipe,
  assertPlanSemanticConsistency,
  normalizeCapabilities,
  normalizeConfidence,
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

export function parseBuilderPlanContractV2(raw: string): BuilderPlanContractV2 {
  const sourceName = 'planner LLM';
  const object = parseRawContract(raw, sourceName);

  const contract: BuilderPlanContractV2 = {
    schemaVersion: normalizeSchemaVersion(object.schemaVersion, sourceName),
    stage: normalizeStage(object.stage, 'plan', sourceName),
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

  assertPlanSemanticConsistency(contract.capabilities, contract.recipe);
  return contract;
}
