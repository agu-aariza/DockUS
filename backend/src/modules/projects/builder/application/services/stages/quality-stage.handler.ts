import { Injectable, Logger } from '@nestjs/common';
import { IBuilderStageHandler } from './builder-stage.interface';
import { BuilderCodeQualityService } from '../../../domain/ai/builder-code-quality.service';
import { BuilderArtifactPersister } from '../artifacts/builder-artifact-persister.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';
import { BuildRunStatus } from '../../../domain/entities/build-run.entity';
import {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderCodeQualityContractV2,
} from '../../../domain/builder.types';
import {
  buildEmptyCodeQualityContract,
  resolveCodeQualityFindings,
} from '../support/builder-fallback-assessment.util';
import { Delivery } from '../../../../deliveries/entities/delivery.entity';

interface QualityStageInput {
  runId: string;
  sourceCodePayload: string;
  executionLogs: string;
  assignmentContext: AssignmentContext;
  assessment: BuilderEvaluationContractV2;
  delivery: Delivery;
}

interface QualityStageOutput {
  qualityFindings: BuilderCodeQualityContractV2;
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
      executionLogs,
      assignmentContext,
      assessment,
      delivery,
    } = input;

    let qualityFindings = buildEmptyCodeQualityContract(
      'Analisis de calidad todavia no disponible.',
    );

    try {
      await this.builderRunSupportService.emitEvent({
        buildRunId: runId,
        eventType: 'LOG_CHUNK',
        runStatus: BuildRunStatus.SUCCESS,
        message: 'Realizando analisis profundo de calidad y seguridad...',
        payload: { studentStage: 'analyzing' },
      });

      const qualityTrace =
        await this.builderCodeQualityService.analyzeWithTrace(
          {
            sourceCodePayload,
            executionLogs,
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
      if (qualityTrace.parsedContract) {
        await this.builderArtifactPersister.persistCodeQualityFindingRows(
          runId,
          delivery.assignment.projectId,
          delivery.assignment.studentId,
          qualityTrace.parsedContract,
        );
      }
    } catch (qError) {
      const message = qError instanceof Error ? qError.message : String(qError);
      this.logger.error(`Error en analisis de calidad: ${message}`);
      qualityFindings = buildEmptyCodeQualityContract(
        `Analisis degradado por error interno: ${message}`,
      );
    }

    return { qualityFindings };
  }
}
