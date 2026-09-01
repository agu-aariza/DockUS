/**
 * @fileoverview Servicio de aplicación para insights de calidad de proyectos.
 *
 * Contexto:
 * - Valida el acceso docente al proyecto.
 * - Delega la agregación de hallazgos al subdominio Builder.
 *
 * @module ProjectQualityInsightsService
 */

import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { CodeQualityCategory } from './builder/domain/builder.types';
import { BuilderQualityAggregationService } from './builder/application/services/evaluation/builder-quality-aggregation.service';
import { ProjectAccessService } from './project-access.service';
import type {
  ProjectQualityInsightsSummary,
  ProjectStudentQualityInsights,
} from './projects.types';

@Injectable()
export class ProjectQualityInsightsService {
  constructor(
    private readonly projectAccessService: ProjectAccessService,
    private readonly builderQualityAggregationService: BuilderQualityAggregationService,
  ) {}

  async getQualityInsights(
    projectId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectQualityInsightsSummary> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getAggregatedFindings(
      projectId,
    );
  }

  async getQualityInsightsByCategory(
    projectId: string,
    category: CodeQualityCategory,
    actor: AuthenticatedUser,
  ): Promise<ProjectQualityInsightsSummary> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getFindingsByCategory(
      projectId,
      category,
    );
  }

  async getQualityInsightsForStudent(
    projectId: string,
    studentId: string,
    actor: AuthenticatedUser,
  ): Promise<ProjectStudentQualityInsights> {
    await this.projectAccessService.findOwnedProjectOrThrow(projectId, actor);
    return this.builderQualityAggregationService.getFindingsForStudent(
      projectId,
      studentId,
    );
  }
}
