/**
 * @fileoverview Paquete de contratos y DTOs compartidos entre el backend y frontend (@dockus/contracts).
 *
 * @description
 * Define interfaces y tipos puramente estáticos para garantizar el Type-Safety
 * a lo largo de las peticiones REST HTTP, eventos SSE y tipos de dominio.
 *
 * Reglas:
 * - SOLO tipos e interfaces puras. Nada de runtime (sin enums, sin const, sin
 *   funciones), de modo que todo importado desde aquí se borra en compilación.
 * - Los valores de las uniones coinciden con los enums de runtime del backend.
 *
 * @module Contracts
 */

// ---------------------------------------------------------------------------
// Uniones base (equivalen a los enums/const del backend por valor)
// ---------------------------------------------------------------------------

export type DeliveryStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'EVALUATED';

export type BuilderOutcome = 'PASS' | 'FAIL' | 'PARTIAL' | 'UNKNOWN';

export type CodeQualityCategory =
  | 'security'
  | 'architecture'
  | 'quality'
  | 'rubricCompliance';

export type FindingSeverity = 'low' | 'medium' | 'high';

export type ReconcileOperationalIssueMode = 'dry-run' | 'apply';

export type ReconcileOperationalIssueCategory =
  | 'orphanAssignments'
  | 'orphanDeliveries'
  | 'orphanStorageObjects';

export type OperationalIssueCategory = 'assignment' | 'delivery' | 'storage';

export type OperationalIssueSeverity = 'warning' | 'error';

export type StorageAssetRole = 'STUDENT_SOURCE' | 'TEACHER_TESTS';

// ---------------------------------------------------------------------------
// Entrega (delivery)
// ---------------------------------------------------------------------------

export interface DeliveryResponse {
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
  // Opcional para admitir tanto al backend (que siempre lo emite) como a los
  // mocks del frontend (que lo omiten).
  deletedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Objeto de almacenamiento (storage)
// ---------------------------------------------------------------------------

export interface StorageObjectResponse {
  id: string;
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
  projectName?: string;
  deliveryVersion?: number;
  studentName?: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Asignación de proyecto (assignment)
// ---------------------------------------------------------------------------

export interface CourseGroupRef {
  id: string;
  name: string;
  code: string | null;
}

export interface TeacherRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ProjectAssignmentResponse {
  id: string;
  projectId: string;
  projectTitle: string;
  projectExpectedType: string | null;
  /** Equipo docente del proyecto. El alumno solo ve nombres, nunca enlaces al perfil. */
  teachers: TeacherRef[];
  maxDeliveriesPerStudent: number;
  sourceGroupIds: string[];
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
  rubricInstructions: string | null;
  courseGroupId: string | null;
  courseGroup: CourseGroupRef | null;
}

export interface BulkAssignSummary {
  requestedIds: string[];
  requestedEmails: string[];
  requestedGroupIds: string[];
  resolvedStudentIds: string[];
  assignedCount: number;
  reactivatedCount: number;
  alreadyActiveCount: number;
  unresolvedEmails: string[];
}

export interface BulkAssignResponse {
  assignments: ProjectAssignmentResponse[];
  summary: BulkAssignSummary;
}

// ---------------------------------------------------------------------------
// Progreso de proyecto
// ---------------------------------------------------------------------------

export interface ProjectProgressPerStudent {
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
  perStudent: ProjectProgressPerStudent[];
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

// ---------------------------------------------------------------------------
// Incidencias operativas
// ---------------------------------------------------------------------------

export interface ProjectOperationalIssue {
  id: string;
  category: OperationalIssueCategory;
  severity: OperationalIssueSeverity;
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

export interface ProjectOperationalIssuesReconcileAction {
  category: ReconcileOperationalIssueCategory;
  targetId: string;
  action: string;
  outcome: 'would_apply' | 'applied' | 'failed';
  detail: string;
}

export interface ProjectOperationalIssuesReconcileResult {
  mode: ReconcileOperationalIssueMode;
  requestedCategories: ReconcileOperationalIssueCategory[];
  matched: Record<ReconcileOperationalIssueCategory, number>;
  applied: Record<ReconcileOperationalIssueCategory, number>;
  actions: ProjectOperationalIssuesReconcileAction[];
}

// ---------------------------------------------------------------------------
// Insights de calidad (nivel proyecto; los findings por estudiante NO se
// comparten porque su shape difiere entre backend y frontend)
// ---------------------------------------------------------------------------

export interface ProjectQualityInsight {
  title: string;
  category: CodeQualityCategory;
  severity: FindingSeverity;
  studentCount: number;
}

export interface ProjectQualityInsightsSummary {
  projectId: string;
  totalStudentsAnalyzed: number;
  insights: ProjectQualityInsight[];
  category?: CodeQualityCategory;
}

// ---------------------------------------------------------------------------
// Perfil de estudiante (expediente transversal: alumno -> proyectos)
// ---------------------------------------------------------------------------

export type BuildRunStatusRef =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface StudentProfileRun {
  id: string;
  status: BuildRunStatusRef;
  createdAt: string;
  finishedAt: string | null;
  inputTokens: number;
  outputTokens: number;
  executionCostUsd: number;
}

export interface StudentProfileDelivery {
  id: string;
  version: number;
  status: DeliveryStatus;
  isLate: boolean;
  grade: number | null;
  /**
   * `Delivery` no tiene `submittedAt`: el único sello temporal fiable es
   * `createdAt`, que es el que ya usa el gradebook como fecha de entrega.
   */
  createdAt: string;
  runs: StudentProfileRun[];
}

export interface StudentProfileProject {
  id: string;
  title: string;
  status: string;
  expectedType: string | null;
  teachers: TeacherRef[];
  /** Nota de la última entrega evaluada, o null si aún no hay ninguna. */
  grade: number | null;
  /** Entregas de la más reciente a la más antigua. */
  deliveries: StudentProfileDelivery[];
}

export interface StudentProfileSummary {
  projectsCount: number;
  deliveriesCount: number;
  /** Runs sobre las entregas del alumno. NO se cuentan por `triggeredById`: los lanza el profesor. */
  runsCount: number;
  evaluatedCount: number;
  averageGrade: number | null;
}

export interface StudentProfileResponse {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
  };
  groups: CourseGroupRef[];
  summary: StudentProfileSummary;
  projects: StudentProfileProject[];
}

// ---------------------------------------------------------------------------
// Builder — Eventos de ejecuciones y chat del Tutor IA
// ---------------------------------------------------------------------------


export type BuildRunEventType =
  | 'RUN_ENQUEUED'
  | 'RUN_STARTED'
  | 'RUN_STATUS_CHANGED'
  | 'LOG_CHUNK'
  | 'WARNING_ADDED'
  | 'ARTIFACT_ADDED'
  | 'REPORT_READY'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED'
  | 'RUN_CANCELLED';

export interface BuildRunEvent {
  id: string;
  buildRunId: string;
  sequence: number;
  eventType: BuildRunEventType;
  runStatus: BuildRunStatusRef | null;
  message: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface BuildRunEventsPage {
  events: BuildRunEvent[];
  latestSequence: number;
  hasMore: boolean;
}

export type ChatMessageSender = 'user' | 'assistant';

export interface ChatMessageResponse {
  id: string;
  buildRunId: string;
  sender: ChatMessageSender;
  message: string;
  createdAt: string;
}
