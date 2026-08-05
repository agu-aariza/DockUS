/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-quality-aggregation.service).
 *
 * @module builder-quality-aggregation.service
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  CODE_QUALITY_CATEGORIES,
  CodeQualityCategory,
  CodeQualityFinding,
} from '../../../domain/builder.types';
import type { ICodeQualityFindingRepository } from '../../../domain/repositories/code-quality-finding.repository.interface';
import { CODE_QUALITY_FINDING_REPOSITORY } from '../../../domain/repositories/code-quality-finding.repository.interface';
import type { IProjectAssignmentRepository } from '../../../../domain/repositories/project-assignment.repository.interface';
import { PROJECT_ASSIGNMENT_REPOSITORY } from '../../../../domain/repositories/project-assignment.repository.interface';

@Injectable()
export class BuilderQualityAggregationService {
  constructor(
    @Inject(CODE_QUALITY_FINDING_REPOSITORY)
    private readonly codeQualityFindingsRepository: ICodeQualityFindingRepository,
    @Inject(PROJECT_ASSIGNMENT_REPOSITORY)
    private readonly assignmentsRepository: IProjectAssignmentRepository,
  ) {}

  /**
   * reemplaza al agregador en memoria de `getAssignmentQualityInsights`
   * (`run.codeQualityFindings` recorrido con `as any`, sin cota). `assignmentId`
   * identifica de forma unica un `(projectId, studentId)` — el indice unico de
   * `ProjectAssignment` no permite otra cosa — asi que esto son en realidad los
   * patrones de calidad de un unico alumno para este proyecto, tal y como
   * `code_quality_findings` los dejo tras el ultimo run (la tabla es una
   * proyeccion del run mas reciente, no un historial).
   */
  async getInsightsForAssignment(assignmentId: string): Promise<{
    totalDeliveriesAnalyzed: number;
    insights: Array<{
      title: string;
      count: number;
      category: CodeQualityCategory;
    }>;
  }> {
    const assignment = await this.assignmentsRepository.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    const rows =
      await this.codeQualityFindingsRepository.findTopFindingsForAssignment(
        assignment.projectId,
        assignment.studentId,
      );

    const totalDeliveriesAnalyzed =
      await this.codeQualityFindingsRepository.countDistinctBuildRunsForAssignment(
        assignment.projectId,
        assignment.studentId,
      );

    return {
      totalDeliveriesAnalyzed,
      insights: rows.map((row) => ({
        title: row.title,
        category: row.category as CodeQualityCategory,
        count: row.count,
      })),
    };
  }

  async getAggregatedFindings(projectId: string) {
    const totalStudentsAnalyzed = await this.countStudents(projectId);
    const rows =
      await this.codeQualityFindingsRepository.aggregateByProject(projectId);

    return {
      projectId,
      totalStudentsAnalyzed,
      insights: rows.map((row) => ({
        title: row.title,
        category: row.category as CodeQualityCategory,
        severity: row.severity as CodeQualityFinding['severity'],
        studentCount: row.studentCount,
      })),
    };
  }

  async getFindingsByCategory(
    projectId: string,
    category: CodeQualityCategory,
  ) {
    const totalStudentsAnalyzed = await this.countStudents(projectId);
    const rows =
      await this.codeQualityFindingsRepository.aggregateByProjectAndCategory(
        projectId,
        category,
      );

    return {
      projectId,
      category,
      totalStudentsAnalyzed,
      insights: rows.map((row) => ({
        title: row.title,
        category: row.category as CodeQualityCategory,
        severity: row.severity as CodeQualityFinding['severity'],
        studentCount: row.studentCount,
      })),
    };
  }

  async getFindingsForStudent(projectId: string, studentId: string) {
    const rows =
      await this.codeQualityFindingsRepository.findByProjectAndStudent(
        projectId,
        studentId,
      );

    const findings = this.createEmptyCategoryMap();
    for (const row of rows) {
      findings[row.category as CodeQualityCategory].push({
        title: row.title,
        detail: row.detail,
        severity: row.severity as CodeQualityFinding['severity'],
        ...(row.file ? { file: row.file } : {}),
        ...(row.line !== null ? { line: row.line } : {}),
        codeSnippet: row.codeSnippet ?? '',
        level: (row.level ?? 'basico') as CodeQualityFinding['level'],
        conceptExplanation: row.conceptExplanation ?? '',
      });
    }

    return {
      projectId,
      studentId,
      findings,
    };
  }

  private countStudents(projectId: string): Promise<number> {
    return this.codeQualityFindingsRepository.countDistinctStudentsForProject(
      projectId,
    );
  }

  private createEmptyCategoryMap(): Record<
    CodeQualityCategory,
    CodeQualityFinding[]
  > {
    return {
      [CODE_QUALITY_CATEGORIES[0]]: [],
      [CODE_QUALITY_CATEGORIES[1]]: [],
      [CODE_QUALITY_CATEGORIES[2]]: [],
      [CODE_QUALITY_CATEGORIES[3]]: [],
    };
  }
}
