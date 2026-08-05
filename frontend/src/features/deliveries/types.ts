/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (types).
 *
 * @module types
 */

/**
 * Shapes compartidas con el backend: fuente única en `@educodeai/contracts`.
 * `DeliveryEntity` es el nombre local del `DeliveryResponse` del contrato.
 */
export type {
  DeliveryStatus,
  DeliveryResponse as DeliveryEntity,
} from "@educodeai/contracts";

// ---------------------------------------------------------------------------
// Shapes exclusivas del frontend
// ---------------------------------------------------------------------------

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
