import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { BuilderPreflightService } from './builder-preflight.service';
import { BuilderRunStateService } from './builder-run-state.service';
import { BuilderStandardPipelineService } from './builder-standard-pipeline.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderRunTelemetryService } from './builder-run-telemetry.service';
import { BuilderRunEventsService } from '../../domain/events/builder-run-events.service';
import { ExecutionAdapterService } from '../../infrastructure/execution/execution-adapter.service';
import { BuilderReportService } from '../../domain/reporting/builder-report.service';
import {
  BuildRun,
  BuildRunStatus,
} from '../../domain/entities/build-run.entity';
import { Delivery } from '../../../deliveries/entities/delivery.entity';
import {
  BuilderLlmAssessment,
  BuildStage,
  StageStatus,
  type StaticReviewIssue,
  type BuilderTechnicalFeedback,
} from '../../domain/builder.types';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';

type Scenario =
  | 'build_fail_then_recover'
  | 'deploy_fail_then_recover'
  | 'build_fail_no_change'
  | 'tests_fail';

const buildAssessment = (
  overrides: Partial<BuilderLlmAssessment> = {},
): BuilderLlmAssessment => ({
  structuralType: 'Web API con FastAPI',
  capabilities: {
    C1: { status: 'yes', rationale: 'Instalable.' },
    C2: { status: 'yes', rationale: 'Ejecutable.' },
    C3: { status: 'yes', rationale: 'Servicio HTTP.' },
    C4: { status: 'yes', rationale: 'Testeable.' },
    C5: { status: 'yes', rationale: 'Healthcheck disponible.' },
    C6: { status: 'no', rationale: 'Sin configuración externa.' },
  },
  evaluativeState: 'E1',
  confidence: 'high',
  rationale: 'Proyecto funcional.',
  externalRequirements: [],
  recipe: {
    install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
    run: ['python', '-m', 'uvicorn', 'app:app', '--port', '8000'],
    test: [['pytest', '-q']],
    healthcheck: ['python', 'healthcheck.py'],
    servicePort: 8000,
    systemPackages: [],
  },
  evidenceSummary: 'Resumen inicial.',
  observedEvidence: ['requirements.txt presente'],
  evaluationLimits: [],
  ...overrides,
});

const emptyFeedback: BuilderTechnicalFeedback = {
  security: [],
  architecture: [],
  quality: [],
};

