export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";
export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";
export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type DeliveryStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "EVALUATED";
export type StorageScopeType = "DELIVERY" | "PROJECT";
export type StorageAssetRole = "STUDENT_SOURCE" | "TEACHER_TESTS";

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
}

export interface SessionRecord {
  id: string;
  label: string;
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
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
  status: ProjectStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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
  deliveryCount: number;
  remainingDeliveries: number;
  minimumRequirementMet: boolean;
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
  | "BUILDING"
  | "DEPLOYING"
  | "VALIDATING"
  | "CLEANING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type BuildRunKind = "STANDARD";

export type BuildStage =
  | "ANALYSIS"
  | "BUILD"
  | "DEPLOY"
  | "PROBES"
  | "STABILITY"
  | "TESTS"
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
}

export interface BuilderSelfHealingReport {
  attempted: boolean;
  recovered: boolean;
  attemptsUsed: number;
  summary: string;
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
    capabilities?: Record<
      string,
      {
        status: string;
        rationale: string;
      }
    >;
    recipe?: unknown;
  } | null;
  evidenceArtifacts?: unknown;
  report?: BuilderReportEntity | null;
  executionContext?: unknown;
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
  perStudent: Array<{
    studentId: string;
    studentEmail: string;
    deliveryCount: number;
    latestStatus: DeliveryStatus | null;
  }>;
}
