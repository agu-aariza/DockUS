import { rm } from 'fs/promises';
import { DataSource, Repository } from 'typeorm';
import { Queue } from 'bullmq';

import { BuilderRunCommandsService } from './builder-run-commands.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderWorkspaceService } from '../workspace/builder-workspace.service';
import { BuilderAccessService } from '../workspace/builder-access.service';
import { BuilderPlanStageHandler } from '../stages/plan-stage.handler';
import { BuilderCompileStageHandler } from '../stages/compile-stage.handler';
import { BuilderExecutionStageHandler } from '../stages/execution-stage.handler';
import { BuilderEvaluationStageHandler } from '../stages/evaluation-stage.handler';
import { BuilderQualityStageHandler } from '../stages/quality-stage.handler';
import { BuilderReportStageHandler } from '../stages/report-stage.handler';
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

  const workspaceRoot = '/tmp/dockus-builder-test-123';
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

  const builderWorkspaceService = {
    prepareWorkspace: jest.fn(),
  };

  const planStageHandler = {
    handle: jest.fn(),
  };

  const compileStageHandler = {
    handle: jest.fn(),
  };

  const executionStageHandler = {
    handle: jest.fn(),
  };

  const evaluationStageHandler = {
    handle: jest.fn(),
  };

  const qualityStageHandler = {
    handle: jest.fn(),
  };

  const reportStageHandler = {
    handle: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();

    buildRunRepository.findOne.mockResolvedValue(buildRun());
    builderAccessService.findDeliveryOrThrow.mockResolvedValue(buildDelivery());
    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      workspaceRoot,
      runtimeFiles: [],
      warnings: [],
    });
    deliveriesRepository.findOne.mockResolvedValue(buildDelivery());

    service = new BuilderRunCommandsService(
      buildRunRepository as unknown as any,
      deliveriesRepository as unknown as Repository<Delivery>,
      builderRunsQueue,
      builderAccessService as unknown as BuilderAccessService,
      builderRunQueriesService,
      builderRunSupportService as unknown as BuilderRunSupportService,
      builderWorkspaceService as unknown as BuilderWorkspaceService,
      planStageHandler as unknown as BuilderPlanStageHandler,
      compileStageHandler as unknown as BuilderCompileStageHandler,
      executionStageHandler as unknown as BuilderExecutionStageHandler,
      evaluationStageHandler as unknown as BuilderEvaluationStageHandler,
      qualityStageHandler as unknown as BuilderQualityStageHandler,
      reportStageHandler as unknown as BuilderReportStageHandler,
      { get: jest.fn((_key: string, fallback?: unknown) => fallback) } as any,
      {} as DataSource,
    );
  });

  describe('processBuildRunJob', () => {
    it('limpia el workspace incluso cuando una etapa del pipeline falla', async () => {
      jest.mocked(rm).mockResolvedValue(undefined);
      planStageHandler.handle.mockRejectedValue(
        new Error('Planificacion fallida'),
      );

      await expect(
        service.processBuildRunJob({ buildRunId: runId, deliveryId } as any),
      ).rejects.toThrow('Planificacion fallida');

      expect(builderRunSupportService.markRunAsFailed).toHaveBeenCalledWith(
        runId,
        'Planificacion fallida',
      );
      const evaluatedCall = deliveriesRepository.save.mock.calls.find(
        ([delivery]) =>
          (delivery as Delivery).status === DeliveryStatus.EVALUATED,
      );
      expect(evaluatedCall).toBeTruthy();
      expect(rm).toHaveBeenCalledWith(workspaceRoot, {
        recursive: true,
        force: true,
      });
    });

    it('limpia el workspace despues de una ejecucion exitosa', async () => {
      jest.mocked(rm).mockResolvedValue(undefined);

      planStageHandler.handle.mockResolvedValue({
        planAssessment: { thought: 'todo ok' },
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        executionLogs: '',
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment: {
          thought: 'evaluacion ok',
          gradeBreakdown: [],
        },
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings: [],
      });
      reportStageHandler.handle.mockResolvedValue({
        report: { summary: 'ok' },
      });

      await service.processBuildRunJob({
        buildRunId: runId,
        deliveryId,
      } as any);

      expect(rm).toHaveBeenCalledWith(workspaceRoot, {
        recursive: true,
        force: true,
      });
    });
  });
});
