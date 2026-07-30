/**
 * @fileoverview Módulo de proyectos académicos y entregas (build-run.repository).
 *
 * @module build-run.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import {
  BuildRunListPage,
  BuildRunListQuery,
  BuildRunScalarSummary,
  BuildRunUsageDelta,
  IBuildRunRepository,
  StaleQueuedRunRef,
} from '../../domain/repositories/build-run.repository.interface';
import { applyBuildRunActorScope } from './build-run-actor-scope.util';

@Injectable()
export class BuildRunRepository implements IBuildRunRepository {
  constructor(
    @InjectRepository(BuildRun)
    private readonly repository: Repository<BuildRun>,
  ) {}

  findById(id: string): Promise<BuildRun | null> {
    return this.repository.findOne({ where: { id } });
  }

  save(run: BuildRun): Promise<BuildRun> {
    return this.repository.save(run);
  }

  async createQueuedRun(input: {
    deliveryId: string;
    triggeredById: string;
    promptVersion: string | null;
  }): Promise<BuildRun> {
    const run = this.repository.create({
      deliveryId: input.deliveryId,
      triggeredById: input.triggeredById,
      status: BuildRunStatus.QUEUED,
      promptVersion: input.promptVersion,
    });
    return this.repository.save(run);
  }

  async cancelIfActive(id: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder('run')
      .update()
      .set({
        status: BuildRunStatus.CANCELLED,
        finishedAt: () => 'NOW()',
        version: () => '"version" + 1',
      })
      .where('"id" = :id', { id })
      .andWhere('"status" IN (:...statuses)', {
        statuses: [BuildRunStatus.QUEUED, BuildRunStatus.RUNNING],
      })
      .execute();

    return Boolean(result.affected);
  }

  async failStaleRunning(staleThresholdDate: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('run')
      .update()
      .set({
        status: BuildRunStatus.FAILED,
        finishedAt: () => 'NOW()',
        failureReason:
          'RUN_STALE_AFTER_RESTART: la ejecucion quedo huerfana tras reinicio.',
        version: () => '"version" + 1',
      })
      .where('"status" = :status', { status: BuildRunStatus.RUNNING })
      .andWhere('"updatedAt" < :staleThresholdDate', {
        staleThresholdDate: staleThresholdDate.toISOString(),
      })
      .execute();

    return result.affected ?? 0;
  }

  async findStaleQueued(
    staleThresholdDate: Date,
    limit: number,
  ): Promise<StaleQueuedRunRef[]> {
    const rows = await this.repository
      .createQueryBuilder('run')
      .select(['run.id', 'run.deliveryId'])
      .where('run.status = :status', { status: BuildRunStatus.QUEUED })
      .andWhere('run.updatedAt < :staleThresholdDate', {
        staleThresholdDate: staleThresholdDate.toISOString(),
      })
      .orderBy('run.updatedAt', 'ASC')
      .limit(limit)
      .getMany();

    return rows.map((row) => ({ id: row.id, deliveryId: row.deliveryId }));
  }

  async failIfStillQueued(id: string, reason: string): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder('run')
      .update()
      .set({
        status: BuildRunStatus.FAILED,
        finishedAt: () => 'NOW()',
        failureReason: reason,
        version: () => '"version" + 1',
      })
      .where('"id" = :id', { id })
      .andWhere('"status" = :status', { status: BuildRunStatus.QUEUED })
      .execute();

    return Boolean(result.affected);
  }

  async sumExecutionCostUsdByProject(projectId: string): Promise<number> {
    const row = await this.repository
      .createQueryBuilder('run')
      .select('COALESCE(SUM(run."executionCostUsd"), 0)', 'total')
      .innerJoin('deliveries', 'delivery', 'delivery.id = run."deliveryId"')
      .innerJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery."assignmentId"',
      )
      .where('assignment."projectId" = :projectId', { projectId })
      .getRawOne<{ total: string }>();

    return Number(row?.total ?? 0);
  }

  findLatestOutcomeByProject(
    projectId: string,
  ): Promise<Array<{ deliveryId: string; overallOutcome: string | null }>> {
    return this.repository
      .createQueryBuilder('run')
      .select('run.deliveryId', 'deliveryId')
      .addSelect(`run.report ->> 'overallOutcome'`, 'overallOutcome')
      .distinctOn(['run.deliveryId'])
      .innerJoin('deliveries', 'delivery', 'delivery.id = run."deliveryId"')
      .innerJoin(
        'project_assignments',
        'assignment',
        'assignment.id = delivery."assignmentId"',
      )
      .where('assignment."projectId" = :projectId', { projectId })
      .andWhere('assignment."revokedAt" IS NULL')
      .orderBy('run.deliveryId')
      .addOrderBy('run.createdAt', 'DESC')
      .getRawMany<{ deliveryId: string; overallOutcome: string | null }>();
  }

  findScalarSummaryByDeliveryIds(
    deliveryIds: string[],
  ): Promise<BuildRunScalarSummary[]> {
    if (deliveryIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({
      select: {
        id: true,
        deliveryId: true,
        status: true,
        createdAt: true,
        finishedAt: true,
        inputTokens: true,
        outputTokens: true,
        executionCostUsd: true,
      },
      where: { deliveryId: In(deliveryIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async bumpLatestEventSequence(id: string, sequence: string): Promise<void> {
    // Un solo UPDATE con GREATEST en vez de leer-modificar-escribir: dos
    // eventos concurrentes del mismo run se pisaban la secuencia.
    await this.repository
      .createQueryBuilder()
      .update(BuildRun)
      .set({
        latestEventSequence: () =>
          'GREATEST(COALESCE("latestEventSequence", 0), :seq)',
      })
      .where('id = :id', { id })
      .setParameter('seq', sequence)
      .execute();
  }

  async incrementUsage(id: string, delta: BuildRunUsageDelta): Promise<void> {
    await this.repository.increment({ id }, 'inputTokens', delta.inputTokens);
    await this.repository.increment({ id }, 'outputTokens', delta.outputTokens);
    if (delta.executionCostUsd > 0) {
      await this.repository.increment(
        { id },
        'executionCostUsd',
        delta.executionCostUsd,
      );
    }
  }

  async failIfNotCancelled(id: string, reason: string): Promise<boolean> {
    // UPDATE condicionado al estado (no lectura-modificacion-escritura): si
    // cancelRun canceló este run de forma atómica mientras el pipeline
    // fallaba en paralelo, este WHERE ya evita pisar esa cancelación con
    // FAILED.
    const result = await this.repository
      .createQueryBuilder()
      .update(BuildRun)
      .set({
        status: BuildRunStatus.FAILED,
        finishedAt: () => 'NOW()',
        failureReason: reason,
        version: () => '"version" + 1',
      })
      .where('"id" = :id', { id })
      .andWhere('"status" != :cancelled', {
        cancelled: BuildRunStatus.CANCELLED,
      })
      .execute();

    return Boolean(result.affected);
  }

  async findPaginatedByDelivery(
    deliveryId: string,
    query: BuildRunListQuery,
  ): Promise<BuildRunListPage> {
    const { status, page, limit, sortOrder } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('run')
      .where('run.deliveryId = :deliveryId', { deliveryId });

    if (status) {
      queryBuilder.andWhere('run.status = :status', { status });
    }

    queryBuilder
      .orderBy('run.createdAt', sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  findLatestByDeliveryIdsForActor(
    deliveryIds: string[],
    actor: AuthenticatedUser,
  ): Promise<BuildRun[]> {
    if (deliveryIds.length === 0) {
      return Promise.resolve([]);
    }

    const queryBuilder = this.repository
      .createQueryBuilder('run')
      .distinctOn(['run.deliveryId'])
      .innerJoin('run.delivery', 'delivery')
      .where('run.deliveryId IN (:...deliveryIds)', { deliveryIds });

    applyBuildRunActorScope(queryBuilder, actor);

    queryBuilder
      .orderBy('run.deliveryId', 'ASC')
      .addOrderBy('run.createdAt', 'DESC');

    return queryBuilder.getMany();
  }
}
