import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CODE_QUALITY_CATEGORIES,
  CodeQualityCategory,
  CodeQualityFinding,
} from '../../../domain/builder.types';
import { CodeQualityFindingEntity } from '../../../domain/entities/code-quality-finding.entity';

@Injectable()
export class BuilderQualityAggregationService {
  constructor(
    @InjectRepository(CodeQualityFindingEntity)
    private readonly codeQualityFindingsRepository: Repository<CodeQualityFindingEntity>,
  ) {}

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