describe('BuilderStandardPipelineService', () => {
  function createArtifact(type: BuildRunArtifactType) {
    return {
      id: `${type}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      contentType: 'application/json',
      sizeBytes: 10,
      createdAt: new Date().toISOString(),
    };
  }

  function createService(scenario: Scenario) {
    const run = {
      id: 'run-1',
      deliveryId: 'delivery-1',
      status: BuildRunStatus.QUEUED,
      warnings: [],
      runtimeTarget: {
        projectId: 'project-1',
        workspaceNetworkName: 'dockus-workspace-project1',
        executionNetworkName: 'dockus-run-run1',
        primaryContainerId: null,
        helperContainerIds: [],
      },
    } as BuildRun;
    const delivery = {
      id: 'delivery-1',
    } as Delivery;
    const projectRootDir = '/tmp/dockus-builder-test/project';
    const runtimeFiles = [
      {
        relativePath: 'app.py',
        absolutePath: `${projectRootDir}/app.py`,
        sizeBytes: 20,
      },
    ];
    const repository = {
      findOne: jest.fn().mockResolvedValue(run),
      save: jest.fn().mockImplementation(async (entity) => entity),
    } as unknown as Repository<BuildRun>;
    const events = {
      emit: jest.fn().mockResolvedValue(undefined),
    } as unknown as BuilderRunEventsService;
    const executionAdapter = {
      removeDockerImage: jest.fn().mockResolvedValue(true),
      collectExecutionContext: jest.fn().mockResolvedValue({
        pythonBaseImage: 'python:3.11.9-slim-bookworm',
        pythonBaseImageDigest: null,
        dockerVersion: '27',
        runtimeBackend: 'docker-cli',
        sandboxRuntime: 'runc',
        limits: {
          batchTimeoutSeconds: 60,
          serviceReadyTimeoutSeconds: 90,
          stabilityWindowSeconds: 30,
        },
      }),
    } as unknown as ExecutionAdapterService;
    const builderRunTelemetryService = new BuilderRunTelemetryService(events);
    const builderRunStateService = new BuilderRunStateService(
      repository,
      executionAdapter,
      builderRunTelemetryService,
    );
    const builderRunSupportService = new BuilderRunSupportService(
      builderRunStateService,
      builderRunTelemetryService,
    );
    const builderPreflightService = new BuilderPreflightService(
      builderRunSupportService,
    );

    let buildAttempt = 0;
    const evidenceService = {
      persistJsonArtifact: jest
        .fn()
        .mockImplementation(async (_runId, type) => {
          return createArtifact(type);
        }),
      persistTextArtifact: jest
        .fn()
        .mockImplementation(async (_runId, type) => {
          return createArtifact(type);
        }),
    };
    const builderBuildStageService = {
      run: jest.fn().mockImplementation(async ({ state, deliveryId }) => {
        buildAttempt += 1;
        const attemptFails =
          (scenario === 'build_fail_then_recover' && buildAttempt === 1) ||
          scenario === 'build_fail_no_change';
        state.currentAttemptDiagnostics.buildLogText = attemptFails
          ? 'pg_config executable not found'
          : 'build ok';
        state.currentAttemptDiagnostics.buildLogTail = [
          attemptFails ? 'pg_config executable not found' : 'build ok',
        ];
        state.stageResults.push(
          builderRunSupportService.toManualStage(
            BuildStage.BUILD,
            attemptFails ? StageStatus.FAIL : StageStatus.PASS,
            attemptFails ? 'DOCKER_BUILD_FAILED' : 'DOCKER_BUILD_OK',
          ),
        );
        state.runtimeOutputs.buildLogs = {
          imageTag: attemptFails ? null : `image-${deliveryId}-${buildAttempt}`,
        };
        return attemptFails ? null : `image-${deliveryId}-${buildAttempt}`;
      }),
    };
    const builderDeployStageService = {
      run: jest.fn().mockImplementation(async ({ imageTag, state }) => {
        if (!imageTag) {
          state.stageResults.push(
            builderRunSupportService.toSkippedStage(
              BuildStage.DEPLOY,
              'DEPLOY_SKIPPED',
            ),
            builderRunSupportService.toSkippedStage(
              BuildStage.PROBES,
              'PROBES_SKIPPED',
            ),
            builderRunSupportService.toSkippedStage(
              BuildStage.STABILITY,
              'STABILITY_SKIPPED',
            ),
          );
          return null;
        }

        const shouldFailDeploy =
          scenario === 'deploy_fail_then_recover' && buildAttempt === 1;
        state.currentAttemptDiagnostics.executionNetworkName = `net-${buildAttempt}`;
        if (shouldFailDeploy) {
          state.currentAttemptDiagnostics.containerLogs =
            'ModuleNotFoundError: No module named psycopg2';
          state.currentAttemptDiagnostics.containerLogTail = [
            'ModuleNotFoundError: No module named psycopg2',
          ];
        }
        state.stageResults.push(
          builderRunSupportService.toManualStage(
            BuildStage.DEPLOY,
            shouldFailDeploy ? StageStatus.FAIL : StageStatus.PASS,
            shouldFailDeploy ? 'DEPLOY_SERVICE_FAILED' : 'DEPLOY_SERVICE_READY',
          ),
          builderRunSupportService.toManualStage(
            BuildStage.PROBES,
            shouldFailDeploy ? StageStatus.SKIP : StageStatus.PASS,
            shouldFailDeploy ? 'PROBES_SKIPPED' : 'PROBES_OK',
          ),
          builderRunSupportService.toManualStage(
            BuildStage.STABILITY,
            shouldFailDeploy ? StageStatus.SKIP : StageStatus.PASS,
            shouldFailDeploy ? 'STABILITY_SKIPPED' : 'STABILITY_OK',
          ),
        );
        return `net-${buildAttempt}`;
      }),
    };
    const builderValidationStageService = {
      runTests: jest
        .fn()
        .mockImplementation(async ({ executionNetworkName, state }) => {
          const status =
            scenario === 'tests_fail' && executionNetworkName
              ? StageStatus.FAIL
              : executionNetworkName
                ? StageStatus.PASS
                : StageStatus.SKIP;
          state.stageResults.push(
            builderRunSupportService.toManualStage(
              BuildStage.TESTS,
              status,
              status === StageStatus.FAIL
                ? 'TESTS_FAILED'
                : status === StageStatus.PASS
                  ? 'TESTS_OK'
                  : 'TESTS_SKIPPED_NO_RUNTIME',
            ),
          );
        }),
      collectRuntimeEvents: jest
        .fn()
        .mockImplementation(async ({ state, executionNetworkName }) => {
          if (executionNetworkName) {
            state.currentAttemptDiagnostics.runtimeEvents =
              'Back-off restarting failed container';
          }
        }),
    };
    const builderCleanupStageService = {
      run: jest.fn().mockImplementation(async ({ state }) => {
        state.stageResults.push(
          builderRunSupportService.toManualStage(
            BuildStage.CLEANUP,
            StageStatus.PASS,
            'CLEANUP_OK',
          ),
        );
      }),
    };

    const repairedAssessment =
      scenario === 'deploy_fail_then_recover'
        ? buildAssessment({
            recipe: {
              ...buildAssessment().recipe,
              install: [
                ['python', '-m', 'pip', 'install', '-r', 'requirements.txt'],
                ['python', '-m', 'pip', 'install', 'psycopg2-binary'],
              ],
            },
          })
        : buildAssessment({
            recipe: {
              ...buildAssessment().recipe,
              systemPackages: ['libpq-dev'],
            },
          });

    const builderRepairLlmService = {
      isEnabled: jest.fn().mockReturnValue(true),
      repair: jest.fn().mockImplementation(async () => ({
        model: 'dockus-builder-plan',
        assessment:
          scenario === 'build_fail_no_change'
            ? buildAssessment()
            : repairedAssessment,
      })),
    };
    const builderReportService = new BuilderReportService();

    const service = new BuilderStandardPipelineService(
      {
        analyze: jest
          .fn()
          .mockResolvedValue({ findings: [], portabilityRisks: [] }),
      } as never,
      {
        analyze: jest.fn().mockResolvedValue({
          issues: [
            {
              tool: 'ruff',
              ruleId: 'F821',
              severity: 'high',
              axis: 'quality',
              message: 'Undefined name',
              file: 'app.py',
              line: 10,
              column: 2,
            },
          ] satisfies StaticReviewIssue[],
          warnings: [],
        }),
      } as never,
      {
        isEnabled: jest.fn().mockReturnValue(true),
        generatePlan: jest.fn().mockResolvedValue({
          model: 'dockus-builder-plan',
          assessment: buildAssessment(),
        }),
      } as never,
      builderRepairLlmService as never,
      {
        isEnabled: jest.fn().mockReturnValue(true),
        evaluate: jest
          .fn()
          .mockImplementation(async ({ planningAssessment }) => ({
            model: 'dockus-builder-eval',
            assessment: planningAssessment,
          })),
      } as never,
      {
        isEnabled: jest.fn().mockReturnValue(true),
        generate: jest.fn().mockResolvedValue(emptyFeedback),
      } as never,
      {
        render: jest.fn().mockReturnValue('FROM python:3.11'),
      } as never,
      executionAdapter,
      evidenceService as never,
      builderReportService,
      {
        prepareWorkspace: jest.fn().mockResolvedValue({
          projectRootDir,
          runtimeFiles,
          hasTeacherTests: false,
          warnings: [],
        }),
      } as never,
      builderRunSupportService,
      builderPreflightService,
      builderBuildStageService as never,
      builderDeployStageService as never,
      builderValidationStageService as never,
      builderCleanupStageService as never,
      {
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'BUILDER_SELF_HEAL_MAX_ATTEMPTS') {
            return 3;
          }
          return defaultValue;
        }),
      } as unknown as ConfigService,
    );

    return {
      service,
      run,
      delivery,
      builderBuildStageService,
      builderRepairLlmService,
      builderValidationStageService,
      evidenceService,
    };
  }

  it('reintenta si falla el build y la receta cambia', async () => {
    const ctx = createService('build_fail_then_recover');

    const outcome = await ctx.service.execute(ctx.run, ctx.delivery);

    expect(ctx.builderBuildStageService.run).toHaveBeenCalledTimes(2);
    expect(ctx.builderRepairLlmService.repair).toHaveBeenCalledTimes(1);
    expect(outcome.runtimeOutputs.selfHealingTrace).toHaveLength(1);
    expect(ctx.evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      'run-1',
      BuildRunArtifactType.STATIC_REVIEW,
      expect.any(Object),
    );
    expect(ctx.evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      'run-1',
      BuildRunArtifactType.SELF_HEALING_TRACE,
      expect.any(Array),
    );
  });

  it('reintenta si falla el arranque del contenedor y hay evidencia útil', async () => {
    const ctx = createService('deploy_fail_then_recover');

    const outcome = await ctx.service.execute(ctx.run, ctx.delivery);

    expect(ctx.builderBuildStageService.run).toHaveBeenCalledTimes(2);
    expect(ctx.builderRepairLlmService.repair).toHaveBeenCalledTimes(1);
    expect(outcome.report.selfHealing.attempted).toBe(true);
  });

  it('corta el bucle si la receta propuesta no cambia', async () => {
    const ctx = createService('build_fail_no_change');

    const outcome = await ctx.service.execute(ctx.run, ctx.delivery);

    expect(ctx.builderBuildStageService.run).toHaveBeenCalledTimes(1);
    expect(ctx.builderRepairLlmService.repair).toHaveBeenCalledTimes(1);
    expect(outcome.runtimeOutputs.selfHealingTrace[0]?.outcome).toBe(
      'unchanged',
    );
  });

  it('no activa self-healing cuando fallan los tests', async () => {
    const ctx = createService('tests_fail');

    const outcome = await ctx.service.execute(ctx.run, ctx.delivery);

    expect(ctx.builderBuildStageService.run).toHaveBeenCalledTimes(1);
    expect(ctx.builderRepairLlmService.repair).not.toHaveBeenCalled();
    expect(ctx.builderValidationStageService.runTests).toHaveBeenCalledTimes(1);
    expect(outcome.report.overallOutcome).toBe('FAIL');
  });
});
