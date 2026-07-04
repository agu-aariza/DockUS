/**
 * @fileoverview Consultas de lectura para runs del builder.
 *
 * Contexto:
 * - Centraliza paginación, acceso a evidencias y lectura de runs.
 * - Mantiene separada la lectura de las operaciones que mutan el pipeline.
 *
 * @module BuilderRunQueriesService
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildPaginationMeta } from '../../../../../../shared/utils/pagination.util';
import type { AuthenticatedUser } from '../../../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../../../users/entities/user.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../../domain/events/builder-run-events.service';
import {
  BuilderRunEvent,
  EvidenceArtifactPublic,
} from '../../../domain/builder.types';
import { isStaffOnlyBuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { ListBuildRunsDto } from '../../../presentation/dto/list-build-runs.dto';
import { BuilderAccessService } from '../workspace/builder-access.service';
import type { PaginatedBuildRunsResponse } from '../builder-application.types';

@Injectable()
export class BuilderRunQueriesService {
  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunEventsService: BuilderRunEventsService,
    private readonly evidenceService: EvidenceService,
  ) {}

  async getRunById(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<BuildRun> {
    const run = await this.buildRunsRepository.findOne({
      where: { id: buildRunId },
    });
    if (!run) {
      throw new NotFoundException('BuildRun no encontrado.');
    }
    await this.builderAccessService.assertCanAccessBuildRun(run, actor);
    return run;
  }

  async listRunsByDelivery(
    deliveryId: string,
    query: ListBuildRunsDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedBuildRunsResponse> {
    const delivery =
      await this.builderAccessService.findDeliveryOrThrow(deliveryId);
    await this.builderAccessService.assertCanAccessDelivery(delivery, actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sortOrder ?? 'DESC';

    const queryBuilder = this.buildRunsRepository
      .createQueryBuilder('run')
      .where('run.deliveryId = :deliveryId', { deliveryId });

    if (query.status) {
      queryBuilder.andWhere('run.status = :status', { status: query.status });
    }

    queryBuilder
      .orderBy('run.createdAt', sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await queryBuilder.getManyAndCount();
    return {
      data: rows,
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async listRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    afterSequence = 0,
    limit = 100,
  ) {
    await this.getRunById(buildRunId, actor);
    return this.builderRunEventsService.list(buildRunId, afterSequence, limit);
  }

  async subscribeRunEvents(
    buildRunId: string,
    actor: AuthenticatedUser,
    listener: (event: BuilderRunEvent) => void,
  ): Promise<() => void> {
    await this.getRunById(buildRunId, actor);
    return this.builderRunEventsService.subscribe(buildRunId, listener);
  }

  async listEvidenceArtifacts(
    buildRunId: string,
    actor: AuthenticatedUser,
  ): Promise<EvidenceArtifactPublic[]> {
    await this.getRunById(buildRunId, actor);
    const artifacts = await this.evidenceService.listArtifacts(buildRunId);
    return this.filterArtifactsForActor(artifacts, actor);
  }

  async getEvidenceArtifactContent(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ content: Buffer; contentType: string }> {
    await this.getRunById(buildRunId, actor);
    const visibleArtifacts = this.filterArtifactsForActor(
      await this.evidenceService.listArtifacts(buildRunId),
      actor,
    );
    if (!visibleArtifacts.some((artifact) => artifact.id === artifactId)) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }
    return this.evidenceService.getArtifactContent(buildRunId, artifactId);
  }

  async createEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    await this.getRunById(buildRunId, actor);
    const visibleArtifacts = this.filterArtifactsForActor(
      await this.evidenceService.listArtifacts(buildRunId),
      actor,
    );
    if (!visibleArtifacts.some((artifact) => artifact.id === artifactId)) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }
    return this.evidenceService.createArtifactDownloadUrl(
      buildRunId,
      artifactId,
    );
  }

  async getAssignmentQualityInsights(
    assignmentId: string,
    actor: AuthenticatedUser,
  ) {
    this.builderAccessService.assertIsStaff(actor);

    const runs = await this.buildRunsRepository
      .createQueryBuilder('run')
      .innerJoin('run.delivery', 'delivery')
      .where('delivery.assignmentId = :assignmentId', { assignmentId })
      .andWhere('run.codeQualityFindings IS NOT NULL')
      .orderBy('run.createdAt', 'DESC')
      .getMany();

    // Filtramos para quedarnos con el último run de cada entrega (alumno)
    const latestRunsByDelivery = new Map<string, BuildRun>();
    for (const run of runs) {
      if (!latestRunsByDelivery.has(run.deliveryId)) {
        latestRunsByDelivery.set(run.deliveryId, run);
      }
    }

    const uniqueRuns = Array.from(latestRunsByDelivery.values());
    const counts = new Map<
      string,
      { title: string; count: number; category: string }
    >();

    for (const run of uniqueRuns) {
      const findings = run.codeQualityFindings as any;
      const categories = [
        'quality',
        'security',
        'architecture',
        'rubricCompliance',
      ];

      for (const cat of categories) {
        const items = findings[cat] || [];
        for (const item of items) {
          const key = `${cat}:${item.title}`;
          const existing = counts.get(key) || {
            title: item.title,
            count: 0,
            category: cat,
          };
          existing.count++;
          counts.set(key, existing);
        }
      }
    }

    return {
      totalDeliveriesAnalyzed: uniqueRuns.length,
      insights: Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10), // Top 10 patrones detectados
    };
  }

  private filterArtifactsForActor(
    artifacts: EvidenceArtifactPublic[],
    actor: AuthenticatedUser,
  ): EvidenceArtifactPublic[] {
    if (actor.role === UserRole.ADMIN || actor.role === UserRole.TEACHER) {
      return artifacts;
    }

    return artifacts.filter(
      (artifact) => !isStaffOnlyBuildRunArtifactType(artifact.type),
    );
  }
}
