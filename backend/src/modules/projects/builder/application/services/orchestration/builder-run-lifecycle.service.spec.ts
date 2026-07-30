import { rm } from 'fs/promises';
import { Logger } from '@nestjs/common';

import { BuilderRunLifecycleService } from './builder-run-lifecycle.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { DeliveryStatusService } from '../../../../deliveries/delivery-status.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunMetricsService } from './builder-run-metrics.service';
import { BuilderRunCostService } from '../ai/builder-run-cost.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { RunCancelledError } from './run-cancelled.error';
import {
  BuildRun,
  BuildRunStatus,
} from '../../../domain/entities/build-run.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../../../../deliveries/entities/delivery.entity';
import { Project } from '../../../../entities/project.entity';
import { ProjectAssignment } from '../../../../assignments/entities/project-assignment.entity';

jest.mock('fs/promises', () => ({
  rm: jest.fn().mockResolvedValue(undefined),
}));

describe('BuilderRunLifecycleService', () => {
  let service: BuilderRunLifecycleService;

  const runId = 'run-123';
  const deliveryId = 'delivery-123';

  const buildRunRepository = {
    findById: jest.fn(),
    claimQueuedRun: jest.fn(),
    completeRunningRun: jest.fn(),
  };

  const builderAccessService = {
    findDeliveryOrThrow: jest.fn(),
  };

  const deliveryStatusService = {
    updateStatusInternal: jest.fn().mockResolvedValue(undefined),
  };

  const builderRunSupportService = {
    markRunAsFailed: jest.fn().mockResolvedValue(undefined),
    toErrorMessage: jest.fn((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    ),
    emitEvent: jest.fn().mockResolvedValue(undefined),
  };

  const builderPipelineOrchestrator = {
    runPipeline: jest.fn(),
  };

  const builderRunMetricsService = {
    logRunMetrics: jest.fn(),
  };

  const builderRunCostService = {
    summarize: jest.fn(async () => ({
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.0042,
    })),
  };

  const buildProject = (): Project =>
    ({
      id: 'project-123',
      expectedType: 'PYTHON_FASTAPI',
      rubricInstructions: null,
      expectedOutput: null,
    }) as Project;

  const buildAssignment = (): ProjectAssignment =>
    ({
      id: 'assignment-123',
      project: buildProject(),
    }) as ProjectAssignment;

  const buildDelivery = (): Delivery =>
    ({
      id: deliveryId,
      assignment: buildAssignment(),
      status: DeliveryStatus.SUBMITTED,
    }) as Delivery;

  const buildRun = (): BuildRun =>
    ({
      id: runId,
      deliveryId,
      status: BuildRunStatus.QUEUED,
    }) as BuildRun;

  const buildPipelineResult = (
    overrides: Partial<{
      workspaceRoot: string;
      planAssessment: any;
      assessment: any;
      qualityFindings: any;
      report: any;
    }> = {},
  ) => ({
    planAssessment: { thought: 'plan ok' },
    assessment: { thought: 'eval ok', gradeBreakdown: [] },
    qualityFindings: [],
    report: { summary: 'ok' },
    executionLogs: '',
    warnings: [],
    llmUsages: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    buildRunRepository.findById.mockResolvedValue(buildRun());
    buildRunRepository.claimQueuedRun.mockResolvedValue(true);
    buildRunRepository.completeRunningRun.mockResolvedValue(true);
    builderAccessService.findDeliveryOrThrow.mockResolvedValue(buildDelivery());

    service = new BuilderRunLifecycleService(
      buildRunRepository as never,
      builderAccessService as unknown as BuilderAccessService,
      deliveryStatusService as unknown as DeliveryStatusService,
      builderRunSupportService as unknown as BuilderRunSupportService,
      builderPipelineOrchestrator as unknown as BuilderPipelineOrchestrator,
      builderRunMetricsService as unknown as BuilderRunMetricsService,
      builderRunCostService as unknown as BuilderRunCostService,
      {
        promptVersion: '2026.07-chain-of-verification',
      } as BuilderConfigProvider,
    );
  });

  describe('processBuildRunJob', () => {
    it('marca el run como fallido y saca la entrega de revision cuando el pipeline falla', async () => {
      builderPipelineOrchestrator.runPipeline.mockRejectedValue(
        new Error('Pipeline fallido'),
      );

      await expect(
        service.processBuildRunJob({ buildRunId: runId, deliveryId }),
      ).rejects.toThrow('Pipeline fallido');

      expect(builderRunSupportService.markRunAsFailed).toHaveBeenCalledWith(
        runId,
        'Pipeline fallido',
      );
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.EVALUATED,
      );
    });

    it('ARQ-004: una cancelacion cooperativa no marca el run como fallido ni actualiza la entrega', async () => {
      builderPipelineOrchestrator.runPipeline.mockRejectedValue(
        new RunCancelledError(runId),
      );

      await service.processBuildRunJob({ buildRunId: runId, deliveryId });

      expect(builderRunSupportService.markRunAsFailed).not.toHaveBeenCalled();
      // Solo la transicion inicial a IN_REVIEW; ninguna a EVALUATED.
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledTimes(
        1,
      );
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.IN_REVIEW,
      );
    });

    it('no limpia el workspace: ese ciclo de vida pertenece al orquestador', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult(),
      );

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      expect(rm).not.toHaveBeenCalled();
    });

    it('persiste el resultado del pipeline en el run y actualiza la entrega via DeliveryStatusService', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult({
          planAssessment: { thought: 'planner thought' },
          assessment: {
            thought: 'auditor thought',
            gradeBreakdown: [{ awarded: 8 }],
          },
          qualityFindings: { security: [] },
          report: { summary: 'final report' },
        }),
      );

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      expect(buildRunRepository.claimQueuedRun).toHaveBeenCalledWith(
        runId,
        expect.any(Date),
      );
      expect(buildRunRepository.completeRunningRun).toHaveBeenCalledTimes(1);
      const [completedId, patch] =
        buildRunRepository.completeRunningRun.mock.calls[0];
      expect(completedId).toBe(runId);
      expect(patch.llmReasoning).toContain('planner thought');
      expect(patch.llmReasoning).toContain('auditor thought');
      expect(patch.report).toEqual({ summary: 'final report' });

      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.EVALUATED,
      );
      expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'RUN_COMPLETED' }),
      );
    });

    it('ORC-001: descarta el resultado calculado si el run ya no seguia RUNNING al completarlo (p.ej. cancelado)', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult(),
      );
      buildRunRepository.completeRunningRun.mockResolvedValue(false);

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      // completeRunningRun se invoca una unica vez (sin reintento: el UPDATE
      // condicionado ya es atomico) y, al devolver 0 filas afectadas, no se
      // marca la entrega como EVALUATED ni se emite RUN_COMPLETED.
      expect(buildRunRepository.completeRunningRun).toHaveBeenCalledTimes(1);
      expect(
        deliveryStatusService.updateStatusInternal,
      ).not.toHaveBeenCalledWith(deliveryId, DeliveryStatus.EVALUATED);
      expect(builderRunSupportService.emitEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'RUN_COMPLETED' }),
      );
    });

    it('ignora el job cuando el run ya no esta en QUEUED (posible reprocesado duplicado)', async () => {
      buildRunRepository.findById.mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.RUNNING,
      });
      const warnSpy = jest.spyOn(
        (service as unknown as { logger: Logger }).logger,
        'warn',
      );

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      expect(buildRunRepository.claimQueuedRun).not.toHaveBeenCalled();
      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
      expect(deliveryStatusService.updateStatusInternal).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(runId));
    });

    it('sigue ignorando el job cuando el run esta cancelado', async () => {
      buildRunRepository.findById.mockResolvedValue({
        ...buildRun(),
        status: BuildRunStatus.CANCELLED,
      });

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      expect(buildRunRepository.claimQueuedRun).not.toHaveBeenCalled();
      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
    });

    it('ORC-001: un claim que afecta 0 filas (otro escritor gano la carrera) descarta el job sin arrancar el pipeline', async () => {
      buildRunRepository.claimQueuedRun.mockResolvedValue(false);

      await service.processBuildRunJob({ buildRunId: runId, deliveryId });

      expect(buildRunRepository.claimQueuedRun).toHaveBeenCalledTimes(1);
      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledTimes(
        1,
      );
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.IN_REVIEW,
      );
    });

    it('propaga cualquier error de claimQueuedRun al pasar a RUNNING', async () => {
      buildRunRepository.claimQueuedRun.mockRejectedValue(
        new Error('Postgres caido'),
      );

      await expect(
        service.processBuildRunJob({ buildRunId: runId, deliveryId }),
      ).rejects.toThrow('Postgres caido');

      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
    });
  });
});
