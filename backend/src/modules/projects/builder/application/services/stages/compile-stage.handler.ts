import { Injectable } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderRecipeCompiler } from '../compilation/builder-recipe-compiler.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import { BuilderPlanContractV2 } from '../../../domain/builder.types';
import { StageWorkspaceResult } from '../workspace/builder-workspace.service';
import { DEFAULT_BASE_PYTHON_IMAGE } from '../../../domain/builder.constants';

export interface CompileStageInput {
  runId: string;
  planAssessment: BuilderPlanContractV2;
  workspace: StageWorkspaceResult;
}

export interface CompileStageOutput {
  compiled: any;
  executionLogs?: string;
}

@Injectable()
export class BuilderCompileStageHandler implements IBuilderStageHandler<CompileStageInput, CompileStageOutput> {
  constructor(
    private readonly builderRecipeCompiler: BuilderRecipeCompiler,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async handle(input: CompileStageInput): Promise<CompileStageOutput> {
    const { runId, planAssessment, workspace } = input;

    const compiled = this.builderRecipeCompiler.compile(planAssessment, workspace.runtimeFiles);
    
    if (!compiled.executable) {
      const executionLogs = `EL LLM DETERMINO QUE EL PROYECTO NO ES EJECUTABLE (${compiled.unsupportedReason ?? 'RECETA VACIA'}).`;
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'WARNING_ADDED',
        runStatus: BuildRunStatus.RUNNING,
        message: compiled.unsupportedReason
          ? `Runtime declarado pero no ejecutable todavia: ${compiled.unsupportedReason}`
          : 'El planner no devolvio un comando run ejecutable.',
      });
      return { compiled, executionLogs };
    } 

    if (compiled.image !== DEFAULT_BASE_PYTHON_IMAGE) {
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
        message: `Instalando dependencias de sistema: ${compiled.systemPackages.join(', ')}`,
      });
    }

    if (compiled.installCmd) {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'RUN_STATUS_CHANGED',
        runStatus: BuildRunStatus.RUNNING,
        message: 'Sincronizando dependencias del lenguaje...',
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
      payload: { studentStage: 'executing' },
    });

    return { compiled };
  }
}
