export type DeliveryStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "EVALUATED";

export type StudentWorkflowState =
  | "NOT_ASSIGNED"
  | "WINDOW_NOT_OPEN"
  | "READY_TO_SUBMIT"
  | "RECEIVED"
  | "QUEUED"
  | "RUNNING"
  | "BUILD_FAILED"
  | "REPORT_READY"
  | "AWAITING_TEACHER_REVIEW"
  | "GRADED";

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
