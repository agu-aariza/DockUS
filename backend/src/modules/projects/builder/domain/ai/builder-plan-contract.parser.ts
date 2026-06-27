import { BuilderPlanContractV2 } from '../builder.types';
import {
  normalizeConfidence,
  normalizeObservedEvidence,
  normalizeOptionalString,
  normalizeSchemaVersion,
  normalizeStage,
  normalizeString,
  normalizeStringArray,
  parseRawContract,
  normalizeEvaluativeState,
} from './parsers/contract-parser.utils';
import {
  alignCapabilitiesWithRecipe,
  assertPlanSemanticConsistency,
  detectBuildSystemInRun,
  normalizeCapabilities,
  normalizeRecipe,
  normalizeRuntimeDescriptor,
} from './parsers/plan-contract.parser';

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

  // Auto-correct: if recipe.run starts with a build-system executable
  // (make, gcc, etc.), replace it with ./main since the actual binary
  // is what should be executed, not the build system.
  const buildSystemWarning = detectBuildSystemInRun(contract.recipe);
  if (buildSystemWarning && contract.recipe.run) {
    const installHasBuildSystem = contract.recipe.install.some(
      (cmd) =>
        cmd[0] === 'make' ||
        cmd[0] === 'cmake' ||
        cmd[0] === 'gcc' ||
        cmd[0] === 'g++',
    );
    if (installHasBuildSystem) {
      const originalRun = [...contract.recipe.run];
      contract.recipe.run = ['./main'];
      contract.evaluationLimits = [
        ...contract.evaluationLimits,
        `AUTO-CORRECTED: recipe.run era [${originalRun.map((t) => `'${t}'`).join(', ')}]. Cambiado a ['./main'] porque un build system no es un ejecutable de programa.`,
      ];
    }
  }

  return contract;
}
