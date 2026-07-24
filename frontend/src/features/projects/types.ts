/**
 * @fileoverview Vista y gestión de proyectos académicos (types).
 *
 * @module types
 */

import { UserEntity } from "../auth/types";
import {
  QualityInsightCategory,
  TechnicalFeedbackItem,
} from "../builder/types";

/**
 * Shapes compartidas con el backend. La fuente única de verdad vive en
 * `@dockus/contracts`; aquí se re-exportan (con alias donde el nombre local
 * difiere) para no romper los imports existentes del frontend.
 */
export type {
  ProjectProgressSummary,
  ProjectGradebookRow,
  ProjectOperationalIssue,
  ProjectOperationalIssuesSummary,
  ProjectOperationalIssuesReconcileResult,
  ProjectQualityInsight,
  ProjectQualityInsightsSummary as ProjectQualityInsightsResponse,
  ProjectAssignmentResponse as ProjectAssignmentEntity,
  BulkAssignResponse,
} from "@dockus/contracts";

// ---------------------------------------------------------------------------
// Shapes exclusivas del frontend
// ---------------------------------------------------------------------------

export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

/** Criterio ponderado de una rúbrica. El peso es un porcentaje (0-100). */
export interface RubricCriterion {
  name: string;
  weight: number;
  description: string | null;
}

export interface ProjectEntity {
  id: string;
  title: string;
  contextAcademico: string | null;
  maxDeliveriesPerStudent: number;
  expectedType: string | null;
  expectedOutput: string | null;
  rubricInstructions: string | null;
  rubricCriteria: RubricCriterion[] | null;
  opensAt?: string | null;
  closesAt?: string | null;
  status: ProjectStatus;
  creatorId: string;
  teachers?: UserEntity[];
  /** Solo la devuelve `GET /projects` (listado); ausente en otras rutas de proyecto. */
  assignmentCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * No se comparte con el backend: usa `TechnicalFeedbackItem`, cuyo shape
 * (`file: string | null`) difiere del `CodeQualityFinding` del backend.
 */
export interface ProjectStudentQualityInsightsResponse {
  projectId: string;
  studentId: string;
  findings: Record<QualityInsightCategory, TechnicalFeedbackItem[]>;
}

