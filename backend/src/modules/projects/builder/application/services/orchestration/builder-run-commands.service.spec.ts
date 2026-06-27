// @ts-nocheck
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';

import { buildDelivery } from '../../../../../test-support/domain-builders';
import { UserRole } from '../../../../users/entities/user.entity';
import {
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  BuilderPlanContractV2,
  BuilderLlmStageTrace,
  EvidenceArtifactPublic,
} from '../../domain/builder.types';
import { BuildRunArtifactType } from '../../domain/entities/build-run-artifact.entity';
import { BuildRun, BuildRunStatus } from '../../domain/entities/build-run.entity';
import { EvidenceService } from '../../infrastructure/evidence/evidence.service';
import { Delivery, DeliveryStatus } from '../../../deliveries/entities/delivery.entity';
import { BuilderLlmEvaluatorService } from '../../domain/ai/builder-llm-evaluator.service';
import { BuilderAccessService } from './builder-access.service';
import { BuilderRunCommandsService } from './builder-run-commands.service';
import { BuilderRunQueriesService } from './builder-run-queries.service';
import { BuilderRunSupportService } from './builder-run-support.service';
import { BuilderWorkspaceService } from './builder-workspace.service';
import { BuilderCacheManagerService } from './builder-cache-manager.service';
import { BuilderPedagogicalService } from './builder-pedagogical.service';
import { BuilderCodeQualityService } from '../../domain/ai/builder-code-quality.service';
import { DEFAULT_BASE_C_IMAGE } from '../../domain/builder.constants';
import { CodeQualityFindingEntity } from '../../domain/entities/code-quality-finding.entity';

function createArtifact(
  type: BuildRunArtifactType,
  idSuffix = type.toLowerCase(),
): EvidenceArtifactPublic {
  return {
    id: `artifact-${idSuffix}`,
    type,
    contentType: type.endsWith('PARSED') || type === BuildRunArtifactType.REPORT_JSON
      ? 'application/json'
      : 'text/plain; charset=utf-8',
    sizeBytes: 128,
    createdAt: '2026-05-05T10:00:00.000Z',
  };
}

function buildPlanContract(
  overrides: Partial<BuilderPlanContractV2> = {},
): BuilderPlanContractV2 {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'plan',
    thought: 'Plan razonado.',
    structuralType: 'T4',
    capabilities: {
      C1: { status: 'yes', rationale: 'Manifest presente.' },
      C2: { status: 'yes', rationale: 'Comando run detectado.' },
      C3: { status: 'no', rationale: 'Sin servicio persistente.' },
      C4: { status: 'yes', rationale: 'Tests detectados.' },
      C5: { status: 'no', rationale: 'Sin healthcheck.' },
      C6: { status: 'no', rationale: 'Sin configuración externa.' },
    },
    evaluativeState: 'E2',
    confidence: 'high',
    rationale: 'Plan consistente.',
    externalRequirements: [],
    runtime: {
      family: 'node',
      version: '20',
      supported: false,
      reason: 'Solo Python es ejecutable en esta iteración.',
    },
    recipe: {
      install: [],
      run: ['npm', 'start'],
      test: [],
      systemPackages: [],
      cwd: '/workspace',
      environment: { PORT: '3000' },
      service: null,
    },
    evidenceSummary: '',
    observedEvidence: [],
    evaluationLimits: [],
    ...overrides,
  };
}

function buildEvaluationContract(
  overrides: Partial<BuilderEvaluationContractV2> = {},
): BuilderEvaluationContractV2 {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: 'evaluation',
    thought: 'Evaluación razonada.',
    structuralType: 'T4',
    capabilities: {
      C1: { status: 'yes', rationale: 'Manifest presente.' },
      C2: { status: 'yes', rationale: 'Comando válido.' },
      C3: { status: 'no', rationale: 'Sin servicio persistente.' },
      C4: { status: 'yes', rationale: 'Tests observados.' },
      C5: { status: 'no', rationale: 'Sin healthcheck.' },
      C6: { status: 'no', rationale: 'Sin configuración externa.' },
    },
    evaluativeState: 'E1',
    confidence: 'high',
    rationale: 'Resultado consistente.',
    recommendedGrade: 8,
    externalRequirements: [],
    runtime: {
      family: 'node',
      version: '20',
      supported: false,
      reason: 'Solo Python es ejecutable en esta iteración.',
    },
    recipe: {
      install: [],
      run: ['npm', 'start'],
      test: [],
      systemPackages: [],
      cwd: '/workspace',
      environment: { PORT: '3000' },
      service: null,
    },
    evidenceSummary: 'Salida coherente.',
    observedEvidence: ['No se ejecutó runtime porque el plan es declarativo.'],
    evaluationLimits: [],
    ...overrides,
  };
}

