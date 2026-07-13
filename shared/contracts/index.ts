/**
 * @dockus/contracts — Contratos de tipos compartidos entre backend y frontend.
 *
 * Reglas:
 * - SOLO tipos e interfaces puras. Nada de runtime (sin enums, sin const, sin
 *   funciones), de modo que todo importado desde aquí se borra en compilación y
 *   nunca genera un import en tiempo de ejecución.
 * - Los valores de las uniones coinciden con los enums de runtime del backend
 *   (p. ej. `DeliveryStatus`), que se conservan allí porque TypeORM los necesita.
 *   Un miembro de enum string es asignable a su literal, de modo que las shapes
 *   producidas por el backend satisfacen estos contratos.
 * - Solo se comparten las shapes verificadas como estructuralmente idénticas en
 *   ambos lados. Las que divergen (p. ej. findings con `file: string | null` en
 *   frontend frente a `file?: string` en backend) permanecen en cada lado.
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

export interface ProjectAssignmentResponse {
  id: string;
  projectId: string;
  projectTitle: string;
  projectExpectedType: string | null;
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
