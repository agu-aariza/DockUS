/**
 * @fileoverview Orquesta la ejecución del pipeline de evaluación del builder.
 *
 * Contexto:
 * - Coordina las 6 stages del pipeline (workspace, plan, compile, execution,
 *   evaluation, quality, report) sin preocuparse del ciclo de vida del run.
 * - No persiste entidades ni emite eventos de ciclo de vida globales; eso
 *   permanece en `BuilderRunCommandsService`.
 *
 * @module BuilderPipelineOrchestrator
 */

import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';

import { Delivery } from '../../../../deliveries/entities/delivery.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV2,
  BuilderPlanContractV2,
  BuilderReportEntity,
  RubricCriterion,
} from '../../../domain/builder.types';
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
import { CompiledRecipe } from '../compilation/builder-recipe-compiler.service';
import { BuilderPipelineResult } from '../builder-application.types';

/** Extensiones cuyo contenido se incluye como código fuente en el prompt. */
const SOURCE_CODE_EXTENSIONS = [
  '.py',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cc',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.java',
  '.go',
  '.rs',
  '.rb',
  '.sh',
  '.md',
  '.txt',
  '.json',
  '.toml',
  '.yml',
  '.yaml',
  '.cfg',
  '.ini',
];

/** Ficheros sin extensión reconocibles que sí son código/configuración. */
const SOURCE_CODE_BASENAMES = new Set(['makefile', 'dockerfile', '.env']);

/** Directorios cuyo contenido se excluye del prompt aunque tenga extensión válida. */
const EXCLUDED_DIR_SEGMENTS = new Set([
  'node_modules',
  '__pycache__',
  '.git',
  'venv',
  '.venv',
  'dist',
  'build',
  'target',
]);

/** Los ficheros de código mayores que esto se omiten del prompt. */
const MAX_SOURCE_FILE_BYTES = 256 * 1024;

@Injectable()
export class BuilderPipelineOrchestrator {
  constructor(
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly builderPlanStageHandler: BuilderPlanStageHandler,
    private readonly builderCompileStageHandler: BuilderCompileStageHandler,
    private readonly builderExecutionStageHandler: BuilderExecutionStageHandler,
    private readonly builderEvaluationStageHandler: BuilderEvaluationStageHandler,
    private readonly builderQualityStageHandler: BuilderQualityStageHandler,
    private readonly builderReportStageHandler: BuilderReportStageHandler,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async runPipeline(
    run: BuildRun,
    delivery: Delivery,
  ): Promise<BuilderPipelineResult> {
    // El orquestador posee el ciclo de vida del workspace de principio a fin: lo
    // prepara, lo usa y lo limpia en el `finally`. El llamante ya no necesita
    // saber que existe, ni recibir su handle a través del objeto de error.
    const workspace = await this.prepareWorkspace(run, delivery);

    try {
      const assignmentContext = this.buildAssignmentContext(delivery);
      const sourceCodePayload = await this.buildSourceCodePayload(workspace);

      const planAssessment = await this.runPlanStage(
        run.id,
        sourceCodePayload,
        assignmentContext,
      );

      const { compiled, executionLogs: compileLogs } =
        await this.runCompileStage(run.id, planAssessment, workspace);

      const executionLogs = compiled.executable
        ? await this.runExecutionStage(
            run.id,
            workspace,
            compiled,
            delivery.assignment.project.expectedType ?? 'PYTHON_FASTAPI',
          )
        : (compileLogs ?? '');

      const assessment = await this.runEvaluationStage(
        run.id,
        workspace,
        sourceCodePayload,
        executionLogs,
        assignmentContext,
        planAssessment,
      );

      this.enrichGradeBreakdownWithRubric(
        assessment,
        assignmentContext.rubricCriteria,
      );

      const qualityFindings = await this.runQualityStage(
        run.id,
        sourceCodePayload,
        executionLogs,
        assignmentContext,
        assessment,
        delivery,
      );

      const report = await this.runReportStage(
        run.id,
        assessment,
        qualityFindings,
        executionLogs,
      );

      return {
        planAssessment,
        assessment,
        qualityFindings,
        report,
        executionLogs,
        warnings: workspace.warnings,
      };
    } finally {
      await this.builderWorkspaceService.cleanup(workspace);
    }
  }

  private async prepareWorkspace(
    run: BuildRun,
    delivery: Delivery,
  ): Promise<StageWorkspaceResult> {
    await this.builderRunSupportService.emitEvent({
      buildRunId: run.id,
      eventType: 'LOG_CHUNK',
      message: 'Iniciando preparacion de entorno y analisis...',
    });

    return this.builderWorkspaceService.prepareWorkspace(delivery.id);
  }

  /**
   * Empareja cada entrada del gradeBreakdown devuelto por el LLM con el criterio
   * ponderado configurado en el proyecto (por nombre, normalizado) y le adjunta
   * su peso (%) y descripción, para que el informe del alumno muestre la rúbrica
   * tal como la definió el profesor. No altera puntuaciones ni justificaciones.
   */
  private enrichGradeBreakdownWithRubric(
    assessment: BuilderEvaluationContractV2,
    rubricCriteria: RubricCriterion[] | null,
  ): void {
    if (!rubricCriteria || rubricCriteria.length === 0) {
      return;
    }
    if (!Array.isArray(assessment.gradeBreakdown)) {
      return;
    }

    const normalize = (value: string): string => value.trim().toLowerCase();
    const criterionByName = new Map(
      rubricCriteria.map((criterion) => [normalize(criterion.name), criterion]),
    );

    assessment.gradeBreakdown = assessment.gradeBreakdown.map((item) => {
      const match = criterionByName.get(normalize(item.criterion));
      if (!match) {
        return item;
      }
      return {
        ...item,
        weight: match.weight,
        description: match.description,
      };
    });
  }

  private buildAssignmentContext(delivery: Delivery): AssignmentContext {
    return {
      expectedType: delivery.assignment.project.expectedType,
      rubricInstructions: delivery.assignment.project.rubricInstructions,
      expectedOutput: delivery.assignment.project.expectedOutput ?? null,
      rubricCriteria: delivery.assignment.project.rubricCriteria ?? null,
    };
  }

  private async buildSourceCodePayload(
    workspace: StageWorkspaceResult,
  ): Promise<string> {
    const sourceCodePayloadParts: string[] = [];

    for (const file of workspace.runtimeFiles) {
      // Lista blanca por extensión, no lista negra de directorios: un binario,
      // un `.o` recién compilado o una imagen no aportan nada al prompt y, leídos
      // como utf-8, meterían ruido y bytes al heap del worker. También se saltan
      // los ficheros grandes antes de leerlos.
      if (!this.isSourceCodeFile(file.relativePath)) {
        continue;
      }
      if (file.sizeBytes > MAX_SOURCE_FILE_BYTES) {
        continue;
      }

      try {
        const content = await fs.readFile(String(file.absolutePath), 'utf8');
        sourceCodePayloadParts.push(
          `\n--- Archivo: ${file.relativePath} ---\n${content}\n`,
        );
      } catch {
        // Ignorar silenciosamente archivos que no se puedan leer.
      }
    }

    return sourceCodePayloadParts.join('');
  }

  private isSourceCodeFile(relativePath: string): boolean {
    const normalized = relativePath.toLowerCase();
    const segments = normalized.split('/');

    // Aun con extensión válida, nada dentro de un directorio de dependencias o
    // artefactos de compilación aporta al prompt (un `.js` en node_modules es
    // ruido, no código del alumno).
    if (segments.some((segment) => EXCLUDED_DIR_SEGMENTS.has(segment))) {
      return false;
    }

    const basename = segments.at(-1) ?? '';
    if (SOURCE_CODE_BASENAMES.has(basename)) {
      return true;
    }
    return SOURCE_CODE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
  }

  private async runPlanStage(
    runId: string,
    sourceCodePayload: string,
    assignmentContext: AssignmentContext,
  ): Promise<BuilderPlanContractV2> {
    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      message: 'Analizando arquitectura del proyecto con IA...',
      payload: { studentStage: 'building' },
    });

