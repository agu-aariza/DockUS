import { rm } from 'fs/promises';
import { DataSource, Repository } from 'typeorm';
import { Queue } from 'bullmq';

import { BuilderRunCommandsService } from './builder-run-commands.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { BuilderConfigProvider } from '../../../domain/builder-config.provider';
import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunMetricsService } from './builder-run-metrics.service';
import { BuilderStaleRunRecoveryService } from './builder-stale-run-recovery.service';
import { BuilderRunCostService } from '../../../domain/ai/builder-run-cost.service';
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

describe('BuilderRunCommandsService', () => {
  let service: BuilderRunCommandsService;

  const runId = 'run-123';
  const deliveryId = 'delivery-123';

  const buildRunRepository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto as BuildRun),
    save: jest.fn((run) => Promise.resolve({ ...run, id: runId } as BuildRun)),
  };

  const deliveriesRepository = {
    findOne: jest.fn(),
    save: jest.fn((delivery) => Promise.resolve(delivery as Delivery)),
  };

  const builderRunsQueue = {
    add: jest.fn(),
  } as unknown as Queue;

  const builderAccessService = {
    findDeliveryOrThrow: jest.fn(),
  };

  const builderRunQueriesService = {} as BuilderRunQueriesService;

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

  const builderStaleRunRecoveryService = {
    failStaleRunsOnStartup: jest.fn(),
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
      status: BuildRunStatus.RUNNING,
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

  const builderRunCostService = {
    summarize: jest.fn(async () => ({
      inputTokens: 1200,
      outputTokens: 300,
      costUsd: 0.0042,
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    buildRunRepository.findOne.mockResolvedValue(buildRun());
    builderAccessService.findDeliveryOrThrow.mockResolvedValue(buildDelivery());
    deliveriesRepository.findOne.mockResolvedValue(buildDelivery());

    service = new BuilderRunCommandsService(
      buildRunRepository as unknown as any,
      deliveriesRepository as unknown as Repository<Delivery>,
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
      builderPipelineOrchestrator as unknown as BuilderPipelineOrchestrator,
      builderRunMetricsService as unknown as BuilderRunMetricsService,
      builderStaleRunRecoveryService as unknown as BuilderStaleRunRecoveryService,
      {} as DataSource,
      builderRunCostService as unknown as BuilderRunCostService,
    );
  });

  describe('processBuildRunJob', () => {
    it('marca el run como fallido y saca la entrega de revision cuando el pipeline falla', async () => {
      builderPipelineOrchestrator.runPipeline.mockRejectedValue(
        new Error('Pipeline fallido'),
      );

      await expect(
        service.processBuildRunJob({ buildRunId: runId, deliveryId } as any),
      ).rejects.toThrow('Pipeline fallido');

      expect(builderRunSupportService.markRunAsFailed).toHaveBeenCalledWith(
        runId,
        'Pipeline fallido',
      );
      const evaluatedCall = deliveriesRepository.save.mock.calls.find(
        ([delivery]) =>
          (delivery as Delivery).status === DeliveryStatus.EVALUATED,
      );
      expect(evaluatedCall).toBeTruthy();
    });

    it('no limpia el workspace: ese ciclo de vida pertenece al orquestador', async () => {
      builderPipelineOrchestrator.runPipeline.mockResolvedValue(
        buildPipelineResult(),
      );

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      } as any);

      expect(rm).not.toHaveBeenCalled();
    });

    it('persiste el resultado del pipeline en el run y actualiza la entrega', async () => {
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
      } as any);

      const savedRunCall = buildRunRepository.save.mock.calls.find(
        ([run]) => (run as BuildRun).status === BuildRunStatus.SUCCESS,
      );
      expect(savedRunCall).toBeTruthy();
      const savedRun = savedRunCall![0] as BuildRun;
      expect(savedRun.llmReasoning).toContain('planner thought');
      expect(savedRun.llmReasoning).toContain('auditor thought');
      expect(savedRun.report).toEqual({ summary: 'final report' });

      const evaluatedCall = deliveriesRepository.save.mock.calls.find(
        ([delivery]) =>
          (delivery as Delivery).status === DeliveryStatus.EVALUATED,
      );
      expect(evaluatedCall).toBeTruthy();
    });
  });
});
