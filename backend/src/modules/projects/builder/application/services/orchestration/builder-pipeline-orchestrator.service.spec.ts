import { BuilderPipelineOrchestrator } from './builder-pipeline-orchestrator.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import {
  BuilderWorkspaceService,
  StageWorkspaceResult,
} from '../workspace/builder-workspace.service';
import { SourceCodePayloadBuilder } from '../workspace/source-code-payload-builder.service';
import { BuilderPlanStageHandler } from '../stages/plan-stage.handler';
import { BuilderCompileStageHandler } from '../stages/compile-stage.handler';
import { BuilderExecutionStageHandler } from '../stages/execution-stage.handler';
import { BuilderEvaluationStageHandler } from '../stages/evaluation-stage.handler';
import { BuilderQualityStageHandler } from '../stages/quality-stage.handler';
import { BuilderReportStageHandler } from '../stages/report-stage.handler';
import { BuilderReportComposer } from '../evaluation/builder-report-composer.service';
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
import { BuilderRunCancellationService } from './builder-run-cancellation.service';
import { RunCancelledError } from './run-cancelled.error';

describe('BuilderPipelineOrchestrator', () => {
  let orchestrator: BuilderPipelineOrchestrator;

  const runId = 'run-123';
  const deliveryId = 'delivery-123';

  const builderWorkspaceService = {
    prepareWorkspace: jest.fn(),
    cleanup: jest.fn().mockResolvedValue(undefined),
  };

  const sourceCodePayloadBuilder = {
    build: jest.fn(),
  };

  const builderReportComposer = {
    enrichGradeBreakdownWithRubric: jest.fn(),
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

  const cancellationWatcherStop = jest.fn();
  const builderRunCancellationService = {
    assertNotCancelled: jest.fn().mockResolvedValue(undefined),
    createCancellationWatcher: jest.fn(() => ({
      signal: new AbortController().signal,
      stop: cancellationWatcherStop,
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
    teacherTestsRootDir: '/tmp/dockus-builder-test-123/teacher-tests',
    warnings: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sourceCodePayloadBuilder.build.mockResolvedValue('source code payload');

    orchestrator = new BuilderPipelineOrchestrator(
      builderWorkspaceService as unknown as BuilderWorkspaceService,
      sourceCodePayloadBuilder as unknown as SourceCodePayloadBuilder,
      planStageHandler as unknown as BuilderPlanStageHandler,
      compileStageHandler as unknown as BuilderCompileStageHandler,
      executionStageHandler as unknown as BuilderExecutionStageHandler,
      evaluationStageHandler as unknown as BuilderEvaluationStageHandler,
      qualityStageHandler as unknown as BuilderQualityStageHandler,
      reportStageHandler as unknown as BuilderReportStageHandler,
      builderReportComposer as unknown as BuilderReportComposer,
      builderRunSupportService as unknown as BuilderRunSupportService,
      builderRunCancellationService as unknown as BuilderRunCancellationService,
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
      planStageHandler.handle.mockResolvedValue({ planAssessment, usages: [] });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        execution: {
          ran: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          skippedReason: 'compile logs',
        },
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment,
        usages: [],
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings,
        usages: [],
      });
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
      expect(result.execution.skippedReason).toBe('compile logs');
      expect(result.warnings).toEqual(workspace.warnings);
      // El orquestador posee el ciclo de vida: limpia el workspace al terminar.
      expect(builderWorkspaceService.cleanup).toHaveBeenCalledWith(workspace);
    });

    it('ejecuta la stage de ejecucion cuando el proyecto es ejecutable', async () => {
      const workspace = buildWorkspace();

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(workspace);
      planStageHandler.handle.mockResolvedValue({
        planAssessment: {},
        usages: [],
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: true },
      });
      executionStageHandler.handle.mockResolvedValue({
        execution: { ran: true, stdout: 'exec logs', stderr: '', exitCode: 0 },
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment: {},
        usages: [],
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings: {},
        usages: [],
      });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      const result = await orchestrator.runPipeline(
        buildRun(),
        buildDelivery(),
      );

      // ARQ-014: expectedType ya no viaja hasta la etapa de ejecucion — el
      // handler nunca lo leia (ver el destructuring de execution-stage.handler.ts).
      expect(executionStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ runId }),
      );
      expect(
        (executionStageHandler.handle.mock.calls[0][0] as { expectedType?: unknown }).expectedType,
      ).toBeUndefined();
      expect(result.execution.stdout).toBe('exec logs');
    });

    it('ARQ-011: delega el enriquecimiento del gradeBreakdown en BuilderReportComposer con la rúbrica del proyecto', async () => {
      const assessment = { thought: 'eval ok', gradeBreakdown: [] };
      const rubricCriteria = [
        { name: 'Correctitud', weight: 60, description: 'Salida correcta.' },
      ];

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
            rubricCriteria,
          },
        },
      } as unknown as Delivery;

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(
        buildWorkspace(),
      );
      planStageHandler.handle.mockResolvedValue({
        planAssessment: {},
        usages: [],
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        execution: {
          ran: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          skippedReason: 'logs',
        },
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment,
        usages: [],
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings: {},
        usages: [],
      });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      await orchestrator.runPipeline(buildRun(), delivery);

      // Movido a BuilderReportComposer (ARQ-011): el orquestador ya no
      // conoce la lógica de emparejamiento por nombre, solo delega.
      expect(
        builderReportComposer.enrichGradeBreakdownWithRubric,
      ).toHaveBeenCalledWith(assessment, rubricCriteria);
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

    it('ARQ-011: construye el payload de código fuente vía SourceCodePayloadBuilder y lo propaga a las etapas', async () => {
      const workspace = buildWorkspace();

      builderWorkspaceService.prepareWorkspace.mockResolvedValue(workspace);
      sourceCodePayloadBuilder.build.mockResolvedValue(
        '--- Archivo: app.py ---\nprint(1)\n',
      );
      planStageHandler.handle.mockResolvedValue({
        planAssessment: {},
        usages: [],
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        execution: { ran: false, stdout: '', stderr: '', exitCode: null },
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment: {},
        usages: [],
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings: {},
        usages: [],
      });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      await orchestrator.runPipeline(buildRun(), buildDelivery());

      // La política de qué cuenta como código fuente (extensiones, tamaño
      // máximo, directorios excluidos) vive ahora en SourceCodePayloadBuilder
      // (ARQ-011), no en el orquestador — este solo la invoca y propaga el
      // resultado.
      expect(sourceCodePayloadBuilder.build).toHaveBeenCalledWith(workspace);
      expect(planStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceCodePayload: '--- Archivo: app.py ---\nprint(1)\n',
        }),
      );
    });

    it('ARQ-004: aborta entre etapas si detecta cancelacion, sin invocar las etapas restantes', async () => {
      builderWorkspaceService.prepareWorkspace.mockResolvedValue(
        buildWorkspace(),
      );
      planStageHandler.handle.mockResolvedValue({
        planAssessment: {},
        usages: [],
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: false },
        execution: {
          ran: false,
          stdout: '',
          stderr: '',
          exitCode: null,
          skippedReason: 'logs',
        },
      });
      builderRunCancellationService.assertNotCancelled
        .mockResolvedValueOnce(undefined) // antes del plan
        .mockResolvedValueOnce(undefined) // antes del compile
        .mockRejectedValueOnce(new RunCancelledError(runId)); // antes de ejecucion/evaluacion

      await expect(
        orchestrator.runPipeline(buildRun(), buildDelivery()),
      ).rejects.toThrow(RunCancelledError);

      expect(evaluationStageHandler.handle).not.toHaveBeenCalled();
      expect(qualityStageHandler.handle).not.toHaveBeenCalled();
      // El ciclo de vida del workspace no depende de por que termino el pipeline.
      expect(builderWorkspaceService.cleanup).toHaveBeenCalled();
    });

    it('ARQ-004: abre un sondeo de cancelacion alrededor de la etapa de ejecucion y lo cierra siempre', async () => {
      builderWorkspaceService.prepareWorkspace.mockResolvedValue(
        buildWorkspace(),
      );
      planStageHandler.handle.mockResolvedValue({
        planAssessment: {},
        usages: [],
      });
      compileStageHandler.handle.mockResolvedValue({
        compiled: { executable: true },
      });
      executionStageHandler.handle.mockResolvedValue({
        execution: { ran: true, stdout: 'exec logs', stderr: '', exitCode: 0 },
      });
      evaluationStageHandler.handle.mockResolvedValue({
        assessment: {},
        usages: [],
      });
      qualityStageHandler.handle.mockResolvedValue({
        qualityFindings: {},
        usages: [],
      });
      reportStageHandler.handle.mockResolvedValue({ report: {} });

      await orchestrator.runPipeline(buildRun(), buildDelivery());

      expect(
        builderRunCancellationService.createCancellationWatcher,
      ).toHaveBeenCalledWith(runId);
      expect(executionStageHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      expect(cancellationWatcherStop).toHaveBeenCalled();
    });
  });
});
