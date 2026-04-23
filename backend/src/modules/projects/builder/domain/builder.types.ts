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

export const TECHNICAL_FEEDBACK_SEVERITIES = ['low', 'medium', 'high'] as const;

export type TechnicalFeedbackSeverity =
  (typeof TECHNICAL_FEEDBACK_SEVERITIES)[number];

export const TECHNICAL_FEEDBACK_AXES = [
  'security',
  'architecture',
  'quality',
] as const;

export type TechnicalFeedbackAxis = (typeof TECHNICAL_FEEDBACK_AXES)[number];

export const STATIC_REVIEW_TOOLS = ['ruff', 'bandit'] as const;

export type StaticReviewTool = (typeof STATIC_REVIEW_TOOLS)[number];

export type StructuralType = string;

export const CAPABILITY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const EVALUATIVE_STATES = ['E1', 'E2', 'E3', 'E4'] as const;

export type EvaluativeState = (typeof EVALUATIVE_STATES)[number];

export const ASSESSMENTS = ['yes', 'no', 'unknown'] as const;

export type Assessment = (typeof ASSESSMENTS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;

export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const BUILD_RUN_KINDS = ['STANDARD'] as const;

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
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
] as const;

export type BuildRunEventType = (typeof BUILD_RUN_EVENT_TYPES)[number];

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

export interface StaticReviewIssue {
  tool: StaticReviewTool;
  ruleId: string;
  severity: TechnicalFeedbackSeverity;
  axis: TechnicalFeedbackAxis;
  message: string;
  file: string | null;
  line: number | null;
  column: number | null;
}

export interface TechnicalFeedbackItem {
  title: string;
  detail: string;
  severity: TechnicalFeedbackSeverity;
  file: string | null;
  line: number | null;
}

export interface BuilderTechnicalFeedback {
  security: TechnicalFeedbackItem[];
  architecture: TechnicalFeedbackItem[];
  quality: TechnicalFeedbackItem[];
}

export interface BuilderSelfHealingAttempt {
  attemptNumber: number;
  triggerStage: BuildStage;
  triggerReasonCode: string;
  triggerSummary: string;
  recipeChanged: boolean;
  recipeDiff: string[];
  outcome: 'repaired' | 'unchanged' | 'llm_failed' | 'not_applicable';
  diagnostics: {
    buildLogTail: string[];
    podLogTail: string[];
    errorHints: string[];
  };
}

export interface BuilderSelfHealingSummary {
  attempted: boolean;
  recovered: boolean;
  attemptsUsed: number;
  summary: string;
}

export interface BuilderReport extends BuilderLlmAssessment {
  overallOutcome: 'PASS' | 'FAIL' | 'PARTIAL' | 'UNKNOWN';
  llmRecommendations: string[];
  technicalFeedback: BuilderTechnicalFeedback;
  selfHealing: BuilderSelfHealingSummary;
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

export interface BuilderPipelineOutcome {
  llmAssessment: BuilderLlmAssessment;
  staticFindings: StaticFinding[];
  staticReviewIssues: StaticReviewIssue[];
  stageResults: StageResult[];
  evidenceArtifacts: EvidenceArtifactPublic[];
  report: BuilderReport;
  executionContext: ExecutionContext;
  runtimeOutputs: {
    stackResult: unknown;
    dockerfileContent: string | null;
    buildLogs: unknown;
    timingsMs: unknown;
    staticReview: {
      issues: StaticReviewIssue[];
      warnings: string[];
    };
    selfHealingTrace: BuilderSelfHealingAttempt[];
  };
  failureReason: string | null;
  warnings: string[];
}
