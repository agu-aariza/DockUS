import type {
  CodeQualityCategory,
  CodeQualityFinding,
} from './builder/domain/builder.types';

/**
 * Shapes compartidas con el frontend. La fuente única de verdad vive en
 * `@dockus/contracts`; aquí solo se re-exportan para que los consumidores del
 * backend mantengan sus imports desde `projects.types`.
 */
export type {
  ProjectProgressSummary,
  ProjectGradebookRow,
  StudentProfileResponse,
  StudentProfileProject,
  StudentProfileDelivery,
  StudentProfileRun,
  StudentProfileSummary,
  TeacherRef,
  ProjectOperationalIssue,
  ProjectOperationalIssuesSummary,
  ProjectOperationalIssuesReconcileResult,
  ProjectQualityInsight,
  ProjectQualityInsightsSummary,
} from '@dockus/contracts';

// ---------------------------------------------------------------------------
// Shapes exclusivas del backend (no se comparten con el frontend)
// ---------------------------------------------------------------------------

export interface PaginatedProjectsResponse {
  data: import('./entities/project.entity').Project[];
  meta: import('../../shared/utils/pagination.util').PaginationMeta;
}

/**
 * No se comparte con el frontend: el finding del backend (`file?: string`,
 * `level` en español) difiere del `TechnicalFeedbackItem` del frontend
 * (`file: string | null`). Reconciliarlos alteraría la serialización.
 */
export interface ProjectStudentQualityInsights {
  projectId: string;
  studentId: string;
  findings: Record<CodeQualityCategory, CodeQualityFinding[]>;
}
