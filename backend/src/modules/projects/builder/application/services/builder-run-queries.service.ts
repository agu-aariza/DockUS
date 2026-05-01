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
import { buildPaginationMeta } from '../../../../../shared/utils/pagination.util';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { BuildRun } from '../../domain/entities/build-run.entity';
import { BuilderRunEventsService } from '../../domain/events/builder-run-events.service';
import {
  BuilderRunEvent,
  EvidenceArtifactPublic,
} from '../../domain/builder.types';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { ListBuildRunsDto } from '../../presentation/dto/list-build-runs.dto';
import { BuilderAccessService } from './builder-access.service';
import type { PaginatedBuildRunsResponse } from './builder-application.types';

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
    return this.evidenceService.listArtifacts(buildRunId);
  }

  async createEvidenceDownloadUrl(
    buildRunId: string,
    artifactId: string,
    actor: AuthenticatedUser,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    await this.getRunById(buildRunId, actor);
    return this.evidenceService.createArtifactDownloadUrl(
      buildRunId,
      artifactId,
    );
  }
}
