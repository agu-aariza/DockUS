import { DeliveryStatus } from './deliveries/entities/delivery.entity';
import type { BuilderOutcome } from './dto/project-progress-query.dto';
import type {
  ReconcileOperationalIssueCategory,
  ReconcileOperationalIssueMode,
} from './dto/reconcile-operational-issues.dto';

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

export interface PaginatedProjectsResponse {
  data: import('./entities/project.entity').Project[];
  meta: import('../../shared/utils/pagination.util').PaginationMeta;
}

export interface ProjectOperationalIssue {
  id: string;
  category: 'assignment' | 'delivery' | 'storage';
  severity: 'warning' | 'error';
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

export interface ProjectOperationalIssuesReconcileResult {
  mode: ReconcileOperationalIssueMode;
  requestedCategories: ReconcileOperationalIssueCategory[];
  matched: Record<ReconcileOperationalIssueCategory, number>;
  applied: Record<ReconcileOperationalIssueCategory, number>;
  actions: Array<{
    category: ReconcileOperationalIssueCategory;
    targetId: string;
    action: string;
    outcome: 'would_apply' | 'applied' | 'failed';
    detail: string;
  }>;
}
