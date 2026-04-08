export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";
export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";
export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type DeliveryStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "EVALUATED";

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
  status: ProjectStatus;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface DeliveryEntity {
  id: string;
  projectId: string;
  authorId: string;
  version: number;
  status: DeliveryStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface StorageObjectEntity {
  id: string;
  deliveryId: string;
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

export type BuildRunKind = "STANDARD" | "FROZEN_REPLAY";

export type BuildStage =
  | "ANALYSIS"
  | "BUILD"
  | "DEPLOY"
  | "PROBES"
  | "STABILITY"
  | "TESTS"
  | "CLEANUP";

export interface BuildRunEntity {
  id: string;
  deliveryId: string;
  triggeredById: string;
  runKind: BuildRunKind;
  sourceRunId?: string | null;
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
  report?: unknown;
  executionContext?: unknown;
  reproducibilitySnapshot?: unknown;
  reproducibilityResult?: ReproducibilityResult | null;
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

export interface ReplayBuildRunResponse extends EnqueueBuildRunResponse {
  sourceRunId: string;
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
    | "REPRODUCIBILITY_READY"
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

export interface ReproducibilityCheck {
  id: string;
  status: "MATCH" | "DRIFT" | "BLOCKED" | "INCONCLUSIVE";
  expected: string;
  observed: string;
}

export interface ReproducibilityResult {
  sourceRunId: string;
  replayRunId: string;
  overallStatus: "MATCH" | "DRIFT" | "BLOCKED" | "INCONCLUSIVE";
  summary: string;
  checks: ReproducibilityCheck[];
  evidenceRefs: string[];
}

export interface BuildRunComparison {
  baseRunId: string;
  candidateRunId: string;
  deliveryId: string;
  overallVerdict: "IMPROVED" | "REGRESSED" | "UNCHANGED" | "MIXED";
  evaluativeStateDelta: {
    base: string;
    candidate: string;
  };
  confidenceDelta: {
    base: string;
    candidate: string;
  };
  capabilityDelta: Array<{
    capabilityId: string;
    baseStatus: string;
    candidateStatus: string;
    change: string;
  }>;
  stageDelta: Array<{
    stage: string;
    baseStatus: string;
    candidateStatus: string;
    change: string;
  }>;
  findingDelta: {
    resolved: unknown[];
    added: unknown[];
    persisting: unknown[];
  };
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
    base: unknown;
    candidate: unknown;
    changedFields: string[];
  };
  technicalSummary: string;
  evidenceRefs: string[];
}

export interface BuildRunComparisonResponse {
  overallVerdict: BuildRunComparison["overallVerdict"];
  comparison: BuildRunComparison;
}
