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
import { BuilderRunEventsService } from '../../../infrastructure/events/builder-run-events.service';
import {
  BuilderRunEvent,
  EvidenceArtifactPublic,
} from '../../../domain/builder.types';
import { isStaffOnlyBuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { ListBuildRunsDto } from '../../../presentation/dto/list-build-runs.dto';
import { BuilderAccessService } from '../workspace/builder-access.service';
import type { PaginatedBuildRunsResponse } from '../builder-application.types';
import { BuilderQualityAggregationService } from '../evaluation/builder-quality-aggregation.service';

@Injectable()
export class BuilderRunQueriesService {
  constructor(
    @InjectRepository(BuildRun)
    private readonly buildRunsRepository: Repository<BuildRun>,
    private readonly builderAccessService: BuilderAccessService,
    private readonly builderRunEventsService: BuilderRunEventsService,
    private readonly evidenceService: EvidenceService,
    private readonly builderQualityAggregationService: BuilderQualityAggregationService,
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
    const sortOrder = query.sortOrder;

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

  /**
   * Ultimo BuildRun por entrega, en una unica consulta (DISTINCT ON), para
   * las entregas indicadas. Sustituye el fan-out N+1 que hacia el frontend
   * (una peticion GET por entrega) por una unica llamada batch (HIGH-09).
   *
   * El scoping de acceso se resuelve en la propia consulta SQL, no por
   * entrega vía `assertCanAccessDelivery` en un bucle (eso solo trasladaria
   * el N+1 al backend): STUDENT solo ve sus propias entregas, TEACHER solo
   * las de proyectos a los que esta asignado, ADMIN todas. Las entregas
   * fuera de alcance del actor simplemente no aparecen en el resultado (se
   * devuelven como `null`), sin filtrar cuales de los IDs solicitados eran
   * ajenos.
   */
  async listLatestRunsByDeliveryIds(
    deliveryIds: string[],
    actor: AuthenticatedUser,
  ): Promise<Record<string, BuildRun | null>> {
    const uniqueIds = Array.from(new Set(deliveryIds));
    const result: Record<string, BuildRun | null> = {};
    for (const id of uniqueIds) {
      result[id] = null;
    }
    if (uniqueIds.length === 0) {
      return result;
    }

    const queryBuilder = this.buildRunsRepository
      .createQueryBuilder('run')
      .distinctOn(['run.deliveryId'])
      .innerJoin('run.delivery', 'delivery')
      .where('run.deliveryId IN (:...uniqueIds)', { uniqueIds });

    if (actor.role === UserRole.STUDENT) {
      queryBuilder.andWhere('delivery.authorId = :userId', {
        userId: actor.userId,
      });
    } else if (actor.role === UserRole.TEACHER) {
      queryBuilder
        .innerJoin('delivery.assignment', 'assignment')
        .innerJoin('assignment.project', 'project')
        .innerJoin('project.teachers', 'scopedTeacher')
        .andWhere('scopedTeacher.id = :userId', { userId: actor.userId });
    }
    // ADMIN: sin filtro adicional, ve el batch completo.

    queryBuilder
      .orderBy('run.deliveryId', 'ASC')
      .addOrderBy('run.createdAt', 'DESC');

    const runs = await queryBuilder.getMany();
    for (const run of runs) {
      result[run.deliveryId] = run;
    }
    return result;
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

  /**
   * ARQ-005: delega en `BuilderQualityAggregationService`, que agrega con SQL
   * sobre `code_quality_findings` (la proyeccion consultable) en vez de cargar
   * en memoria todos los runs con findings y recorrer su jsonb con `as any`
   * sin cota. El jsonb (`run.codeQualityFindings`) sigue siendo la fuente
   * canonica del documento del run; esto es solo la vista agregada.
   */
  async getAssignmentQualityInsights(
    assignmentId: string,
    actor: AuthenticatedUser,
  ) {
    this.builderAccessService.assertIsStaff(actor);

    return this.builderQualityAggregationService.getInsightsForAssignment(
      assignmentId,
    );
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
