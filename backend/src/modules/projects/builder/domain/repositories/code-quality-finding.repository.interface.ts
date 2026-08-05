/**
 * @fileoverview Puerto de persistencia de `CodeQualityFindingEntity`
 * (code-quality-finding.repository.interface).
 *
 * @module code-quality-finding.repository.interface
 */

import { CodeQualityFindingEntity } from '../entities/code-quality-finding.entity';

/**
 * Puerto real: sin puerto
 * previo, único consumidor real cada uno de sus dos sitios
 * (`BuilderArtifactPersister`/`BuilderQualityAggregationService`). Mismo
 * criterio que: sin tipos de TypeORM en la firma. Las 3 consultas que
 * en el código real usaban SQL crudo (`.query`, no `createQueryBuilder`)
 * conservan SQL crudo dentro del adaptador — mover el mecanismo de consulta
 * sería rediseño, no migración.
 */
export const CODE_QUALITY_FINDING_REPOSITORY = Symbol(
  'ICodeQualityFindingRepository',
);

/** Campos aceptados por `Repository.save()` de una fila nueva — sin `id`/`createdAt`. */
export interface NewCodeQualityFindingData {
  buildRunId: string;
  projectId: string;
  studentId: string;
  category: string;
  title: string;
  detail: string;
  severity: string;
  file: string | null;
  line: number | null;
  codeSnippet: string;
  level: string;
  conceptExplanation: string;
}

export interface CodeQualityAggregatedRow {
  title: string;
  category: string;
  severity: string;
  studentCount: number;
}

export interface CodeQualityTopFindingRow {
  title: string;
  category: string;
  count: number;
}

export interface ICodeQualityFindingRepository {
  /** Reemplaza (delete + insert) las filas de un `(projectId, studentId)` tras un run nuevo. */
  deleteByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<void>;
  saveMany(rows: NewCodeQualityFindingData[]): Promise<void>;

  /** Top 10 hallazgos de una asignación (`projectId`+`studentId`), agregados por título/categoría. */
  findTopFindingsForAssignment(
    projectId: string,
    studentId: string,
  ): Promise<CodeQualityTopFindingRow[]>;

  /** Nº de runs distintos que aportaron hallazgos a esa asignación. */
  countDistinctBuildRunsForAssignment(
    projectId: string,
    studentId: string,
  ): Promise<number>;

  /** Agregación de un proyecto completo, por título/categoría/severidad. */
  aggregateByProject(projectId: string): Promise<CodeQualityAggregatedRow[]>;

  /** Igual que `aggregateByProject`, filtrado a una categoría. */
  aggregateByProjectAndCategory(
    projectId: string,
    category: string,
  ): Promise<CodeQualityAggregatedRow[]>;

  /** Nº de alumnos distintos con hallazgos en el proyecto. */
  countDistinctStudentsForProject(projectId: string): Promise<number>;

  /** Hallazgos de un alumno concreto en un proyecto, por antigüedad ascendente. */
  findByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<CodeQualityFindingEntity[]>;
}
