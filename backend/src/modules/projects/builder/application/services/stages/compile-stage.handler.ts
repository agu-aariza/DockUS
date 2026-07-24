import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import {
  BuilderRecipeCompiler,
  CompiledRecipe,
} from '../compilation/builder-recipe-compiler.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  BuilderExecutionResult,
  BuilderPlanContractV2,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';
import { RUNTIME_CATALOG } from '../../../domain/runtime-catalog';

interface CompileStageInput {
  runId: string;
  planAssessment: BuilderPlanContractV2;
  workspace: StageWorkspaceResult;
}

interface CompileStageOutput {
  compiled: CompiledRecipe;
  execution?: BuilderExecutionResult;
}

@Injectable()
export class BuilderCompileStageHandler implements IBuilderStageHandler<
  CompileStageInput,
  CompileStageOutput
> {
  constructor(
    private readonly builderRecipeCompiler: BuilderRecipeCompiler,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async handle(input: CompileStageInput): Promise<CompileStageOutput> {
    const { runId, planAssessment, workspace } = input;

    const compiled = this.builderRecipeCompiler.compile(
      planAssessment,
      workspace.runtimeFiles,
    );

    if (!compiled.executable) {
      const execution: BuilderExecutionResult = {
        ran: false,
        stdout: '',
        stderr: '',
        exitCode: null,
        skippedReason: compiled.unsupportedReason ?? 'RECETA VACIA',
      };
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'WARNING_ADDED',
        runStatus: BuildRunStatus.RUNNING,
        message: compiled.unsupportedReason
          ? `Runtime declarado pero no ejecutable todavia: ${compiled.unsupportedReason}`
          : 'El planner no devolvio un comando run ejecutable.',
      });
      return { compiled, execution };
    }

    if (compiled.image !== RUNTIME_CATALOG.python.defaultImage) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Orquestador dinamico: seleccionada imagen ${compiled.image} basada en requerimientos del proyecto.`,
      });
    }

    if (compiled.aptCmd) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Paquetes de sistema requeridos: ${compiled.systemPackages.join(', ')}`,
      });
    }

    if (compiled.dependencyInstallCmd) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message:
          'Preparando imagen de entorno con las dependencias declaradas...',
      });
    }

    if (compiled.buildCmd) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: `Compilacion detectada: ${compiled.buildCmd}`,
      });
    }

    if (compiled.stdinFile) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.RUNNING,
        message: `Auto-detectado stdin: ${compiled.stdinFile}`,
      });
    }

    await this.builderRunSupportService.emitEvent({
      buildRunId: runId,
      eventType: 'RUN_STATUS_CHANGED',
      runStatus: BuildRunStatus.RUNNING,
      message: `Ejecutando orquestacion: ${compiled.servicePort ? 'Servicio + Healthcheck + Tests' : 'Batch Run + Tests'}`,
      payload: { studentStage: 'executing' satisfies BuilderStudentStage },
    });

    return { compiled };
  }
}
