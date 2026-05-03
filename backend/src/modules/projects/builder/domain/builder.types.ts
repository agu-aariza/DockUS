import { BuildRunArtifactType } from './entities/build-run-artifact.entity';

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
 
export interface LlmPlanRecipe {
  install: string[][];
  run: string[] | null;
  test: string[][];
  healthcheck: string[] | null;
  servicePort: number | null;
  systemPackages: string[];
  runtimeVersion?: string | null;
  workingDirectory?: string | null;
  environment?: Record<string, string> | null;
}
 
export interface BuilderLlmAssessment {
  thought: string;
  structuralType: StructuralType;
  capabilities: Record<CapabilityId, CapabilityAssessment>;
  evaluativeState: EvaluativeState;
  confidence: Confidence;
  rationale: string;
  recommendedGrade?: number;
  externalRequirements: string[];
  recipe: LlmPlanRecipe;
  evidenceSummary: string;
  observedEvidence: string[];
  evaluationLimits: string[];
}
 
export interface AssignmentContext {
  expectedType: string | null;
  rubricInstructions: string | null;
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
