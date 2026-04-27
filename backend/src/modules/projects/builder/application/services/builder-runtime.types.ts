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
  podLogs: string | null;
  podLogTail: string[];
  podDescribe: string | null;
  kubernetesEvents: string | null;
  imageTag: string | null;
  namespace: string | null;
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
  clusterName: string;
  recipe: LlmPlanRecipe;
  runtimeMode: BuilderExecutionMode;
  state: BuilderRuntimeState;
}
