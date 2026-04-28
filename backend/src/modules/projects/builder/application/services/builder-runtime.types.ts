import {
  BuilderExecutionMode,
  BuilderObservedEvidence,
  BuilderPipelineOutcome,
  BuilderSelfHealingAttempt,
  EvidenceArtifactPublic,
  LlmPlanRecipe,
  StaticReviewIssue,
  StageResult,
} from '../../domain/builder.types';
import { BuildRun } from '../../domain/entities/build-run.entity';

export interface BuilderAttemptDiagnostics {
  buildLogText: string | null;
  buildLogTail: string[];
  containerLogs: string | null;
  containerLogTail: string[];
  containerInspect: string | null;
  runtimeEvents: string | null;
  imageTag: string | null;
  executionNetworkName: string | null;
}

export interface BuilderRuntimeState {
  warnings: string[];
  stageResults: StageResult[];
  evidenceArtifacts: EvidenceArtifactPublic[];
  observedEvidence: BuilderObservedEvidence;
  staticReviewIssues: StaticReviewIssue[];
  staticReviewWarnings: string[];
  selfHealingTrace: BuilderSelfHealingAttempt[];
  currentAttemptDiagnostics: BuilderAttemptDiagnostics;
  runtimeOutputs: BuilderPipelineOutcome['runtimeOutputs'];
}

export interface BuilderRuntimeStageInput {
  run: BuildRun;
  deliveryId: string;
  workspaceNetworkName: string;
  recipe: LlmPlanRecipe;
  runtimeMode: BuilderExecutionMode;
  state: BuilderRuntimeState;
}
