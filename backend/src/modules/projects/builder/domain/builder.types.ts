import { BuildRunArtifactType } from './entities/build-run-artifact.entity';
import type {
  BuilderLlmPromptStage,
  LlmModelProfile,
} from '../../../../shared/infrastructure/ai/llm.types';
import type { PromptSectionTrace } from './llm/builder-prompt-composer';

export const BUILDER_LLM_SCHEMA_VERSION = 'builder-llm/v2' as const;
export type BuilderLlmSchemaVersion = typeof BUILDER_LLM_SCHEMA_VERSION;

export const BUILDER_LLM_STAGES = ['plan', 'evaluation'] as const;
export type BuilderLlmStage = (typeof BUILDER_LLM_STAGES)[number];

export type StructuralType = string;

export const CAPABILITY_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export const EVALUATIVE_STATES = ['E1', 'E2', 'E3', 'E4'] as const;
export type EvaluativeState = (typeof EVALUATIVE_STATES)[number];

export const ASSESSMENTS = ['yes', 'no', 'unknown'] as const;
export type Assessment = (typeof ASSESSMENTS)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const BUILDER_RUNTIME_FAMILIES = ['python', 'node', 'c', 'unknown'] as const;
export type BuilderRuntimeFamily = (typeof BUILDER_RUNTIME_FAMILIES)[number];

export const BUILD_RUN_KINDS = ['STANDARD'] as const;
export type BuildRunKind = (typeof BUILD_RUN_KINDS)[number];

export const BUILD_RUN_EVENT_TYPES = [
  'RUN_ENQUEUED',
  'RUN_STARTED',
  'RUN_STATUS_CHANGED',
  'LOG_CHUNK',
  'WARNING_ADDED',
  'ARTIFACT_ADDED',
  'REPORT_READY',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
] as const;
export type BuildRunEventType = (typeof BUILD_RUN_EVENT_TYPES)[number];

export interface CapabilityAssessment {
  status: Assessment;
  rationale: string;
}

export type BuilderCapabilityMap = Record<CapabilityId, CapabilityAssessment>;

export interface BuilderRuntimeDescriptorV2 {
  family: BuilderRuntimeFamily;
  version: string | null;
  supported: boolean;
  reason: string | null;
}

export interface BuilderServiceRecipeV2 {
  port: number;
  healthcheck: string[] | null;
}

export interface BuilderRecipeV2 {
  install: string[][];
  run: string[] | null;
  test: string[][];
  systemPackages: string[];
  cwd: string | null;
  environment: Record<string, string> | null;
  service: BuilderServiceRecipeV2 | null;
}

export interface BuilderLlmContractV2Base {
  schemaVersion: BuilderLlmSchemaVersion;
  stage: BuilderLlmStage;
  thought: string;
  structuralType: StructuralType;
  capabilities: BuilderCapabilityMap;
  evaluativeState: EvaluativeState;
  confidence: Confidence;
  rationale: string;
  externalRequirements: string[];
  runtime: BuilderRuntimeDescriptorV2;
  recipe: BuilderRecipeV2;
  evidenceSummary: string;
  observedEvidence: string[];
  evaluationLimits: string[];
  recommendedGrade?: number;
}

export interface RubricGradeItem {
  criterion: string;
  maxPoints: number;
  awarded: number;
  justification: string;
}

export interface BuilderPlanContractV2 extends BuilderLlmContractV2Base {
  stage: 'plan';
  recommendedGrade?: undefined;
}

export interface BuilderEvaluationContractV2
  extends BuilderLlmContractV2Base {
  stage: 'evaluation';
  recommendedGrade?: number;
  gradeBreakdown: RubricGradeItem[];
  studentSummary: string;
  teacherSummary: string;
}

export type BuilderLlmContractV2 =
  | BuilderPlanContractV2
  | BuilderEvaluationContractV2;

export type BuilderLlmAssessment = BuilderEvaluationContractV2;

