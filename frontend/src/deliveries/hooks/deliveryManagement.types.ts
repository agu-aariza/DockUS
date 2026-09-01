import type { DeliveryStatus } from "../../features/deliveries/types";

export type DetailTab = "overview" | "grading" | "report";

export type NoticeTone = "info" | "warning";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
}

export interface CreateDeliveryForm {
  assignmentId: string;
  status: DeliveryStatus;
  notes: string;
}

export interface UpdateDeliveryForm {
  id: string;
  status: string;
  notes: string;
}

export interface StatusDeliveryForm {
  id: string;
  status: DeliveryStatus;
}

export interface GradingForm {
  id: string;
  grade: string;
  graderNotes: string;
}
