/**
 * @fileoverview Motor Builder de evaluación asíncrona (quality-stage.handler).
 *
 * @module quality-stage.handler
 */

import { Injectable, Logger } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderCodeQualityService } from '../ai/builder-code-quality.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
  BuilderExecutionResult,
  BuilderStudentStage,
} from '../../../domain/builder.types';
import {
  buildEmptyCodeQualityContract,
  resolveCodeQualityFindings,
} from '../support/builder-fallback-assessment.util';
import { Delivery } from '../../../../deliveries/entities/delivery.entity';
import { toStageTokenUsage } from '../ai/builder-llm-trace.util';
import type {
  BuilderCodeQualityTrace,
  BuilderStageTokenUsage,
} from '../../../domain/builder.types';

interface QualityStageInput {
  runId: string;
  sourceCodePayload: string;
  execution: BuilderExecutionResult;
  assignmentContext: AssignmentContext;
  assessment: BuilderEvaluationContractV2;
  delivery: Delivery;
}

interface QualityStageOutput {
  qualityFindings: BuilderCodeQualityContractV2;
  usages: BuilderStageTokenUsage[];
}

@Injectable()
export class BuilderQualityStageHandler implements IBuilderStageHandler<
  QualityStageInput,
  QualityStageOutput
> {
  private readonly logger = new Logger(BuilderQualityStageHandler.name);

  constructor(
    private readonly builderCodeQualityService: BuilderCodeQualityService,
    private readonly builderArtifactPersister: BuilderArtifactPersister,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async handle(input: QualityStageInput): Promise<QualityStageOutput> {
    const {
      runId,
      sourceCodePayload,
      execution,
      assignmentContext,
      assessment,
      delivery,
    } = input;

    let qualityFindings: BuilderCodeQualityContractV2;
    let qualityTrace: BuilderCodeQualityTrace | null = null;

    try {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        // ARQ-012: la etapa de calidad corre con el run todavia RUNNING, no
        // SUCCESS (ese estado lo asigna BuilderRunLifecycleService al final
        // del pipeline completo, no una etapa individual).
        runStatus: BuildRunStatus.RUNNING,
        message: 'Realizando analisis profundo de calidad y seguridad...',
        payload: { studentStage: 'analyzing' satisfies BuilderStudentStage },
      });

      qualityTrace = await this.builderCodeQualityService.analyzeWithTrace(
        {
          sourceCodePayload,
          execution,
          assignmentContext,
          assessment,
        },
        {
          onBeforeCall: async (snapshot) => {
            await this.builderArtifactPersister.persistQualityPromptArtifact(
              runId,
              snapshot,
            );
          },
        },
      );
      await this.builderArtifactPersister.persistQualityTraceArtifacts(
        runId,
        qualityTrace,
      );

      qualityFindings = resolveCodeQualityFindings(qualityTrace);
    } catch (qError) {
      const message = qError instanceof Error ? qError.message : String(qError);
      this.logger.error(`Error en analisis de calidad: ${message}`);
      // Un contrato vacío es indistinguible de "código limpio, sin hallazgos".
      // Sin este evento, un fallo de infraestructura (MinIO/Postgres) produce un
      // informe de apariencia normal y nadie se entera: ni el docente que lo lee
      // ni el operador. La etapa sigue degradando en vez de propagar —el resto
      // de la evaluación es válido y perderla sería peor—, pero deja constancia.
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'WARNING_ADDED',
        runStatus: BuildRunStatus.RUNNING,
        message:
          'El analisis de calidad no pudo completarse; el informe se emite sin hallazgos de calidad.',
        payload: { degraded: true, stage: 'quality', reason: message },
      });
      qualityFindings = buildEmptyCodeQualityContract(
        `Analisis degradado por error interno: ${message}`,
      );
    }

    // El jsonb resuelto arriba (`qualityFindings`, que acaba en
    // `run.codeQualityFindings`) es la fuente canonica del run; esto es solo
    // su proyeccion consultable en `code_quality_findings` (ARQ-005). Vive en
    // un try/catch propio para que un fallo de Postgres al escribir la
    // proyeccion no destruya un analisis que ya se calculo correctamente —
    // antes, al compartir el catch de arriba, un error aqui sobreescribia
    // tambien el jsonb con un contrato vacio.
    if (qualityTrace?.parsedContract) {
      try {
        await this.builderArtifactPersister.persistCodeQualityFindingRows(
          runId,
          delivery.assignment.projectId,
          delivery.assignment.studentId,
          qualityTrace.parsedContract,
        );
      } catch (persistError) {
        const message =
          persistError instanceof Error
            ? persistError.message
            : String(persistError);
        this.logger.error(
          `No se pudo persistir la proyeccion de hallazgos de calidad: ${message}`,
        );
        await this.builderRunSupportService.emitEvent({
          buildRunId: runId,
          eventType: 'WARNING_ADDED',
          runStatus: BuildRunStatus.RUNNING,
          message:
            'El analisis de calidad se completo, pero su proyeccion consultable no pudo guardarse; el informe del run conserva los hallazgos igualmente.',
          payload: {
            degraded: true,
            stage: 'quality-projection',
            reason: message,
          },
        });
      }
    }

    const usage = toStageTokenUsage(qualityTrace);
    return { qualityFindings, usages: usage ? [usage] : [] };
  }
}
