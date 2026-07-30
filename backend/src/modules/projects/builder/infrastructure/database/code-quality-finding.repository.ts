/**
 * @fileoverview Adaptador TypeORM de `ICodeQualityFindingRepository`
 * (code-quality-finding.repository).
 *
 * @module code-quality-finding.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CodeQualityFindingEntity } from '../../domain/entities/code-quality-finding.entity';
import {
  CodeQualityAggregatedRow,
  CodeQualityTopFindingRow,
  ICodeQualityFindingRepository,
  NewCodeQualityFindingData,
} from '../../domain/repositories/code-quality-finding.repository.interface';

@Injectable()
export class CodeQualityFindingRepository implements ICodeQualityFindingRepository {
  constructor(
    @InjectRepository(CodeQualityFindingEntity)
    private readonly repository: Repository<CodeQualityFindingEntity>,
  ) {}

  async deleteByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<void> {
    await this.repository.delete({ projectId, studentId });
  }

  async saveMany(rows: NewCodeQualityFindingData[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.repository.save(rows);
  }

  async findTopFindingsForAssignment(
    projectId: string,
    studentId: string,
  ): Promise<CodeQualityTopFindingRow[]> {
    const rows = await this.repository
      .createQueryBuilder('finding')
      .select('finding.title', 'title')
      .addSelect('finding.category', 'category')
      .addSelect('COUNT(*)::int', 'count')
      .where('finding.projectId = :projectId', { projectId })
      .andWhere('finding.studentId = :studentId', { studentId })
      .groupBy('finding.title')
      .addGroupBy('finding.category')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('finding.title', 'ASC')
      .limit(10)
      .getRawMany<{ title: string; category: string; count: number }>();

    return rows.map((row) => ({
      title: row.title,
      category: row.category,
      count: Number(row.count),
    }));
  }

  async countDistinctBuildRunsForAssignment(
    projectId: string,
    studentId: string,
  ): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('finding')
      .select('COUNT(DISTINCT finding.buildRunId)::int', 'count')
      .where('finding.projectId = :projectId', { projectId })
      .andWhere('finding.studentId = :studentId', { studentId })
      .getRawOne<{ count: number }>();

    return row?.count ?? 0;
  }

  async aggregateByProject(
    projectId: string,
  ): Promise<CodeQualityAggregatedRow[]> {
    const rows = await this.repository.query<Array<Record<string, unknown>>>(
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

    return this.mapAggregatedRows(rows);
  }

  async aggregateByProjectAndCategory(
    projectId: string,
    category: string,
  ): Promise<CodeQualityAggregatedRow[]> {
    const rows = await this.repository.query<Array<Record<string, unknown>>>(
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

    return this.mapAggregatedRows(rows);
  }

  async countDistinctStudentsForProject(projectId: string): Promise<number> {
    const rows = await this.repository.query<Array<{ count: number }>>(
      `
        SELECT COUNT(DISTINCT student_id)::int AS count
        FROM code_quality_findings
        WHERE project_id = $1
      `,
      [projectId],
    );

    return Number(rows[0]?.count ?? 0);
  }

  findByProjectAndStudent(
    projectId: string,
    studentId: string,
  ): Promise<CodeQualityFindingEntity[]> {
    return this.repository.find({
      where: { projectId, studentId },
      order: { createdAt: 'ASC' },
    });
  }

  private mapAggregatedRows(
    rows: Array<Record<string, unknown>>,
  ): CodeQualityAggregatedRow[] {
    return rows.map((row) => ({
      title: String(row.title),
      category: String(row.category),
      severity: String(row.severity),
      studentCount: Number(row.studentCount),
    }));
  }
}
