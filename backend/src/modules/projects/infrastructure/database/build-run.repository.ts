/**
 * @fileoverview Módulo de proyectos académicos y entregas (build-run.repository).
 *
 * @module build-run.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BuildRun,
  BuildRunStatus,
} from '../../builder/domain/entities/build-run.entity';
import {
  IBuildRunRepository,
  StaleQueuedRunRef,
} from '../../domain/repositories/build-run.repository.interface';

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
}
