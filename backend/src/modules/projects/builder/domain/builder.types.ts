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

export interface BuilderPipelineOutcome {
  llmAssessment: BuilderLlmAssessment;
  staticFindings: StaticFinding[];
  stageResults: StageResult[];
  evidenceArtifacts: EvidenceArtifactPublic[];
  report: BuilderReport;
  executionContext: ExecutionContext;
  runtimeOutputs: {
    stackResult: unknown;
    dockerfileContent: string | null;
    buildLogs: unknown;
    timingsMs: unknown;
  };
  failureReason: string | null;
  warnings: string[];
}
