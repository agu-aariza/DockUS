/**
 * @fileoverview Vista y gestión de proyectos académicos (projectManagement.types).
 *
 * @module projectManagement.types
 */

type NoticeTone = "info" | "warning";

export interface NoticeState {
  text: string;
  tone: NoticeTone;
}
