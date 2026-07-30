import { ConflictException } from '@nestjs/common';
import { Queue } from 'bullmq';

import { BuilderRunCommandsService } from './builder-run-commands.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { BuilderRunCancellationService } from './builder-run-cancellation.service';
import type { IBuildRunRepository } from '../../../domain/repositories/build-run.repository.interface';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import { DeliveryStatus } from '../../../../deliveries/entities/delivery.entity';

describe('BuilderRunCommandsService', () => {
  let service: BuilderRunCommandsService;

  const runId = 'run-123';
  const deliveryId = 'delivery-123';

  const buildRunRepository = {
    findById: jest.fn(),
    createQueuedRun: jest.fn((input) => Promise.resolve(input as BuildRun)),
    save: jest.fn((run) => Promise.resolve({ ...run, id: runId } as BuildRun)),
    cancelIfActive: jest.fn(),
  };

  const builderRunsQueue = {
    add: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  } as unknown as Queue;

  const builderAccessService = {
    findDeliveryOrThrow: jest.fn(),
    assertCanManageBuildRun: jest.fn().mockResolvedValue(undefined),
    assertCanTriggerDelivery: jest.fn().mockResolvedValue(undefined),
  };

  const builderRunQueriesService = {
    getRunById: jest.fn(),
  } as unknown as BuilderRunQueriesService;

  const builderRunSupportService = {
    markRunAsFailed: jest.fn().mockResolvedValue(undefined),
    toErrorMessage: jest.fn((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    ),
    emitEvent: jest.fn().mockResolvedValue(undefined),
  };

  const builderRunCancellationService = {
    markCancelled: jest.fn().mockResolvedValue(undefined),
  };

  const deliveryStatusService = {
    updateStatusInternal: jest.fn().mockResolvedValue(undefined),
  };

  const buildRun = (): BuildRun =>
    ({
      id: runId,
      deliveryId,
      status: BuildRunStatus.QUEUED,
    }) as BuildRun;

  beforeEach(() => {
    jest.clearAllMocks();
    buildRunRepository.cancelIfActive.mockResolvedValue(true);
    buildRunRepository.findById.mockResolvedValue(buildRun());
    buildRunRepository.createQueuedRun.mockResolvedValue(buildRun());

    service = new BuilderRunCommandsService(
      buildRunRepository as unknown as IBuildRunRepository,
      builderRunsQueue,
      builderAccessService as unknown as BuilderAccessService,
      builderRunQueriesService,
      builderRunSupportService as unknown as BuilderRunSupportService,
      {
        planMaxInputChars: 15000,
        factsMaxInputChars: 18000,
        evalMaxInputChars: 15000,
        maxExtractedFiles: 1500,
        maxExtractedBytes: 104857600,
        staleRunThresholdMs: 600000,
        promptVersion: '2026.07-chain-of-verification',
      } as BuilderConfigProvider,
      builderRunCancellationService as unknown as BuilderRunCancellationService,
      // ESC-MED-03: sin cuota configurada el encolado pasa siempre; la cuota
      // tiene su propia suite.
      { assertProjectWithinQuota: jest.fn() } as never,
      deliveryStatusService as never,
    );
  });

  /** ESC-BAJO-02: la cola era FIFO estricta y no distinguía quién esperaba. */
  describe('prioridad en la cola', () => {
    beforeEach(() => {
      (builderAccessService.findDeliveryOrThrow as jest.Mock).mockResolvedValue(
        {
          id: 'delivery-1',
          assignment: { projectId: 'project-1' },
        },
      );
      buildRunRepository.createQueuedRun.mockResolvedValue(buildRun());
    });

    it.each([
      ['TEACHER', 1],
      ['ADMIN', 1],
      ['STUDENT', 2],
    ])('encola con prioridad %s -> %s', async (role, expected) => {
      await service.enqueueDeliveryRun('delivery-1', {
        userId: 'u1',
        role,
      } as never);

      expect(builderRunsQueue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ priority: expected }),
      );
    });
  });

  describe('enqueueDeliveryRun', () => {
    it('ARQ-001: autoriza al alumno via assertCanTriggerDelivery, no assertCanManageDelivery', async () => {
      (builderAccessService.findDeliveryOrThrow as jest.Mock).mockResolvedValue(
        {
          id: 'delivery-1',
          assignment: { projectId: 'project-1' },
        },
      );
      buildRunRepository.createQueuedRun.mockResolvedValue(buildRun());

      await service.enqueueDeliveryRun('delivery-1', {
        userId: 'student-1',
        role: 'STUDENT',
      } as never);

      expect(builderAccessService.assertCanTriggerDelivery).toHaveBeenCalled();
    });
  });

  describe('cancelRun', () => {
    const actor = { userId: 'teacher-1', role: 'TEACHER' } as any;

    it('HIGH-06: cancela mediante un UPDATE atomico condicionado a QUEUED/RUNNING, no lectura-modificacion-escritura', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });

      const result = await service.cancelRun(runId, actor);

      expect(result).toEqual({
        buildRunId: runId,
        status: BuildRunStatus.CANCELLED,
      });
      expect(buildRunRepository.save).not.toHaveBeenCalled();
      expect(buildRunRepository.cancelIfActive).toHaveBeenCalledWith(runId);
    });

    it('HIGH-06: lanza ConflictException si el run finalizo entre la lectura y el UPDATE (0 filas afectadas)', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });
      buildRunRepository.cancelIfActive.mockResolvedValue(false);

      await expect(service.cancelRun(runId, actor)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rechaza cancelar un run que ya finalizo (chequeo previo en memoria)', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.SUCCESS,
      });

      await expect(service.cancelRun(runId, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(buildRunRepository.cancelIfActive).not.toHaveBeenCalled();
    });

    it('ARQ-004: publica la cancelacion en Redis para que el pipeline en curso deje de facturar', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });

      await service.cancelRun(runId, actor);

      expect(builderRunCancellationService.markCancelled).toHaveBeenCalledWith(
        runId,
      );
    });

    it('ARQ-004: retira de la cola un job QUEUED que aun no tomo ningun worker', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.QUEUED,
      });

      await service.cancelRun(runId, actor);

      expect(builderRunsQueue.remove).toHaveBeenCalledWith(runId);
    });

    it('ARQ-004: no intenta retirar de la cola un job que ya esta RUNNING', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });

      await service.cancelRun(runId, actor);

      expect(builderRunsQueue.remove).not.toHaveBeenCalled();
    });

    it('ORC-004: saca la entrega de IN_REVIEW y publica RUN_CANCELLED tras cancelar', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });

      await service.cancelRun(runId, actor);

      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.EVALUATED,
      );
      expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          buildRunId: runId,
          eventType: 'RUN_CANCELLED',
          runStatus: BuildRunStatus.CANCELLED,
        }),
      );
    });

    it('ORC-004: no reconcilia Delivery ni publica evento si el UPDATE de cancelacion afecto 0 filas', async () => {
      (builderRunQueriesService.getRunById as jest.Mock).mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });
      buildRunRepository.cancelIfActive.mockResolvedValue(false);

      await expect(service.cancelRun(runId, actor)).rejects.toThrow(
        ConflictException,
      );

      expect(deliveryStatusService.updateStatusInternal).not.toHaveBeenCalled();
      expect(builderRunSupportService.emitEvent).not.toHaveBeenCalled();
    });
  });
});
