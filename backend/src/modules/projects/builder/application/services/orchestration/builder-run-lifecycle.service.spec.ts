import { rm } from 'fs/promises';
import { Logger } from '@nestjs/common';
import { OptimisticLockVersionMismatchError } from 'typeorm';

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
    save: jest.fn((run) => Promise.resolve({ ...run, id: runId } as BuildRun)),
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

      const savedRunCall = buildRunRepository.save.mock.calls.find(
        ([run]) => (run as BuildRun).status === BuildRunStatus.SUCCESS,
      );
      expect(savedRunCall).toBeTruthy();
      const savedRun = savedRunCall![0] as BuildRun;
      expect(savedRun.llmReasoning).toContain('planner thought');
      expect(savedRun.llmReasoning).toContain('auditor thought');
      expect(savedRun.report).toEqual({ summary: 'final report' });

      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.EVALUATED,
      );
    });

    it('HIGH-06: descarta el resultado calculado si el run fue cancelado mientras el pipeline corria', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult(),
      );
      // Primera llamada a findById: carga inicial del run (QUEUED). Segunda
      // llamada: re-chequeo justo antes de guardar el resultado — simula
      // que cancelRun ya lo marco CANCELLED de forma atomica mientras tanto.
      buildRunRepository.findById
        .mockResolvedValueOnce(buildRun())
        .mockResolvedValueOnce({
          ...buildRun(),
          status: BuildRunStatus.CANCELLED,
        });

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      });

      // save() se invoca una unica vez (la transicion a RUNNING, antes del
      // pipeline). El guard debe impedir la segunda llamada que persistiria
      // el resultado SUCCESS calculado, pisando la cancelacion. Nota: no se
      // puede distinguir esto inspeccionando `mock.calls[n][0].status`
      // despues del hecho, porque `run` es el mismo objeto mutado in-place
      // en ambas llamadas — jest solo guarda la referencia, no una copia; el
      // conteo de llamadas es la unica senal fiable aqui.
      expect(buildRunRepository.save).toHaveBeenCalledTimes(1);
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

      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
      expect(buildRunRepository.save).not.toHaveBeenCalled();
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

      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
      expect(buildRunRepository.save).not.toHaveBeenCalled();
    });

    it('ARQ-013: un conflicto de lock optimista al pasar a RUNNING descarta el job sin arrancar el pipeline', async () => {
      buildRunRepository.save.mockRejectedValueOnce(
        new OptimisticLockVersionMismatchError('BuildRun', 0, 1),
      );

      await service.processBuildRunJob({ buildRunId: runId, deliveryId });

      expect(buildRunRepository.save).toHaveBeenCalledTimes(1);
      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledTimes(
        1,
      );
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.IN_REVIEW,
      );
    });

    it('propaga cualquier otro error de save() al pasar a RUNNING (no lo confunde con un conflicto de version)', async () => {
      buildRunRepository.save.mockRejectedValueOnce(
        new Error('Postgres caido'),
      );

      await expect(
        service.processBuildRunJob({ buildRunId: runId, deliveryId }),
      ).rejects.toThrow('Postgres caido');

      expect(builderPipelineOrchestrator.runPipeline).not.toHaveBeenCalled();
    });

    it('ARQ-013: un conflicto de lock optimista al guardar el resultado final se descarta si la relectura muestra CANCELLED', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult(),
      );
      // 1a: carga inicial (QUEUED). 2a: guarda pre-resultado, no cancelado
      // todavia. 3a: relectura tras el conflicto de version -> ya cancelado.
      buildRunRepository.findById
        .mockResolvedValueOnce(buildRun())
        .mockResolvedValueOnce(buildRun())
        .mockResolvedValueOnce({
          ...buildRun(),
          status: BuildRunStatus.CANCELLED,
        });
      buildRunRepository.save
        .mockResolvedValueOnce({ ...buildRun(), status: BuildRunStatus.RUNNING } as BuildRun)
        .mockRejectedValueOnce(
          new OptimisticLockVersionMismatchError('BuildRun', 1, 2),
        );

      await service.processBuildRunJob({ buildRunId: runId, deliveryId });

      // save() se invoca dos veces: RUNNING, y el intento fallido del
      // resultado final. No hay un tercer intento porque la relectura tras
      // el conflicto encontro CANCELLED.
      expect(buildRunRepository.save).toHaveBeenCalledTimes(2);
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledTimes(
        1,
      );
    });

    it('ARQ-013: un conflicto de lock optimista al guardar el resultado final reintenta sobre la version releida si no esta cancelado', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult({
          report: { summary: 'final report' },
        }),
      );
      const rereadRun = { ...buildRun(), status: BuildRunStatus.RUNNING };
      buildRunRepository.findById
        .mockResolvedValueOnce(buildRun())
        .mockResolvedValueOnce(buildRun())
        .mockResolvedValueOnce(rereadRun);
      buildRunRepository.save
        .mockResolvedValueOnce({ ...buildRun(), status: BuildRunStatus.RUNNING } as BuildRun)
        .mockRejectedValueOnce(
          new OptimisticLockVersionMismatchError('BuildRun', 1, 2),
        )
        .mockResolvedValueOnce(rereadRun as BuildRun);

      await service.processBuildRunJob({ buildRunId: runId, deliveryId });

      // 3 saves: RUNNING, el intento que choca con el lock, y el reintento
      // sobre la entidad releida.
      expect(buildRunRepository.save).toHaveBeenCalledTimes(3);
      const retriedSave = buildRunRepository.save.mock.calls[2][0] as BuildRun;
      expect(retriedSave.report).toEqual({ summary: 'final report' });
      expect(deliveryStatusService.updateStatusInternal).toHaveBeenCalledWith(
        deliveryId,
        DeliveryStatus.EVALUATED,
      );
    });
  });
});