    const { planAssessment } = await this.builderPlanStageHandler.handle({
      runId,
      sourceCodePayload,
      assignmentContext,
    });

    return planAssessment;
  }

  private async runCompileStage(
    runId: string,
    planAssessment: BuilderPlanContractV2,
    workspace: StageWorkspaceResult,
  ): Promise<{
    compiled: CompiledRecipe;
    executionLogs?: string;
  }> {
    return this.builderCompileStageHandler.handle({
      runId,
      planAssessment,
      workspace,
    });
  }

  private async runExecutionStage(
    runId: string,
    workspace: StageWorkspaceResult,
    compiled: CompiledRecipe,
    expectedType: string,
  ): Promise<string> {
    const execOutput = await this.builderExecutionStageHandler.handle({
      runId,
      workspace,
      compiled,
      expectedType,
    });

    return execOutput.executionLogs;
  }

  private async runEvaluationStage(
    runId: string,
    workspace: StageWorkspaceResult,
    sourceCodePayload: string,
    executionLogs: string,
    assignmentContext: AssignmentContext,
    planAssessment: BuilderPlanContractV2,
  ): Promise<BuilderEvaluationContractV2> {
    const { assessment } = await this.builderEvaluationStageHandler.handle({
      runId,
      workspace,
      sourceCodePayload,
      executionLogs,
      assignmentContext,
      planAssessment,
    });

    return assessment;
  }

  private async runQualityStage(
    runId: string,
    sourceCodePayload: string,
    executionLogs: string,
    assignmentContext: AssignmentContext,
    assessment: BuilderEvaluationContractV2,
    delivery: Delivery,
  ): Promise<BuilderCodeQualityContractV2> {
    const { qualityFindings } = await this.builderQualityStageHandler.handle({
      runId,
      sourceCodePayload,
      executionLogs,
      assignmentContext,
      assessment,
      delivery,
    });

    return qualityFindings;
  }

  private async runReportStage(
    runId: string,
    assessment: BuilderEvaluationContractV2,
    qualityFindings: BuilderCodeQualityContractV2,
    executionLogs: string,
  ): Promise<BuilderReportEntity> {
    const { report } = await this.builderReportStageHandler.handle({
      runId,
      assessment,
      qualityFindings,
      executionLogs,
    });

    return report;
  }
}
