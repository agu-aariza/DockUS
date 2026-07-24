import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CODE_QUALITY_CATEGORIES,
  CodeQualityCategory,
  CodeQualityFinding,
} from '../../../domain/builder.types';
import { CodeQualityFindingEntity } from '../../../domain/entities/code-quality-finding.entity';
import { ProjectAssignment } from '../../../../assignments/entities/project-assignment.entity';

@Injectable()
export class BuilderQualityAggregationService {
  constructor(
    @InjectRepository(CodeQualityFindingEntity)
    private readonly codeQualityFindingsRepository: Repository<CodeQualityFindingEntity>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentsRepository: Repository<ProjectAssignment>,
  ) {}

  /**
   * ARQ-005: reemplaza al agregador en memoria de `getAssignmentQualityInsights`
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
    const assignment = await this.assignmentsRepository.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('Asignación no encontrada.');
    }

    const rows = await this.codeQualityFindingsRepository
      .createQueryBuilder('finding')
      .select('finding.title', 'title')
      .addSelect('finding.category', 'category')
      .addSelect('COUNT(*)::int', 'count')
      .where('finding.projectId = :projectId', {
        projectId: assignment.projectId,
      })
      .andWhere('finding.studentId = :studentId', {
        studentId: assignment.studentId,
      })
      .groupBy('finding.title')
      .addGroupBy('finding.category')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('finding.title', 'ASC')
      .limit(10)
      .getRawMany<{ title: string; category: string; count: number }>();

    const countRow = await this.codeQualityFindingsRepository
      .createQueryBuilder('finding')
      .select('COUNT(DISTINCT finding.buildRunId)::int', 'count')
      .where('finding.projectId = :projectId', {
        projectId: assignment.projectId,
      })
      .andWhere('finding.studentId = :studentId', {
        studentId: assignment.studentId,
      })
      .getRawOne<{ count: number }>();

    return {
      totalDeliveriesAnalyzed: countRow?.count ?? 0,
      insights: rows.map((row) => ({
        title: row.title,
        category: row.category as CodeQualityCategory,
        count: Number(row.count),
      })),
    };
  }

  async getAggregatedFindings(projectId: string) {
    const totalStudentsAnalyzed = await this.countStudents(projectId);
    const rows = await this.codeQualityFindingsRepository.query(
      `
        SELECT
          title,
          category,
          severity,
          COUNT(*)::int AS "studentCount"
        FROM code_quality_findings
        WHERE project_id = $1
        GROUP BY title, category, severity
        ORDER BY COUNT(*) DESC, title ASC
      `,
      [projectId],
    );

    return {
      projectId,
      totalStudentsAnalyzed,
      insights: rows.map((row: Record<string, unknown>) => ({
        title: String(row.title),
        category: row.category as CodeQualityCategory,
        severity: String(row.severity) as CodeQualityFinding['severity'],
        studentCount: Number(row.studentCount),
      })),
    };
  }

  async getFindingsByCategory(
    projectId: string,
    category: CodeQualityCategory,
  ) {
    const totalStudentsAnalyzed = await this.countStudents(projectId);
    const rows = await this.codeQualityFindingsRepository.query(
      `
        SELECT
          title,
          category,
          severity,
          COUNT(*)::int AS "studentCount"
        FROM code_quality_findings
        WHERE project_id = $1
          AND category = $2
        GROUP BY title, category, severity
        ORDER BY COUNT(*) DESC, title ASC
      `,
      [projectId, category],
    );

    return {
      projectId,
      category,
      totalStudentsAnalyzed,
      insights: rows.map((row: Record<string, unknown>) => ({
        title: String(row.title),
        category: row.category as CodeQualityCategory,
        severity: String(row.severity) as CodeQualityFinding['severity'],
        studentCount: Number(row.studentCount),
      })),
    };
  }

  async getFindingsForStudent(projectId: string, studentId: string) {
    const rows = await this.codeQualityFindingsRepository.find({
      where: { projectId, studentId },
      order: { createdAt: 'ASC' },
    });

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

  private async countStudents(projectId: string): Promise<number> {
    const rows = await this.codeQualityFindingsRepository.query(
      `
        SELECT COUNT(DISTINCT student_id)::int AS count
        FROM code_quality_findings
        WHERE project_id = $1
      `,
      [projectId],
    );

    return Number(rows[0]?.count ?? 0);
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
