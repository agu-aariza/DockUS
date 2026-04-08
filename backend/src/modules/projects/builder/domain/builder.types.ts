import { BuildRunArtifactType } from './entities/build-run-artifact.entity';

export enum StageStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

export enum BuildStage {
  ANALYSIS = 'ANALYSIS',
  BUILD = 'BUILD',
  DEPLOY = 'DEPLOY',
  PROBES = 'PROBES',
  STABILITY = 'STABILITY',
  TESTS = 'TESTS',
  CLEANUP = 'CLEANUP',
}

export enum FindingSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export const STRUCTURAL_TYPES = [
  'T1',
  'T2',
  'T3',
  'T4',
  'T5',
  'T6',
  'T7',
  'T8',
] as const;

export type StructuralType = (typeof STRUCTURAL_TYPES)[number];

export const CAPABILITY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const EVALUATIVE_STATES = ['E1', 'E2', 'E3', 'E4'] as const;

export type EvaluativeState = (typeof EVALUATIVE_STATES)[number];

export const ASSESSMENTS = ['yes', 'no', 'unknown'] as const;

export type Assessment = (typeof ASSESSMENTS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const BUILD_RUN_KINDS = ['STANDARD', 'FROZEN_REPLAY'] as const;

export type BuildRunKind = (typeof BUILD_RUN_KINDS)[number];

export const BUILD_RUN_EVENT_TYPES = [
  'RUN_ENQUEUED',
  'RUN_STARTED',
  'RUN_STATUS_CHANGED',
  'STAGE_STARTED',
  'STAGE_FINISHED',
  'WARNING_ADDED',
  'ARTIFACT_ADDED',
  'REPORT_READY',
  'REPRODUCIBILITY_READY',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
] as const;

export type BuildRunEventType = (typeof BUILD_RUN_EVENT_TYPES)[number];

export const COMPARISON_VERDICTS = [
  'IMPROVED',
  'REGRESSED',
  'UNCHANGED',
  'MIXED',
] as const;

export type ComparisonVerdict = (typeof COMPARISON_VERDICTS)[number];

export const REPRODUCIBILITY_STATUSES = [
  'MATCH',
  'DRIFT',
  'BLOCKED',
  'INCONCLUSIVE',
] as const;

export type ReproducibilityStatus = (typeof REPRODUCIBILITY_STATUSES)[number];

export type BuilderExecutionMode = 'analysis_only' | 'batch' | 'service';

export interface CapabilityAssessment {
  status: Assessment;
  rationale: string;
}

export interface LlmPlanRecipe {
  install: string[][];
  run: string[] | null;
  test: string[][];
  healthcheck: string[] | null;
  servicePort: number | null;
  systemPackages: string[];
}

export interface BuilderLlmAssessment {
  structuralType: StructuralType;
  capabilities: Record<CapabilityId, CapabilityAssessment>;
  evaluativeState: EvaluativeState;
  confidence: Confidence;
  rationale: string;
  externalRequirements: string[];
  recipe: LlmPlanRecipe;
  evidenceSummary: string;
  observedEvidence: string[];
  evaluationLimits: string[];
}

export interface BuilderLlmPhaseResult {
  model: string;
  assessment: BuilderLlmAssessment;
}

export interface BuilderReport extends BuilderLlmAssessment {
  readableText: string;
  stageOutcome: Record<BuildStage, StageStatus>;
  relevantEvidence: string[];
}

export interface BuilderObservedEvidence {
  workspaceSummary: string;
  build: {
    attempted: boolean;
    succeeded: boolean;
    summary: string;
    logTail: string[];
  };
  runtime: {
    mode: BuilderExecutionMode;
    deploySummary: string;
    probeSummary: string;
    stabilitySummary: string;
    testSummary: string;
    healthcheckSummary: string;
  };
}

export interface RuntimeFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface StaticFinding {
  id: string;
  severity: FindingSeverity;
  category: 'security' | 'portability' | 'evaluability';
  file: string;
  line: number;
  evidence: string;
}

export interface StageResult {
  stage: BuildStage;
  status: StageStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  reasonCode: string;
  evidenceRefs: string[];
}

export interface ExecutionContext {
  pythonBaseImage: string;
  pythonBaseImageDigest: string | null;
  dockerVersion: string | null;
  kindVersion: string | null;
  kubectlVersion: string | null;
  clusterName: string;
  limits: {
    batchTimeoutSeconds: number;
    serviceReadyTimeoutSeconds: number;
    stabilityWindowSeconds: number;
  };
}

export interface EvidenceArtifactPublic {
  id: string;
  type: BuildRunArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BuilderRunEvent {
  id: string;
  buildRunId: string;
  sequence: number;
  eventType: BuildRunEventType;
  runStatus: string | null;
  stage: BuildStage | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface BuilderRunEventsPage {
  events: BuilderRunEvent[];
  latestSequence: number;
  hasMore: boolean;
}

export interface ReproducibilitySnapshotInput {
  storageObjectId: string;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  bucket: string;
  objectKey: string;
  createdAt: string;
}

export interface ReproducibilitySnapshot {
  sourceRunId: string;
  deliveryId: string;
  createdAt: string;
  inputManifest: ReproducibilitySnapshotInput[];
  frozenRecipe: LlmPlanRecipe;
  frozenAssessment: Pick<
    BuilderLlmAssessment,
    'structuralType' | 'capabilities' | 'evaluativeState' | 'confidence'
  >;
  dockerfile: {
    content: string | null;
    sha256: string | null;
  };
  executionContext: ExecutionContext;
  expectedOutcome: {
    stageMatrix: Record<BuildStage, StageStatus>;
    warnings: string[];
    failureReason: string | null;
    staticFindingSignature: string[];
  };
}

export interface ReproducibilityCheck {
  id: string;
  status: ReproducibilityStatus;
  expected: string;
  observed: string;
}

export interface ReproducibilityResult {
  sourceRunId: string;
  replayRunId: string;
  overallStatus: ReproducibilityStatus;
  summary: string;
  checks: ReproducibilityCheck[];
  evidenceRefs: string[];
}

export interface BuilderCapabilityDelta {
  capabilityId: CapabilityId;
  baseStatus: Assessment;
  candidateStatus: Assessment;
  change: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
}

export interface BuilderStageDelta {
  stage: BuildStage;
  baseStatus: StageStatus;
  candidateStatus: StageStatus;
  change: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
}

export interface BuilderFindingDelta {
  resolved: StaticFinding[];
  added: StaticFinding[];
  persisting: StaticFinding[];
}

export interface BuilderRunComparison {
  baseRunId: string;
  candidateRunId: string;
  deliveryId: string;
  overallVerdict: ComparisonVerdict;
  evaluativeStateDelta: {
    base: EvaluativeState;
    candidate: EvaluativeState;
  };
  confidenceDelta: {
    base: Confidence;
    candidate: Confidence;
  };
  capabilityDelta: BuilderCapabilityDelta[];
  stageDelta: BuilderStageDelta[];
  findingDelta: BuilderFindingDelta;
  warningsDelta: {
    resolved: string[];
    added: string[];
    persisting: string[];
  };
  failureReasonDelta: {
    base: string | null;
    candidate: string | null;
  };
  recipeHashDelta: {
    base: string | null;
    candidate: string | null;
  };
  dockerfileHashDelta: {
    base: string | null;
    candidate: string | null;
  };
  executionContextDelta: {
    base: ExecutionContext | null;
    candidate: ExecutionContext | null;
    changedFields: string[];
  };
  technicalSummary: string;
  evidenceRefs: string[];
}

export interface BuilderPipelineOutcome {
  llmAssessment: BuilderLlmAssessment;
  staticFindings: StaticFinding[];
  stageResults: StageResult[];
  evidenceArtifacts: EvidenceArtifactPublic[];
  report: BuilderReport;
  executionContext: ExecutionContext;
  reproducibilitySnapshot: ReproducibilitySnapshot | null;
  reproducibilityResult: ReproducibilityResult | null;
  runtimeOutputs: {
    stackResult: unknown;
    dockerfileContent: string | null;
    buildLogs: unknown;
    timingsMs: unknown;
  };
  failureReason: string | null;
  warnings: string[];
}