export interface BuilderLlmStagePromptSnapshot {
  stage: BuilderLlmPromptStage;
  promptId: string;
  model: string;
  systemPrompt: string | null;
  prompt: string;
  sections: PromptSectionTrace[];
  modelProfile: LlmModelProfile;
  createdAt: string;
}

export interface BuilderLlmStageErrorInfo {
  name: string;
  code?: string;
  message: string;
  httpStatus?: number | null;
  stack: string | null;
  timestamp: string;
}

export interface BuilderLlmStageTrace<
  TContract = BuilderLlmContractV2,
> extends BuilderLlmStagePromptSnapshot {
  schemaVersion: BuilderLlmSchemaVersion;
  rawResponse: string | null;
  parsedContract: TContract | null;
  error: BuilderLlmStageErrorInfo | null;
}

export interface AssignmentContext {
  expectedType: string | null;
  rubricInstructions: string | null;
  expectedOutput: string | null;
}

export interface BuildRunRuntimeTarget {
  projectId: string;
  workspaceNetworkName: string;
  executionNetworkName: string;
  primaryContainerId: string | null;
  helperContainerIds: string[];
}

export interface RuntimeFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface BuilderRunEvent {
  id: string;
  buildRunId: string;
  sequence: number;
  eventType: BuildRunEventType;
  runStatus: string | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface EvidenceArtifactPublic {
  id: string;
  type: BuildRunArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BuilderRunEventsPage {
  events: BuilderRunEvent[];
  latestSequence: number;
  hasMore: boolean;
}

export const CODE_QUALITY_CATEGORIES = [
  'security',
  'architecture',
  'quality',
  'rubricCompliance',
] as const;
export type CodeQualityCategory = (typeof CODE_QUALITY_CATEGORIES)[number];

export type FindingSeverity = 'low' | 'medium' | 'high';

const FINDING_LEVELS = ['basico', 'intermedio', 'avanzado'] as const;
export type FindingLevel = (typeof FINDING_LEVELS)[number];

export interface CodeQualityFinding {
  title: string;
  detail: string;
  severity: FindingSeverity;
  file?: string;
  line?: number;
  codeSnippet: string;
  level: FindingLevel;
  conceptExplanation: string;
}

export const BUILDER_OUTCOMES = ['PASS', 'FAIL', 'PARTIAL', 'UNKNOWN'] as const;
export type BuilderOutcome = (typeof BUILDER_OUTCOMES)[number];

export const BUILDER_COACHING_PASS_READINESS = [
  'BLOCKED',
  'READY_WITH_SUGGESTIONS',
] as const;
export type BuilderCoachingPassReadiness =
  (typeof BUILDER_COACHING_PASS_READINESS)[number];

export interface BuilderCodeQualityContractV2 {
  thought: string;
  security: CodeQualityFinding[];
  architecture: CodeQualityFinding[];
  quality: CodeQualityFinding[];
  rubricCompliance: CodeQualityFinding[];
}

export interface BuilderSelfHealingReport {
  attempted: boolean;
  recovered: boolean;
  attemptsUsed: number;
  summary: string;
}

export interface BuilderTechnicalFeedbackReport {
  security: CodeQualityFinding[];
  architecture: CodeQualityFinding[];
  quality: CodeQualityFinding[];
  rubricCompliance: CodeQualityFinding[];
}

export interface BuilderReportCoaching {
  passReadiness: BuilderCoachingPassReadiness;
  mustFix: CodeQualityFinding[];
  shouldImprove: CodeQualityFinding[];
  strengths: CodeQualityFinding[];
  nextAttemptChecklist: string[];
}

export interface BuilderReportEntity {
  readableText?: string;
  llmRecommendations?: string[];
  overallOutcome?: BuilderOutcome;
  technicalFeedback?: BuilderTechnicalFeedbackReport;
  selfHealing?: BuilderSelfHealingReport;
  coaching?: BuilderReportCoaching;
}