function buildTrace<TContract extends BuilderPlanContractV2 | BuilderEvaluationContractV2>(
  overrides: Partial<BuilderLlmStageTrace<TContract>>,
): BuilderLlmStageTrace<TContract> {
  return {
    schemaVersion: 'builder-llm/v2',
    stage: overrides.stage ?? 'plan',
    model: overrides.stage === 'evaluation' ? 'eval-model' : 'plan-model',
    systemPrompt: 'SYSTEM',
    prompt: 'PROMPT',
    rawResponse: null,
    parsedContract: null,
    error: null,
    createdAt: '2026-05-05T10:00:00.000Z',
    ...overrides,
  } as BuilderLlmStageTrace<TContract>;
}

describe.skip('BuilderRunCommandsService', () => {
  const run = {
    id: 'run-1',
    deliveryId: 'delivery-1',
    triggeredById: 'teacher-1',
    status: BuildRunStatus.QUEUED,
    warnings: [],
  } as unknown as BuildRun;

  let buildRunsRepository: {
    findOne: jest.MockedFunction<Repository<BuildRun>['findOne']>;
    save: jest.MockedFunction<Repository<BuildRun>['save']>;
  };
  let deliveriesRepository: {
    save: jest.MockedFunction<Repository<Delivery>['save']>;
    findOne: jest.MockedFunction<Repository<Delivery>['findOne']>;
  };
  let builderAccessService: {
    findDeliveryOrThrow: jest.MockedFunction<
      BuilderAccessService['findDeliveryOrThrow']
    >;
  };
  let builderRunSupportService: {
    emitEvent: jest.MockedFunction<BuilderRunSupportService['emitEvent']>;
    markRunAsFailed: jest.MockedFunction<
      BuilderRunSupportService['markRunAsFailed']
    >;
    toErrorMessage: jest.MockedFunction<BuilderRunSupportService['toErrorMessage']>;
  };
  let builderWorkspaceService: {
    prepareWorkspace: jest.MockedFunction<BuilderWorkspaceService['prepareWorkspace']>;
  };
  let builderLlmEvaluatorService: {
    planWithTrace: jest.MockedFunction<
      BuilderLlmEvaluatorService['planWithTrace']
    >;
    evaluateWithTrace: jest.MockedFunction<
      BuilderLlmEvaluatorService['evaluateWithTrace']
    >;
  };
  let evidenceService: {
    persistTextArtifact: jest.MockedFunction<EvidenceService['persistTextArtifact']>;
    persistJsonArtifact: jest.MockedFunction<EvidenceService['persistJsonArtifact']>;
  };
  let projectRuntimeService: {
  };
  let builderCodeQualityService: {
    analyze: jest.MockedFunction<BuilderCodeQualityService['analyze']>;
    analyzeWithTrace: jest.MockedFunction<any>;
  };
  let builderPedagogicalService: {
    generateFeedback: jest.Mock;
    formatFeedbackForStudent: jest.Mock;
    toTechnicalFeedbackItems: jest.Mock;
  };
  let codeQualityFindingsRepository: {
    delete: jest.MockedFunction<Repository<CodeQualityFindingEntity>['delete']>;
    save: jest.MockedFunction<Repository<CodeQualityFindingEntity>['save']>;
  };
  let service: BuilderRunCommandsService;

  beforeEach(() => {
    const delivery = buildDelivery({
      id: run.deliveryId,
      status: DeliveryStatus.DRAFT,
    });

    buildRunsRepository = {
      findOne: jest.fn().mockResolvedValue(run),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    deliveriesRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn().mockResolvedValue(delivery),
    };
    builderAccessService = {
      findDeliveryOrThrow: jest.fn().mockResolvedValue(delivery),
    };
    builderRunSupportService = {
      emitEvent: jest.fn().mockResolvedValue(undefined),
      markRunAsFailed: jest.fn().mockResolvedValue(undefined),
      toErrorMessage: jest
        .fn()
        .mockImplementation((error: unknown) =>
          error instanceof Error ? error.message : String(error),
        ),
    };
    builderWorkspaceService = {
      prepareWorkspace: jest.fn(),
    };
    builderLlmEvaluatorService = {
      planWithTrace: jest.fn(),
      evaluateWithTrace: jest.fn(),
    };
    evidenceService = {
      persistTextArtifact: jest
        .fn()
        .mockImplementation(async (_runId, type) => createArtifact(type)),
      persistJsonArtifact: jest
        .fn()
        .mockImplementation(async (_runId, type) => createArtifact(type)),
    };
    builderCodeQualityService = {
      analyze: jest.fn().mockResolvedValue({
        thought: 'Calidad OK.',
        security: [],
        architecture: [],
        quality: [],
        rubricCompliance: [],
      }),
      analyzeWithTrace: jest.fn().mockResolvedValue({
        model: 'quality-model',
        systemPrompt: 'QUALITY_SYSTEM',
        prompt: 'QUALITY_PROMPT',
        rawResponse: JSON.stringify({
          thought: 'Calidad OK.',
          security: [],
          architecture: [],
          quality: [],
          rubricCompliance: [],
        }),
        parsedContract: {
          thought: 'Calidad OK.',
          security: [],
          architecture: [],
          quality: [],
          rubricCompliance: [],
        },
        error: null,
        createdAt: '2026-05-05T10:02:00.000Z',
      }),
    };
    builderPedagogicalService = {
      generateFeedback: jest.fn().mockReturnValue([]),
      formatFeedbackForStudent: jest.fn().mockReturnValue(''),
      toTechnicalFeedbackItems: jest.fn().mockReturnValue([]),
    };
    codeQualityFindingsRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 } as never),
      save: jest.fn().mockImplementation(async (value) => value as never),
    };

    service = new BuilderRunCommandsService(
      buildRunsRepository as unknown as Repository<BuildRun>,
      deliveriesRepository as unknown as Repository<Delivery>,
      codeQualityFindingsRepository as unknown as Repository<CodeQualityFindingEntity>,
      { add: jest.fn() } as never,
      builderAccessService as unknown as BuilderAccessService,
      {} as BuilderRunQueriesService,
      builderRunSupportService as unknown as BuilderRunSupportService,
      builderWorkspaceService as unknown as BuilderWorkspaceService,
      builderLlmEvaluatorService as unknown as BuilderLlmEvaluatorService,
      {
        get: jest.fn((_key: string, fallback?: unknown) => fallback),
      } as never,
      evidenceService as unknown as EvidenceService,
      { calculateCacheInfo: jest.fn() } as unknown as BuilderCacheManagerService,
      {
        generateFeedback: builderPedagogicalService.generateFeedback,
        formatFeedbackForStudent: builderPedagogicalService.formatFeedbackForStudent,
        toTechnicalFeedbackItems:
          builderPedagogicalService.toTechnicalFeedbackItems,
      } as unknown as BuilderPedagogicalService,
      builderCodeQualityService as unknown as BuilderCodeQualityService,
    );
  });

  it('persists planner and evaluator debug artifacts plus the final report json', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-success-'));
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: ['warning-1'],
    });

    const planContract = buildPlanContract();
    const evaluationContract = buildEvaluationContract();
    builderLlmEvaluatorService.planWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          createdAt: '2026-05-05T10:00:00.000Z',
        });

        return buildTrace<BuilderPlanContractV2>({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          rawResponse: JSON.stringify(planContract),
          parsedContract: planContract,
        });
      },
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          stage: 'evaluation',
          model: 'eval-model',
          systemPrompt: 'EVAL_SYSTEM',
          prompt: 'EVAL_PROMPT',
          createdAt: '2026-05-05T10:01:00.000Z',
        });

        return buildTrace<BuilderEvaluationContractV2>({
          stage: 'evaluation',
          model: 'eval-model',
          systemPrompt: 'EVAL_SYSTEM',
          prompt: 'EVAL_PROMPT',
          rawResponse: JSON.stringify(evaluationContract),
          parsedContract: evaluationContract,
        });
      },
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RUN_STATUS_CHANGED',
        payload: expect.objectContaining({ studentStage: 'building' }),
      }),
    );
    expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'LOG_CHUNK',
        payload: expect.objectContaining({ studentStage: 'evaluating' }),
      }),
    );
    expect(builderRunSupportService.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'RUN_COMPLETED',
        payload: expect.objectContaining({ studentStage: 'completed' }),
      }),
    );

    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_PROMPT,
      expect.stringContaining('PLAN_PROMPT'),
    );
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
      expect.stringContaining('"stage":"plan"'),
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_PARSED,
      planContract,
    );
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_EVAL_PROMPT,
      expect.stringContaining('EVAL_PROMPT'),
    );
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_EVAL_RAW_RESPONSE,
      expect.stringContaining('"stage":"evaluation"'),
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_EVAL_PARSED,
      evaluationContract,
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.REPORT_JSON,
      expect.objectContaining({
        overallOutcome: 'PASS',
        llmRecommendations: [],
        coaching: expect.objectContaining({
          passReadiness: 'READY_WITH_SUGGESTIONS',
          mustFix: [],
          shouldImprove: [],
          strengths: [],
          nextAttemptChecklist: [],
        }),
        technicalFeedback: expect.objectContaining({
          security: [],
          architecture: [],
          quality: [],
          rubricCompliance: [],
        }),
      }),
    );
  });

  it('keeps manual grader notes untouched while still transitioning deliveries from IN_REVIEW to EVALUATED', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-manual-notes-'));
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    const delivery = buildDelivery({
      id: run.deliveryId,
      status: DeliveryStatus.IN_REVIEW,
      graderNotes: 'Comentario docente oficial.',
    });
    deliveriesRepository.findOne.mockResolvedValue(delivery);
    builderAccessService.findDeliveryOrThrow.mockResolvedValue(delivery);

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract();
    const evaluationContract = buildEvaluationContract({
      evidenceSummary: 'La salida observada coincide con el oraculo.',
    });
    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    (
      builderPedagogicalService.formatFeedbackForStudent as jest.Mock
    ).mockReturnValue('\nSugerencia pedagogica.');

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(deliveriesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: delivery.id,
        status: DeliveryStatus.EVALUATED,
        graderNotes: 'Comentario docente oficial.',
      }),
    );
  });

  it('uses the gcc base image and direct compile commands for C plans', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-c-success-'));
    const filePath = path.join(tempDir, 'main.c');
    writeFileSync(
      filePath,
      '#include <stdio.h>\nint main(void) { puts("ok"); return 0; }\n',
      'utf8',
    );

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.c',
          absolutePath: filePath,
          sizeBytes: 60,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      capabilities: {
        C1: { status: 'yes', rationale: 'Proyecto C compilable.' },
        C2: { status: 'yes', rationale: 'CLI compilable.' },
        C3: { status: 'no', rationale: 'Sin servicio persistente.' },
        C4: { status: 'yes', rationale: 'Pruebas batch posibles.' },
        C5: { status: 'no', rationale: 'Sin healthcheck.' },
        C6: { status: 'no', rationale: 'Sin configuracion externa.' },
      },
      recipe: {
        install: [['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: ['gcc', 'make'],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: ['gcc', 'make'],
        cwd: '/app',
        environment: null,
        service: null,
      },
      observedEvidence: [
        'Compilacion C completada sin errores fatales.',
        'El binario ./main produjo stdout.',
        'No se detectaron servicios persistentes en la ejecucion.',
      ],
    });

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        model: 'plan-model',
        systemPrompt: 'PLAN_SYSTEM',
        prompt: 'PLAN_PROMPT',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        model: 'eval-model',
        systemPrompt: 'EVAL_SYSTEM',
        prompt: 'EVAL_PROMPT',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(projectRuntimeService.executeEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        image: DEFAULT_BASE_C_IMAGE,
        command: [
          'sh',
          '-c',
          expect.stringContaining('gcc -Wall -Wextra -std=c11 main.c -o main && ./main'),
        ],
      }),
    );

    const commandString = projectRuntimeService.executeEphemeral.mock.calls[0]?.[0]
      ?.command?.[2];
    expect(commandString).not.toContain('python -m pip');
    expect(commandString).not.toContain('apt-get update');
  });

  it('passes run arguments inferred by the planner through to the ephemeral execution command', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-c-args-'));
    const filePath = path.join(tempDir, 'main.c');
    writeFileSync(
      filePath,
      '#include <stdio.h>\nint main(int argc, char **argv) { return argc < 3; }\n',
      'utf8',
    );

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.c',
          absolutePath: filePath,
          sizeBytes: 72,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'calculator']],
        run: ['./calculator', '7', '8'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });

    const evaluationContract = buildEvaluationContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-Wall', '-Wextra', '-std=c11', 'main.c', '-o', 'calculator']],
        run: ['./calculator', '7', '8'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
      observedEvidence: [
        'Compilacion C completada.',
        'El binario ./calculator se ejecuto con argumentos explícitos.',
        'EXIT CODE: 0',
      ],
    });

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(projectRuntimeService.executeEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        command: [
          'sh',
          '-c',
          expect.stringContaining('./calculator 7 8'),
        ],
      }),
    );
  });

  it('persists planner raw output and error artifacts when the planning trace fails', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-plan-error-'));
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    builderLlmEvaluatorService.planWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          createdAt: '2026-05-05T10:00:00.000Z',
        });

        return buildTrace<BuilderPlanContractV2>({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          rawResponse: 'not-json',
          error: {
            name: 'Error',
            message: 'La salida del planner LLM no es JSON válido.',
            stack: 'trace',
            timestamp: '2026-05-05T10:00:02.000Z',
          },
        });
      },
    );

    await expect(
      service.processBuildRunJob({
        buildRunId: run.id,
        deliveryId: run.deliveryId,
        actor: {
          userId: 'teacher-1',
          email: 'teacher@dockus.test',
          role: UserRole.TEACHER,
        },
      }),
    ).rejects.toThrow('La salida del planner LLM no es JSON válido.');

    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_PROMPT,
      expect.stringContaining('PLAN_PROMPT'),
    );
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
      'not-json',
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_PLAN_ERROR,
      expect.objectContaining({
        stage: 'plan',
        model: 'plan-model',
        error: expect.objectContaining({
          message: 'La salida del planner LLM no es JSON válido.',
        }),
      }),
    );
    expect(builderLlmEvaluatorService.evaluateWithTrace).not.toHaveBeenCalled();
    expect(builderRunSupportService.markRunAsFailed).toHaveBeenCalledWith(
      run.id,
      'La salida del planner LLM no es JSON válido.',
    );
  });
  it('degrades to a fallback evaluation when the evaluator trace is invalid', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const tempDir = mkdtempSync(
      path.join(tmpdir(), 'builder-run-eval-fallback-'),
    );
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'python',
        version: '3.10',
        supported: true,
        reason: null,
      },
      capabilities: {
        C1: { status: 'yes', rationale: 'FastAPI detectado.' },
        C2: { status: 'unknown', rationale: 'Sin auth.' },
        C3: { status: 'yes', rationale: 'Servicio HTTP detectado.' },
        C4: { status: 'unknown', rationale: 'Sin tests observados.' },
        C5: { status: 'yes', rationale: 'Healthcheck inferido.' },
        C6: { status: 'unknown', rationale: 'Sin configuración externa.' },
      },
      recipe: {
        install: [['python', '-m', 'pip', 'install', '-r', 'requirements.txt']],
        run: ['uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'],
        test: [],
        systemPackages: ['curl'],
        cwd: '/app',
        environment: { APP_ENV: 'test' },
        service: {
          port: 8000,
          healthcheck: ['curl', '-sf', 'http://localhost:8000/health'],
        },
      },
    });

    builderLlmEvaluatorService.planWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          createdAt: '2026-05-05T10:00:00.000Z',
        });

        return buildTrace<BuilderPlanContractV2>({
          stage: 'plan',
          model: 'plan-model',
          systemPrompt: 'PLAN_SYSTEM',
          prompt: 'PLAN_PROMPT',
          rawResponse: JSON.stringify(planContract),
          parsedContract: planContract,
        });
      },
    );

    builderLlmEvaluatorService.evaluateWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          stage: 'evaluation',
          model: 'eval-model',
          systemPrompt: 'EVAL_SYSTEM',
          prompt: 'EVAL_PROMPT',
          createdAt: '2026-05-05T10:01:00.000Z',
        });

        return buildTrace<BuilderEvaluationContractV2>({
          stage: 'evaluation',
          model: 'eval-model',
          systemPrompt: 'EVAL_SYSTEM',
          prompt: 'EVAL_PROMPT',
          rawResponse: '{"schemaVersion":"builder-llm/v2"}',
          error: {
            name: 'Error',
            message: 'capabilities.C6 debe ser un objeto.',
            stack: 'trace',
            timestamp: '2026-05-05T10:01:02.000Z',
          },
        });
      },
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(builderRunSupportService.markRunAsFailed).not.toHaveBeenCalled();
    expect(buildRunsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BuildRunStatus.SUCCESS,
        llmAssessment: expect.objectContaining({
          stage: 'evaluation',
          structuralType: 'T1',
          evaluativeState: 'E3',
          confidence: 'low',
          evidenceSummary: expect.stringContaining('Evaluación degradada'),
          evaluationLimits: expect.arrayContaining([
            expect.stringContaining('capabilities.C6 debe ser un objeto.'),
          ]),
          observedEvidence: expect.arrayContaining([
            expect.stringContaining(
              'El evaluador LLM devolvió un contrato inválido',
            ),
          ]),
        }),
      }),
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.REPORT_JSON,
      expect.objectContaining({
        overallOutcome: 'FAIL',
        coaching: expect.objectContaining({
          passReadiness: 'BLOCKED',
        }),
        technicalFeedback: expect.objectContaining({
          security: [],
          architecture: [],
          quality: [],
          rubricCompliance: [],
        }),
      }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"evaluation"'),
    );
    warnSpy.mockRestore();
  });

  it('logs execution failures separately from LLM contract degradation', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-exec-fail-'));
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'python',
        version: '3.11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [],
        run: ['python', 'main.py'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T1',
      runtime: {
        family: 'python',
        version: '3.11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [],
        run: ['python', 'main.py'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    projectRuntimeService.executeEphemeral.mockRejectedValue(
      new Error('permission denied'),
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"execution_failure"'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('permission denied'),
    );
    warnSpy.mockRestore();
  });

  it('persists quality prompt/raw/parsed artifacts and stores codeQualityFindings', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-quality-'));
    const filePath = path.join(tempDir, 'main.c');
    writeFileSync(
      filePath,
      '#include <stdio.h>\nint main(void) { puts("ok"); return 0; }\n',
      'utf8',
    );

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.c',
          absolutePath: filePath,
          sizeBytes: 60,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-Wall', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T1',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-Wall', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const qualityContract: BuilderCodeQualityContractV2 = {
      thought: 'Hallazgos relevantes.',
      security: [
        {
          title: 'sprintf inseguro',
          detail:
            'Observación: se usa sprintf. Impacto: buffer overflow. Recomendación: usa snprintf.',
          severity: 'high',
          file: 'main.c',
          line: 8,
        },
      ],
      architecture: [],
      quality: [],
      rubricCompliance: [],
    };

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    builderCodeQualityService.analyzeWithTrace.mockImplementation(
      async (_input, hooks) => {
        await hooks?.onBeforeCall?.({
          model: 'quality-model',
          systemPrompt: 'QUALITY_SYSTEM',
          prompt: 'QUALITY_PROMPT',
          createdAt: '2026-05-05T10:02:00.000Z',
        });

        return {
          model: 'quality-model',
          systemPrompt: 'QUALITY_SYSTEM',
          prompt: 'QUALITY_PROMPT',
          rawResponse: JSON.stringify(qualityContract),
          parsedContract: qualityContract,
          error: null,
          createdAt: '2026-05-05T10:02:00.000Z',
        };
      },
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(builderCodeQualityService.analyzeWithTrace).toHaveBeenCalled();
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_QUALITY_PROMPT,
      expect.stringContaining('QUALITY_PROMPT'),
    );
    expect(evidenceService.persistTextArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_QUALITY_RAW_RESPONSE,
      expect.stringContaining('"sprintf inseguro"'),
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.LLM_QUALITY_PARSED,
      qualityContract,
    );
    expect(buildRunsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        codeQualityFindings: qualityContract,
      }),
    );
    expect(codeQualityFindingsRepository.delete).toHaveBeenCalledWith({
      projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
      studentId: '44444444-4444-4444-4444-444444444444',
    });
    expect(codeQualityFindingsRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          buildRunId: run.id,
          projectId: '5a6f2626-c78c-4842-b180-f1ca0a3f2d53',
          studentId: '44444444-4444-4444-4444-444444444444',
          category: 'security',
          title: 'sprintf inseguro',
        }),
      ]),
    );
  });

  it('composes a canonical coaching report with must-fix items, optional improvements and strengths', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-coaching-'));
    const filePath = path.join(tempDir, 'main.c');
    writeFileSync(filePath, 'int main(void) { return 0; }\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.c',
          absolutePath: filePath,
          sizeBytes: 29,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T2',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T2',
      evaluativeState: 'E3',
      confidence: 'medium',
      rationale: 'La compilacion no llega a producir un binario valido.',
      observedEvidence: [
        'gcc reporto un error de sintaxis.',
        'No se genero el binario esperado.',
        'EXIT CODE: 1',
      ],
      evaluationLimits: [
        'La compilacion fallo antes de poder validar la salida esperada.',
      ],
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const qualityContract: BuilderCodeQualityContractV2 = {
      thought: 'Hallazgos mezclados.',
      security: [],
      architecture: [
        {
          title: 'BUENA PRACTICA: validacion temprana',
          detail:
            'Observacion: validas los argumentos de entrada. Impacto: reduces errores. Recomendacion: manten este patron.',
          severity: 'low',
          file: 'main.c',
          line: 3,
        },
      ],
      quality: [
        {
          title: 'Demasiados if consecutivos',
          detail:
            'Observacion: la logica repite ramas similares. Impacto: complica el mantenimiento. Recomendacion: usa un for o extrae una funcion auxiliar.',
          severity: 'medium',
          file: 'main.c',
          line: 18,
        },
      ],
      rubricCompliance: [
        {
          title: 'La salida no coincide con la rubrica',
          detail:
            'Observacion: el resultado no coincide con el oraculo. Impacto: impide aprobar la practica. Recomendacion: revisa el calculo final.',
          severity: 'high',
          file: 'main.c',
          line: 22,
        },
      ],
    };

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      model: 'quality-model',
      systemPrompt: 'QUALITY_SYSTEM',
      prompt: 'QUALITY_PROMPT',
      rawResponse: JSON.stringify(qualityContract),
      parsedContract: qualityContract,
      error: null,
      createdAt: '2026-05-05T10:03:00.000Z',
    });
    builderPedagogicalService.generateFeedback.mockReturnValue([
      {
        concept: 'Sintaxis y Analisis Estatico',
        explanation: 'La compilacion falla por un error de sintaxis.',
        advice: "Anade ';' y recompila antes de reenviar.",
      },
    ]);
    builderPedagogicalService.toTechnicalFeedbackItems.mockReturnValue([
      {
        title: 'Sintaxis y Analisis Estatico',
        detail:
          "Observacion: la compilacion falla por un error de sintaxis. Impacto: el programa no se puede validar. Recomendacion: anade ';' y recompila antes de reenviar.",
        severity: 'high',
        file: null,
        line: null,
      },
    ]);

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(buildRunsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        report: expect.objectContaining({
          overallOutcome: 'FAIL',
          llmRecommendations: expect.arrayContaining([
            expect.stringMatching(/anade|recompila/i),
          ]),
          coaching: expect.objectContaining({
            passReadiness: 'BLOCKED',
            mustFix: expect.arrayContaining([
              expect.objectContaining({
                title: 'Sintaxis y Analisis Estatico',
              }),
              expect.objectContaining({
                title: 'La salida no coincide con la rubrica',
              }),
            ]),
            shouldImprove: expect.arrayContaining([
              expect.objectContaining({
                title: 'Demasiados if consecutivos',
              }),
            ]),
            strengths: expect.arrayContaining([
              expect.objectContaining({
                title: 'BUENA PRACTICA: validacion temprana',
              }),
            ]),
            nextAttemptChecklist: expect.arrayContaining([
              expect.stringContaining('recompila'),
            ]),
          }),
          technicalFeedback: expect.objectContaining({
            rubricCompliance: expect.arrayContaining([
              expect.objectContaining({
                title: 'La salida no coincide con la rubrica',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(evidenceService.persistJsonArtifact).toHaveBeenCalledWith(
      run.id,
      BuildRunArtifactType.REPORT_JSON,
      expect.objectContaining({
        coaching: expect.objectContaining({
          passReadiness: 'BLOCKED',
        }),
      }),
    );
  });

  it('falls back to pedagogical must-fix guidance when quality analysis does not return usable findings', async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-coaching-fallback-'));
    const filePath = path.join(tempDir, 'main.py');
    writeFileSync(filePath, 'print("hello")\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.py',
          absolutePath: filePath,
          sizeBytes: 15,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T1',
      runtime: {
        family: 'python',
        version: '3.11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [],
        run: ['python', 'main.py'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T1',
      evaluativeState: 'E3',
      runtime: {
        family: 'python',
        version: '3.11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [],
        run: ['python', 'main.py'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
      evaluationLimits: [
        'La ejecucion fallo antes de validar el comportamiento esperado.',
      ],
    });

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      model: 'quality-model',
      systemPrompt: 'QUALITY_SYSTEM',
      prompt: 'QUALITY_PROMPT',
      rawResponse: '{"thought":"oops"}',
      parsedContract: null,
      error: {
        name: 'Error',
        message: 'quality debe ser un array.',
        stack: 'trace',
        timestamp: '2026-05-05T10:03:00.000Z',
      },
      createdAt: '2026-05-05T10:03:00.000Z',
    });
    builderPedagogicalService.generateFeedback.mockReturnValue([
      {
        concept: 'Sintaxis y Analisis Estatico',
        explanation: 'Python no puede interpretar el archivo.',
        advice: 'Revisa la sintaxis y ejecuta el script localmente.',
      },
    ]);
    builderPedagogicalService.toTechnicalFeedbackItems.mockReturnValue([
      {
        title: 'Sintaxis y Analisis Estatico',
        detail:
          'Observacion: Python no puede interpretar el archivo. Impacto: no se pudo validar la entrega. Recomendacion: revisa la sintaxis y ejecuta el script localmente.',
        severity: 'high',
        file: null,
        line: null,
      },
    ]);
    projectRuntimeService.executeEphemeral.mockRejectedValue(
      new Error('SyntaxError: invalid syntax'),
    );

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(buildRunsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        report: expect.objectContaining({
          coaching: expect.objectContaining({
            passReadiness: 'BLOCKED',
            mustFix: expect.arrayContaining([
              expect.objectContaining({
                title: 'Sintaxis y Analisis Estatico',
              }),
            ]),
          }),
        }),
      }),
    );
  });

  it('logs quality contract degradation separately when quality trace is invalid', async () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const tempDir = mkdtempSync(path.join(tmpdir(), 'builder-run-quality-degraded-'));
    const filePath = path.join(tempDir, 'main.c');
    writeFileSync(filePath, 'int main(void) { return 0; }\n', 'utf8');

    builderWorkspaceService.prepareWorkspace.mockResolvedValue({
      projectRootDir: tempDir,
      runtimeFiles: [
        {
          relativePath: 'main.c',
          absolutePath: filePath,
          sizeBytes: 29,
        },
      ],
      inputManifest: [],
      teacherTestRuntimeFiles: [],
      hasTeacherTests: false,
      warnings: [],
    });

    const planContract = buildPlanContract({
      structuralType: 'T2',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });
    const evaluationContract = buildEvaluationContract({
      structuralType: 'T2',
      runtime: {
        family: 'c',
        version: 'c11',
        supported: true,
        reason: null,
      },
      recipe: {
        install: [['gcc', '-std=c11', 'main.c', '-o', 'main']],
        run: ['./main'],
        test: [],
        systemPackages: [],
        cwd: '/app',
        environment: null,
        service: null,
      },
    });

    builderLlmEvaluatorService.planWithTrace.mockResolvedValue(
      buildTrace<BuilderPlanContractV2>({
        stage: 'plan',
        rawResponse: JSON.stringify(planContract),
        parsedContract: planContract,
      }),
    );
    builderLlmEvaluatorService.evaluateWithTrace.mockResolvedValue(
      buildTrace<BuilderEvaluationContractV2>({
        stage: 'evaluation',
        rawResponse: JSON.stringify(evaluationContract),
        parsedContract: evaluationContract,
      }),
    );
    builderCodeQualityService.analyzeWithTrace.mockResolvedValue({
      model: 'quality-model',
      systemPrompt: 'QUALITY_SYSTEM',
      prompt: 'QUALITY_PROMPT',
      rawResponse: '{"thought":"oops"}',
      parsedContract: null,
      error: {
        name: 'Error',
        message: 'security debe ser un array.',
        stack: 'trace',
        timestamp: '2026-05-05T10:03:00.000Z',
      },
      createdAt: '2026-05-05T10:03:00.000Z',
    });

    await service.processBuildRunJob({
      buildRunId: run.id,
      deliveryId: run.deliveryId,
      actor: {
        userId: 'teacher-1',
        email: 'teacher@dockus.test',
        role: UserRole.TEACHER,
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"stage":"quality"'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"reason":"invalid_contract"'),
    );
    warnSpy.mockRestore();
  });
});
