export type BuilderOutcome = "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN";
export type QualityInsightCategory =
  | "security"
  | "architecture"
  | "quality"
  | "rubricCompliance";
export type SupportedProjectType =
  | "CLI"
  | "MODULE_CLI"
  | "WEB_ASGI"
  | "WEB_WSGI"
  | "DJANGO_SERVICE"
  | "BATCH_WORKER"
  | "PYPROJECT_GENERIC"
  | "CUSTOM_MANIFEST"
  | "UNKNOWN";
export type PreflightCompatibility =
  | "SUPPORTED_AUTO"
  | "SUPPORTED_WITH_MANIFEST"
  | "PARTIAL"
  | "UNSUPPORTED";
export type DependencyManager =
  | "pip-requirements"
  | "pyproject"
  | "poetry"
  | "pdm"
  | "uv"
  | "pipenv"
  | "setuptools"
  | "unknown";
type PythonProjectLayout =
  | "flat-root"
  | "src-layout"
  | "package-installable"
  | "monorepo-subdir"
  | "unknown";
export type PythonExecutionProfile =
  | "cli-script"
  | "module-cli"
  | "web-asgi"
  | "web-wsgi"
  | "django-service"
  | "batch-worker"
  | "custom-manifest"
  | "unknown";
export type ManifestSource = "AUTO" | "DOCKUS_MANIFEST";

export interface BuildRunRuntimeTarget {
  projectId: string;
  workspaceNetworkName: string;
  executionNetworkName: string;
  primaryContainerId: string | null;
  helperContainerIds: string[];
}

export type BuildRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type BuildRunKind = "STANDARD";

export type EvidenceArtifactType =
  | "BUILD_LOG"
  | "RUNTIME_EVENTS"
  | "CONTAINER_INSPECT"
  | "CONTAINER_LOG"
  | "TEST_LOG"
  | "REPORT_TEXT"
  | "REPORT_JSON"
  | "REPRODUCIBILITY_JSON"
  | "PREFLIGHT"
  | "CLASSIFICATION"
  | "STRATEGY"
  | "STATIC_FINDINGS"
  | "STATIC_REVIEW"
  | "SELF_HEALING_TRACE"
  | "LLM_PLAN_PROMPT"
  | "LLM_PLAN_RAW_RESPONSE"
  | "LLM_PLAN_PARSED"
  | "LLM_PLAN_ERROR"
  | "LLM_EVAL_PROMPT"
  | "LLM_EVAL_RAW_RESPONSE"
  | "LLM_EVAL_PARSED"
  | "LLM_EVAL_ERROR"
  | "LLM_QUALITY_PROMPT"
  | "LLM_QUALITY_RAW_RESPONSE"
  | "LLM_QUALITY_PARSED"
  | "LLM_QUALITY_ERROR";

export interface EvidenceArtifactDto {
  id: string;
  type: EvidenceArtifactType;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export type BuildStage =
  | "WORKSPACE"
  | "EXECUTION"
  | "LLM_EVALUATION"
  | "CLEANUP";

export type TechnicalFeedbackSeverity = "low" | "medium" | "high";
export type TechnicalFeedbackLevel = "basico" | "intermedio" | "avanzado";
export type BuilderRuntimeFamily = "python" | "node" | "c" | "unknown";

export interface RubricGradeItem {
  criterion: string;
  maxPoints: number;
  awarded: number;
  justification: string;
}

export interface TechnicalFeedbackItem {
  title: string;
  detail: string;
  severity: TechnicalFeedbackSeverity;
  file: string | null;
  line: number | null;
  codeSnippet: string;
  level: TechnicalFeedbackLevel;
  conceptExplanation: string;
}

export interface TechnicalFeedbackReport {
  security: TechnicalFeedbackItem[];
  architecture: TechnicalFeedbackItem[];
  quality: TechnicalFeedbackItem[];
  rubricCompliance: TechnicalFeedbackItem[];
}

export type BuilderCoachingPassReadiness = "BLOCKED" | "READY_WITH_SUGGESTIONS";

export interface BuilderReportCoaching {
  passReadiness: BuilderCoachingPassReadiness;
  mustFix: TechnicalFeedbackItem[];
  shouldImprove: TechnicalFeedbackItem[];
  strengths: TechnicalFeedbackItem[];
  nextAttemptChecklist: string[];
}

export interface BuilderSelfHealingReport {
  attempted: boolean;
  recovered: boolean;
  attemptsUsed: number;
  summary: string;
}

export interface BuilderPreflightFinding {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  file?: string | null;
  line?: number | null;
}

interface PythonTestStrategy {
  studentTestsPresent: boolean;
  teacherTestsSupported: boolean;
  suggestedCommand: string[] | null;
}

interface PythonHealthStrategy {
  kind: "http" | "command" | "none";
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

export interface BuilderReportEntity {
  readableText?: string;
  llmRecommendations?: string[];
  overallOutcome?: "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN";
  technicalFeedback?: TechnicalFeedbackReport;
  selfHealing?: BuilderSelfHealingReport;
  coaching?: BuilderReportCoaching;
}

export interface BuildRunEntity {
  id: string;
  deliveryId: string;
  triggeredById: string;
  runKind: BuildRunKind;
  status: BuildRunStatus;
  activeStage?: BuildStage | null;
  latestEventSequence?: number | null;
  isTerminal: boolean;
  stackResult?: unknown;
  dockerfileContent?: string | null;
  buildLogs?: unknown;
  timingsMs?: unknown;
  staticFindings?: unknown;
  stageResults?: unknown;
  llmAssessment?: {
    structuralType?: string;
    evaluativeState?: string;
    confidence?: string;
    rationale?: string;
    recommendedGrade?: number;
    gradeBreakdown?: RubricGradeItem[];
    studentSummary?: string;
    teacherSummary?: string;
    evidenceSummary?: string;
    observedEvidence?: string[];
    evaluationLimits?: string[];
    runtime?: {
      family: BuilderRuntimeFamily;
      version?: string | null;
      supported?: boolean;
      reason?: string | null;
    };
    capabilities?: Record<
      string,
      {
        status: string;
        rationale: string;
      }
    >;
    recipe?: unknown;
  } | null;
  preflightSummary?: BuilderPreflightSummary | null;
  evidenceArtifacts?: EvidenceArtifactDto[] | null;
  report?: BuilderReportEntity | null;
  executionContext?: unknown;
  runtimeTarget?: BuildRunRuntimeTarget | null;
  failureReason?: string | null;
  warnings: string[];
  imageTag?: string | null;
  imageExpiresAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueBuildRunResponse {
  buildRunId: string;
  status: BuildRunStatus;
  deliveryId: string;
}

export interface BuildRunEvent {
  id: string;
  buildRunId: string;
  sequence: number;
  eventType:
    | "RUN_ENQUEUED"
    | "RUN_STARTED"
    | "RUN_STATUS_CHANGED"
    | "STAGE_STARTED"
    | "STAGE_FINISHED"
    | "LOG_CHUNK"
    | "WARNING_ADDED"
    | "ARTIFACT_ADDED"
    | "REPORT_READY"
    | "RUN_COMPLETED"
    | "RUN_FAILED"
    | "RUN_CANCELLED";
  runStatus?: BuildRunStatus | null;
  stage?: BuildStage | null;
  message: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
}

export interface BuildRunEventsPage {
  events: BuildRunEvent[];
  latestSequence: number;
  hasMore: boolean;
}

export interface BuildRunChatMessage {
  id: string;
  buildRunId: string;
  sender: "user" | "assistant";
  message: string;
  createdAt: string;
}
