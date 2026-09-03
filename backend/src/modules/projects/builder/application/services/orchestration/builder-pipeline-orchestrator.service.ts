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

import { Delivery } from '../../../../deliveries/entities/delivery.entity';
import { BuildRun } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderCodeQualityContractV2,
  BuilderEvaluationContractV3,
  BuilderExecutionResult,
  BuilderPlanContractV2,
  BuilderReportEntity,
  BuilderStudentStage,
} from '../../../domain/builder.types';
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
import { CompiledRecipe } from '../compilation/builder-recipe-compiler.service';
import { BuilderPipelineResult } from '../builder-application.types';
import { BuilderStageTokenUsage } from '../../../domain/builder.types';
import { BuilderRunCancellationService } from './builder-run-cancellation.service';

@Injectable()
export class BuilderPipelineOrchestrator {
  constructor(
    private readonly builderWorkspaceService: BuilderWorkspaceService,
    private readonly sourceCodePayloadBuilder: SourceCodePayloadBuilder,
    private readonly builderPlanStageHandler: BuilderPlanStageHandler,
    private readonly builderCompileStageHandler: BuilderCompileStageHandler,
    private readonly builderExecutionStageHandler: BuilderExecutionStageHandler,
    private readonly builderEvaluationStageHandler: BuilderEvaluationStageHandler,
    private readonly builderQualityStageHandler: BuilderQualityStageHandler,
    private readonly builderReportStageHandler: BuilderReportStageHandler,
    private readonly builderReportComposer: BuilderReportComposer,
    private readonly builderRunSupportService: BuilderRunSupportService,
    private readonly builderRunCancellationService: BuilderRunCancellationService,
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
      // Chequeo cooperativo entre etapas: cada punto de aqui abajo
      // es una oportunidad barata de no seguir facturando llamadas LLM tras
      // una cancelacion. El tramo largo (la ejecucion Docker) no puede
      // esperar a su propio final: runExecutionStage abre ademas un sondeo
      // en segundo plano que mata el contenedor en curso.
      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const assignmentContext = this.buildAssignmentContext(delivery);
      const sourceCodePayload =
        await this.sourceCodePayloadBuilder.build(workspace);

      const { planAssessment, usages: planUsages } = await this.runPlanStage(
        run.id,
        sourceCodePayload,
        assignmentContext,
      );

      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const { compiled, execution: compileExecution } =
        await this.runCompileStage(run.id, planAssessment, workspace);

      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const execution: BuilderExecutionResult = compiled.executable
        ? await this.runExecutionStage(run.id, workspace, compiled)
        : (compileExecution ?? {
            ran: false,
            stdout: '',
            stderr: '',
            exitCode: null,
          });

      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const { assessment, usages: evaluationUsages } =
        await this.runEvaluationStage(
          run.id,
          workspace,
          sourceCodePayload,
          execution,
          assignmentContext,
          planAssessment,
        );

      this.builderReportComposer.enrichGradeBreakdownWithRubric(
        assessment,
        assignmentContext.rubricCriteria,
      );

      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const { qualityFindings, usages: qualityUsages } =
        await this.runQualityStage(
          run.id,
          sourceCodePayload,
          execution,
          assignmentContext,
          assessment,
          delivery,
        );

      await this.builderRunCancellationService.assertNotCancelled(run.id);

      const { report, usages: reportingUsages } = await this.runReportStage(
        run.id,
        assessment,
        qualityFindings,
        execution,
      );

      return {
        planAssessment,
        assessment,
        qualityFindings,
        report,
        execution,
        warnings: workspace.warnings,
        // El coste no se puede derivar de la suma de tokens: cada etapa puede
        // haber corrido en un proveedor distinto, así que se propaga el detalle.
        llmUsages: [
          ...planUsages,
          ...evaluationUsages,
          ...qualityUsages,
          ...reportingUsages,
        ],
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

  private buildAssignmentContext(delivery: Delivery): AssignmentContext {
    return {
      expectedType: delivery.assignment.project.expectedType,
      rubricInstructions: delivery.assignment.project.rubricInstructions,
      expectedOutput: delivery.assignment.project.expectedOutput ?? null,
      rubricCriteria: delivery.assignment.project.rubricCriteria ?? null,
    };
  }

  private async runPlanStage(
    runId: string,
    sourceCodePayload: string,
    assignmentContext: AssignmentContext,
  ): Promise<{
    planAssessment: BuilderPlanContractV2;
    usages: BuilderStageTokenUsage[];
  }> {
    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      message: 'Analizando arquitectura del proyecto con IA...',
      payload: { studentStage: 'building' satisfies BuilderStudentStage },
    });

    const result = await this.builderPlanStageHandler.handle({
      runId,
      sourceCodePayload,
      assignmentContext,
    });

    return result;
  }

  private async runCompileStage(
    runId: string,
    planAssessment: BuilderPlanContractV2,
    workspace: StageWorkspaceResult,
  ): Promise<{
    compiled: CompiledRecipe;
    execution?: BuilderExecutionResult;
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
  ): Promise<BuilderExecutionResult> {
    // El sondeo cubre justo el tramo que los chequeos puntuales entre etapas
    // no alcanzan: un contenedor puede correr varios minutos sin que el
    // orquestador vuelva a preguntar. `watcher.signal` llega hasta
    // `runCommand` (child_process.spawn) y mata el proceso si se cancela.
    const watcher =
      this.builderRunCancellationService.createCancellationWatcher(runId);
    try {
      const execOutput = await this.builderExecutionStageHandler.handle({
        runId,
        workspace,
        compiled,
        signal: watcher.signal,
      });

      return execOutput.execution;
    } finally {
      watcher.stop();
    }
  }

  private async runEvaluationStage(
    runId: string,
    workspace: StageWorkspaceResult,
    sourceCodePayload: string,
    execution: BuilderExecutionResult,
    assignmentContext: AssignmentContext,
    planAssessment: BuilderPlanContractV2,
  ): Promise<{
    assessment: BuilderEvaluationContractV3;
    usages: BuilderStageTokenUsage[];
  }> {
    const result = await this.builderEvaluationStageHandler.handle({
      runId,
      workspace,
      sourceCodePayload,
      execution,
      assignmentContext,
      planAssessment,
    });

    return result;
  }

  private async runQualityStage(
    runId: string,
    sourceCodePayload: string,
    execution: BuilderExecutionResult,
    assignmentContext: AssignmentContext,
    assessment: BuilderEvaluationContractV3,
    delivery: Delivery,
  ): Promise<{
    qualityFindings: BuilderCodeQualityContractV2;
    usages: BuilderStageTokenUsage[];
  }> {
    const result = await this.builderQualityStageHandler.handle({
      runId,
      sourceCodePayload,
      execution,
      assignmentContext,
      assessment,
      delivery,
    });

    return result;
  }

  private async runReportStage(
    runId: string,
    assessment: BuilderEvaluationContractV3,
    qualityFindings: BuilderCodeQualityContractV2,
    execution: BuilderExecutionResult,
  ): Promise<{
    report: BuilderReportEntity;
    usages: BuilderStageTokenUsage[];
  }> {
    const { report, usages } = await this.builderReportStageHandler.handle({
      runId,
      assessment,
      qualityFindings,
      execution,
    });

    return { report, usages };
  }
}
