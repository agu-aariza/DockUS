import {
  BuilderExecutionMode,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  EvidenceArtifactPublic,
  LlmPlanRecipe,
  StageResult,
} from '../../domain/builder.types';
import { BuildRun } from '../../domain/entities/build-run.entity';

export type BuilderRuntimeVariant = 'standard' | 'frozen';

export interface BuilderRuntimeState {
  warnings: string[];
  stageResults: StageResult[];
  evidenceArtifacts: EvidenceArtifactPublic[];
  observedEvidence: BuilderObservedEvidence;
  runtimeOutputs: BuilderPipelineOutcome['runtimeOutputs'];
}

export interface BuilderRuntimeStageInput {
  variant: BuilderRuntimeVariant;
  run: BuildRun;
  deliveryId: string;
  recipe: LlmPlanRecipe;
  runtimeMode: BuilderExecutionMode;
  state: BuilderRuntimeState;
}
