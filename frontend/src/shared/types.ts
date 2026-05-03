export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";
export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";
export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ProjectRuntimeEnvironmentStatus =
  | "ABSENT"
  | "PROVISIONING"
  | "READY"
  | "ERROR"
  | "DELETING";
export type DeliveryStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "EVALUATED";
export type StorageScopeType = "DELIVERY" | "PROJECT";
export type StorageAssetRole = "STUDENT_SOURCE" | "TEACHER_TESTS";
export type BuilderOutcome = "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN";
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
export type PythonProjectLayout =
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
export type StudentWorkflowState =
  | "NOT_ASSIGNED"
  | "WINDOW_NOT_OPEN"
  | "READY_TO_SUBMIT"
  | "RECEIVED"
  | "QUEUED"
  | "RUNNING"
  | "REPORT_READY"
  | "AWAITING_TEACHER_REVIEW"
  | "GRADED";

export interface ApiErrorPayload {
  message: string | string[];
  error?: string;
  statusCode?: number;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface SessionRecord {
  id: string;
  label: string;
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  createdAt: string;
}

export interface UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProjectEntity {
  id: string;
  title: string;
  contextAcademico: string | null;
  maxDeliveriesPerStudent: number;
  expectedType: string | null;
  rubricInstructions: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  status: ProjectStatus;
  creatorId: string;
  teachers?: UserEntity[];
  runtimeNetworkName?: string | null;
  runtimeEnvironmentStatus?: ProjectRuntimeEnvironmentStatus;
  runtimeProvisionedAt?: string | null;
  runtimeLastError?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface BuildRunRuntimeTarget {
  projectId: string;
  workspaceNetworkName: string;
  executionNetworkName: string;
  primaryContainerId: string | null;
  helperContainerIds: string[];
}

export interface ProjectAssignmentEntity {
  id: string;
  projectId: string;
  projectTitle: string;
  maxDeliveriesPerStudent: number;
  studentId: string;
  studentEmail: string;
  studentName: string;
  assignedById: string;
  assignedAt: string;
  revokedAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
  courseGroupId: string | null;
  sourceGroupIds: string[];
}

export interface CourseGroupEntity {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
}

export interface GroupEnrollmentEntity {
  id: string;
  groupId: string;
  groupName: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  enrolledById: string;
  enrolledAt: string;
  revokedAt: string | null;
}

export interface BulkAssignResponse {
  assignments: ProjectAssignmentEntity[];
  summary: {
    requestedIds: string[];
    requestedEmails: string[];
    requestedGroupIds: string[];
    resolvedStudentIds: string[];
    assignedCount: number;
    reactivatedCount: number;
    alreadyActiveCount: number;
    unresolvedEmails: string[];
  };
}

export interface BulkGroupEnrollResponse {
  enrollments: GroupEnrollmentEntity[];
  summary: {
    requestedIds: string[];
    requestedEmails: string[];
    resolvedStudentIds: string[];
    enrolledCount: number;
    reactivatedCount: number;
    alreadyActiveCount: number;
    unresolvedEmails: string[];
    unresolvedNames: string[];
  };
}

export interface DeliveryEntity {
  id: string;
  assignmentId: string;
  projectId: string;
  projectTitle: string;
  authorId: string;
  studentEmail: string;
  studentName: string;
  version: number;
  status: DeliveryStatus;
  notes: string | null;
  isLate: boolean;
  grade: number | null;
  graderNotes: string | null;
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface StorageObjectEntity {
  id: string;
  scopeType: StorageScopeType;
  scopeId: string;
  assetRole: StorageAssetRole;
  projectId: string | null;
  deliveryId: string | null;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  createdAt: string;
  uploaderId: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

export type BuildRunStatus =
  | "QUEUED"
  | "ANALYZING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type BuildRunKind = "STANDARD";

export type BuildStage =
  | "WORKSPACE"
  | "EXECUTION"
  | "LLM_EVALUATION"
  | "CLEANUP";

export type TechnicalFeedbackSeverity = "low" | "medium" | "high";

export interface TechnicalFeedbackItem {
  title: string;
  detail: string;
  severity: TechnicalFeedbackSeverity;
  file: string | null;
  line: number | null;
}

export interface TechnicalFeedbackReport {
  security: TechnicalFeedbackItem[];
  architecture: TechnicalFeedbackItem[];
  quality: TechnicalFeedbackItem[];
  rubricCompliance: TechnicalFeedbackItem[];
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

export interface PythonTestStrategy {
  studentTestsPresent: boolean;
  teacherTestsSupported: boolean;
  suggestedCommand: string[] | null;
}

export interface PythonHealthStrategy {
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
    evidenceSummary?: string;
    observedEvidence?: string[];
    evaluationLimits?: string[];
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
  evidenceArtifacts?: unknown;
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

export interface ProjectProgressSummary {
  projectId: string;
  totalAssignments: number;
  deliveredAtLeastOnce: number;
  passedAllTests: number;
  neverDelivered: number;
  statusTotals: {
    pending: number;
    submitted: number;
    inReview: number;
    evaluated: number;
  };
  outcomeTotals: Record<BuilderOutcome, number>;
  perStudent: Array<{
    studentId: string;
    studentName: string;
    studentEmail: string;
    deliveryCount: number;
    latestStatus: DeliveryStatus | null;
    latestDeliveryId: string | null;
    latestDeliveryCreatedAt: string | null;
    latestBuilderOutcome: BuilderOutcome | null;
    grade: number | null;
    isLate: boolean;
    remainingDeliveries: number;
  }>;
}

export interface ProjectGradebookRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  groupIds: string[];
  groupLabels: string[];
  assignmentId: string;
  deliveryCount: number;
  remainingDeliveries: number;
  latestDeliveryId: string | null;
  latestDeliveryCreatedAt: string | null;
  latestStatus: DeliveryStatus | null;
  latestBuilderOutcome: BuilderOutcome | null;
  grade: number | null;
  graderNotes: string | null;
  isLate: boolean;
  lastActivityAt: string;
}

export interface ProjectOperationalIssue {
  id: string;
  category: "assignment" | "delivery" | "storage";
  severity: "warning" | "error";
  title: string;
  detail: string;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string | null;
}

export interface ProjectOperationalIssuesSummary {
  counts: {
    orphanAssignments: number;
    orphanDeliveries: number;
    orphanStorageObjects: number;
    revokedAssignments: number;
    lateDeliveries: number;
    ungradedEvaluatedDeliveries: number;
  };
  issues: ProjectOperationalIssue[];
}

export interface ProjectOperationalIssuesReconcileResult {
  mode: "dry-run" | "apply";
  requestedCategories: Array<
    "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects"
  >;
  matched: Record<
    "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects",
    number
  >;
  applied: Record<
    "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects",
    number
  >;
  actions: Array<{
    category:
      | "orphanAssignments"
      | "orphanDeliveries"
      | "orphanStorageObjects";
    targetId: string;
    action: string;
    outcome: "would_apply" | "applied" | "failed";
    detail: string;
  }>;
}

export interface ProjectRuntimeContainerSummary {
  id: string;
  name: string;
  state: string;
  status: string;
  restartCount: number;
}

export interface ProjectRuntimeNetworkSummary {
  name: string;
  scope: "workspace" | "run" | "unknown";
  containers: ProjectRuntimeContainerSummary[];
}

export interface ProjectRuntimeActiveRunSummary {
  buildRunId: string;
  deliveryId: string;
  status: BuildRunStatus;
  activeStage: BuildStage | null;
  executionNetworkName: string | null;
  primaryContainerId: string | null;
  helperContainerIds: string[];
  createdAt: string;
}

export interface ProjectRuntimeStatusResponse {
  projectId: string;
  workspaceNetworkName: string | null;
  status: ProjectRuntimeEnvironmentStatus;
  provisionedAt: string | null;
  lastError: string | null;
  activeRuns: ProjectRuntimeActiveRunSummary[];
  networks: ProjectRuntimeNetworkSummary[];
}
