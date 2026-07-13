import * as fs from 'fs/promises';

import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import {
  BuilderWorkspaceService,
  StageWorkspaceResult,
} from '../workspace/builder-workspace.service';
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
import { RuntimeFile } from '../../../domain/builder.types';

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('BuilderPipelineOrchestrator', () => {
  let orchestrator: BuilderPipelineOrchestrator;

  const runId = 'run-123';
  const deliveryId = 'delivery-123';

  const builderWorkspaceService = {
    prepareWorkspace: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined),
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

  const builderRunSupportService = {
    emitEvent: jest.fn().mockResolvedValue(undefined),
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

  const buildWorkspace = (
    runtimeFiles: RuntimeFile[] = [],
    overrides: Partial<StageWorkspaceResult> = {},
  ): StageWorkspaceResult => ({
    inputManifest: [],
    runtimeFiles,
    teacherTestRuntimeFiles: [],
    hasTeacherTests: false,
    workspaceRoot: '/tmp/dockus-builder-test-123',
    projectRootDir: '/tmp/dockus-builder-test-123/project',
    warnings: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    orchestrator = new BuilderPipelineOrchestrator(
      builderWorkspaceService as unknown as BuilderWorkspaceService,
      planStageHandler as unknown as BuilderPlanStageHandler,
      compileStageHandler as unknown as BuilderCompileStageHandler,
      executionStageHandler as unknown as BuilderExecutionStageHandler,
      evaluationStageHandler as unknown as BuilderEvaluationStageHandler,
      qualityStageHandler as unknown as BuilderQualityStageHandler,
      reportStageHandler as unknown as BuilderReportStageHandler,
      builderRunSupportService as unknown as BuilderRunSupportService,
    );
  });

  describe('runPipeline', () => {
    it('ejecuta todas las stages en orden y devuelve el resultado completo', async () => {
      const planAssessment = { thought: 'plan ok' };
      const assessment = { thought: 'eval ok' };
      const qualityFindings = { thought: 'quality ok' };
      const report = { summary: 'report ok' };
      const workspace = buildWorkspace();

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(workspace);
      planStageHandler.handle.mockResolvedValue({ planAssessment });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        executionLogs: 'compile logs',
      });
      evaluationStageHandler.handle.mockResolvedValue({ assessment });
      qualityStageHandler.handle.mockResolvedValue({ qualityFindings });
      reportStageHandler.handle.mockResolvedValue({ report });

      const result = await orchestrator.runPipeline(
        buildRun(),
        buildDelivery(),
      );

      expect(builderWorkspaceService.prepareWorkspace).toHaveBeenCalledWith(
        deliveryId,
      );
      expect(planStageHandler.handle).toHaveBeenCalled();
      expect(compileStageHandler.handle).toHaveBeenCalled();
      expect(executionStageHandler.handle).not.toHaveBeenCalled();
      expect(evaluationStageHandler.handle).toHaveBeenCalled();
      expect(qualityStageHandler.handle).toHaveBeenCalled();
      expect(reportStageHandler.handle).toHaveBeenCalled();

      expect(result.assessment).toEqual(assessment);
      expect(result.qualityFindings).toEqual(qualityFindings);
      expect(result.report).toEqual(report);
      expect(result.executionLogs).toBe('compile logs');
      expect(result.warnings).toEqual(workspace.warnings);
      // El orquestador posee el ciclo de vida: limpia el workspace al terminar.
      expect(builderWorkspaceService.cleanup).toHaveBeenCalledWith(workspace);
    });

    it('ejecuta la stage de ejecucion cuando el proyecto es ejecutable', async () => {
      const workspace = buildWorkspace();

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(workspace);
      planStageHandler.handle.mockResolvedValue({ planAssessment: {} });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: true },
      });
      executionStageHandler.handle.mockResolvedValue({
        executionLogs: 'exec logs',
      });
      evaluationStageHandler.handle.mockResolvedValue({ assessment: {} });
      qualityStageHandler.handle.mockResolvedValue({ qualityFindings: {} });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      const result = await orchestrator.runPipeline(
        buildRun(),
        buildDelivery(),
      );

      expect(executionStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          runId,
          expectedType: 'PYTHON_FASTAPI',
        }),
      );
      expect(result.executionLogs).toBe('exec logs');
    });

    it('enriquece el gradeBreakdown con el peso y la descripción de la rúbrica configurada', async () => {
      const assessment = {
        thought: 'eval ok',
        gradeBreakdown: [
          { criterion: 'Correctitud', maxPoints: 6, awarded: 5, justification: 'ok' },
          { criterion: 'Sin match', maxPoints: 4, awarded: 4, justification: 'ok' },
        ],
      };

      const delivery = {
        id: deliveryId,
        status: DeliveryStatus.SUBMITTED,
        assignment: {
          id: 'assignment-123',
          project: {
            id: 'project-123',
            expectedType: 'PYTHON_FASTAPI',
            rubricInstructions: null,
            expectedOutput: null,
            rubricCriteria: [
              { name: 'Correctitud', weight: 60, description: 'Salida correcta.' },
            ],
          },
        },
      } as unknown as Delivery;

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(buildWorkspace());
      planStageHandler.handle.mockResolvedValue({ planAssessment: {} });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        executionLogs: 'logs',
      });
      evaluationStageHandler.handle.mockResolvedValue({ assessment });
      qualityStageHandler.handle.mockResolvedValue({ qualityFindings: {} });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      const result = await orchestrator.runPipeline(buildRun(), delivery);

      expect(result.assessment.gradeBreakdown[0]).toEqual(
        expect.objectContaining({
          criterion: 'Correctitud',
          weight: 60,
          description: 'Salida correcta.',
        }),
      );
      // El criterio sin correspondencia en la rúbrica queda intacto (sin peso).
      expect(result.assessment.gradeBreakdown[1].weight).toBeUndefined();
    });

    it('propaga el error cuando una stage falla', async () => {
      builderWorkspaceService.prepareWorkspace.mockResolvedValue(
        buildWorkspace(),
      );
      planStageHandler.handle.mockRejectedValue(new Error('plan failed'));

      await expect(
        orchestrator.runPipeline(buildRun(), buildDelivery()),
      ).rejects.toThrow('plan failed');
    });

    it('construye sourceCodePayload ignorando node_modules y __pycache__', async () => {
      const workspace = buildWorkspace([
        {
          relativePath: 'app.py',
          absolutePath: '/tmp/project/app.py',
          sizeBytes: 100,
        },
        {
          relativePath: 'node_modules/pkg/index.js',
          absolutePath: '/tmp/project/node_modules/pkg/index.js',
          sizeBytes: 100,
        },
        {
          relativePath: '__pycache__/cache.pyc',
          absolutePath: '/tmp/project/__pycache__/cache.pyc',
          sizeBytes: 100,
        },
      ]);

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(workspace);
      jest.mocked(fs.readFile).mockResolvedValue('content');
      planStageHandler.handle.mockResolvedValue({ planAssessment: {} });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
      });
      evaluationStageHandler.handle.mockResolvedValue({ assessment: {} });
      qualityStageHandler.handle.mockResolvedValue({ qualityFindings: {} });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      await orchestrator.runPipeline(buildRun(), buildDelivery());

      expect(fs.readFile).toHaveBeenCalledTimes(1);
      expect(fs.readFile).toHaveBeenCalledWith('/tmp/project/app.py', 'utf8');

      expect(planStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCodePayload: expect.stringContaining('--- Archivo: app.py ---'),
        }),
      );
      expect(planStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCodePayload: expect.not.stringContaining('node_modules'),
        }),
      );
    });
  });
});
