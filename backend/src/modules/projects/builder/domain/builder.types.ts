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
  'rubricCompliance',
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
  'LOG_CHUNK',
  'WARNING_ADDED',
  'ARTIFACT_ADDED',
  'REPORT_READY',
  'RUN_COMPLETED',
  'RUN_FAILED',
  'RUN_CANCELLED',
] as const;

export type BuildRunEventType = (typeof BUILD_RUN_EVENT_TYPES)[number];

export type BuilderExecutionMode = 'analysis_only' | 'batch' | 'service';

export const SUPPORTED_PROJECT_TYPES = [
  'CLI',
  'MODULE_CLI',
  'WEB_ASGI',
  'WEB_WSGI',
  'DJANGO_SERVICE',
  'BATCH_WORKER',
  'PYPROJECT_GENERIC',
  'CUSTOM_MANIFEST',
  'UNKNOWN',
] as const;

export type SupportedProjectType = (typeof SUPPORTED_PROJECT_TYPES)[number];

export const PREFLIGHT_COMPATIBILITIES = [
  'SUPPORTED_AUTO',
  'SUPPORTED_WITH_MANIFEST',
  'PARTIAL',
  'UNSUPPORTED',
] as const;

export type PreflightCompatibility = (typeof PREFLIGHT_COMPATIBILITIES)[number];

export const PYTHON_DEPENDENCY_MANAGERS = [
  'pip-requirements',
  'pyproject',
  'poetry',
  'pdm',
  'uv',
  'pipenv',
  'setuptools',
  'unknown',
] as const;

export type DependencyManager = (typeof PYTHON_DEPENDENCY_MANAGERS)[number];

export const PYTHON_PROJECT_LAYOUTS = [
  'flat-root',
  'src-layout',
  'package-installable',
  'monorepo-subdir',
  'unknown',
] as const;

export type PythonProjectLayout = (typeof PYTHON_PROJECT_LAYOUTS)[number];

export const PYTHON_EXECUTION_PROFILES = [
  'cli-script',
  'module-cli',
  'web-asgi',
  'web-wsgi',
  'django-service',
  'batch-worker',
  'custom-manifest',
  'unknown',
] as const;

export type PythonExecutionProfile = (typeof PYTHON_EXECUTION_PROFILES)[number];

export const MANIFEST_SOURCES = ['AUTO', 'DOCKUS_MANIFEST'] as const;

export type ManifestSource = (typeof MANIFEST_SOURCES)[number];

export interface PythonTestStrategy {
  studentTestsPresent: boolean;
  teacherTestsSupported: boolean;
  suggestedCommand: string[] | null;
}

export interface PythonHealthStrategy {
  kind: 'http' | 'command' | 'none';
  command: string[] | null;
  servicePort: number | null;
  path: string | null;
}

export interface PythonProjectModel {
  pythonVersionConstraint: string | null;
  dependencyManager: DependencyManager;
  projectLayout: PythonProjectLayout;
  executionProfile: PythonExecutionProfile;
  entrypoints: string[];
  testStrategy: PythonTestStrategy;
  healthStrategy: PythonHealthStrategy;
  systemDependencies: string[];
  workingDirectory: string;
  detectedFramework: string | null;
  packageRoot: string | null;
}

export interface ResolvedExecutionPlan {
  dependencyManager: DependencyManager;
  executionProfile: PythonExecutionProfile;
  workingDirectory: string;
  manifestSource: ManifestSource;
  pythonVersionConstraint: string | null;
  entrypoint: string | null;
  install: string[][];
  run: string[] | null;
  test: string[][];
  healthcheck: string[] | null;
  servicePort: number | null;
  systemPackages: string[];
  env: Record<string, string>;
}

export interface BuilderPreflightFinding {
  level: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  file?: string | null;
  line?: number | null;
}

export interface BuilderPreflightSummary {
  supportedProjectType: SupportedProjectType;
  compatibility: PreflightCompatibility;
  entrypointCandidates: string[];
  testsPresent: boolean;
  detectedFramework: string | null;
  detectedProjectModel: PythonProjectModel;
  dependencyManager: DependencyManager;
  pythonVersionConstraint: string | null;
  executionProfile: PythonExecutionProfile;
  workingDirectory: string;
  manifestSource: ManifestSource;
  manifestPath: string | null;
  resolvedCommands: {
    install: string[][];
    run: string[] | null;
    test: string[][];
    healthcheck: string[] | null;
  };
  resolvedEnvironment: Record<string, string>;
  resolvedServicePort: number | null;
  systemDependencies: string[];
  findings: BuilderPreflightFinding[];
  failureCode?: string | null;
}

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
  workingDirectory?: string | null;
  dependencyManager?: DependencyManager | null;
  executionProfile?: PythonExecutionProfile | null;
  manifestSource?: ManifestSource | null;
  environment?: Record<string, string> | null;
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

export interface AssignmentContext {
  expectedType: string | null;
  rubricInstructions: string | null;
}

export interface BuilderTechnicalFeedback {
  security: TechnicalFeedbackItem[];
  architecture: TechnicalFeedbackItem[];
  quality: TechnicalFeedbackItem[];
  rubricCompliance: TechnicalFeedbackItem[];
}

export interface BuildRunRuntimeTarget {
  projectId: string;
  clusterName: string;
  namespace: string;
  primaryPodName: string | null;
  helperPodNames: string[];
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
  preflightSummary: BuilderPreflightSummary;
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
