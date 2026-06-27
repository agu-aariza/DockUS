import { UserEntity } from "../auth/types";
import {
  QualityInsightCategory,
  TechnicalFeedbackSeverity,
  TechnicalFeedbackItem,
  BuilderOutcome,
} from "../builder/types";
import { DeliveryStatus } from "../deliveries/types";

export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface ProjectEntity {
  id: string;
  title: string;
  contextAcademico: string | null;
  maxDeliveriesPerStudent: number;
  expectedType: string | null;
  expectedOutput: string | null;
  rubricInstructions: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  status: ProjectStatus;
  creatorId: string;
  teachers?: UserEntity[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface ProjectQualityInsight {
  title: string;
  category: QualityInsightCategory;
  severity: TechnicalFeedbackSeverity;
  studentCount: number;
}

export interface ProjectQualityInsightsResponse {
  projectId: string;
  totalStudentsAnalyzed: number;
  insights: ProjectQualityInsight[];
  category?: QualityInsightCategory;
}

export interface ProjectStudentQualityInsightsResponse {
  projectId: string;
  studentId: string;
  findings: Record<QualityInsightCategory, TechnicalFeedbackItem[]>;
}

export interface ProjectAssignmentEntity {
  id: string;
  projectId: string;
  projectTitle: string;
  projectExpectedType: string | null;
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
  rubricInstructions: string | null;
  courseGroupId: string | null;
  sourceGroupIds: string[];
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
    category: "orphanAssignments" | "orphanDeliveries" | "orphanStorageObjects";
    targetId: string;
    action: string;
    outcome: "would_apply" | "applied" | "failed";
    detail: string;
  }>;
}
