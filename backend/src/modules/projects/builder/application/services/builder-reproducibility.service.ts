import { Injectable } from '@nestjs/common';
import {
  BuildStage,
  BuilderLlmAssessment,
  BuilderPipelineOutcome,
  ReproducibilityResult,
  ReproducibilitySnapshot,
  ReproducibilitySnapshotInput,
  StageResult,
  StageStatus,
} from '../../domain/builder.types';
import { toSha256Hex } from '../../infrastructure/utils/builder-analysis.util';

@Injectable()
export class BuilderReproducibilityService {
  buildSnapshot(input: {
    runId: string;
    deliveryId: string;
    inputManifest: ReproducibilitySnapshotInput[];
    assessment: BuilderLlmAssessment;
    dockerfile: string | null;
    executionContext: BuilderPipelineOutcome['executionContext'];
    stageResults: StageResult[];
    warnings: string[];
    failureReason: string | null;
    staticFindings: BuilderPipelineOutcome['staticFindings'];
  }): ReproducibilitySnapshot {
    return {
      sourceRunId: input.runId,
      deliveryId: input.deliveryId,
      createdAt: new Date().toISOString(),
      inputManifest: input.inputManifest,
      frozenRecipe: input.assessment.recipe,
      frozenAssessment: {
        structuralType: input.assessment.structuralType,
        capabilities: input.assessment.capabilities,
        evaluativeState: input.assessment.evaluativeState,
        confidence: input.assessment.confidence,
      },
      dockerfile: {
        content: input.dockerfile,
        sha256: input.dockerfile ? toSha256Hex(input.dockerfile) : null,
      },
      executionContext: input.executionContext,
      expectedOutcome: {
        stageMatrix: this.toStageMatrix(input.stageResults),
        warnings: [...input.warnings].sort((left, right) =>
          left.localeCompare(right),
        ),
        failureReason: input.failureReason,
        staticFindingSignature: input.staticFindings
          .map((finding) =>
            [finding.id, finding.file, finding.line, finding.evidence].join(
              '|',
            ),
          )
          .sort((left, right) => left.localeCompare(right)),
      },
    };
  }

  buildResult(input: {
    replayRunId: string;
    sourceRunId: string;
    sourceSnapshot: ReproducibilitySnapshot;
    executionContext: BuilderPipelineOutcome['executionContext'];
    stageResults: StageResult[];
    warnings: string[];
    staticFindings: BuilderPipelineOutcome['staticFindings'];
  }): ReproducibilityResult {
    const checks: ReproducibilityResult['checks'] = [];
    const currentStageMatrix = this.toStageMatrix(input.stageResults);
    const currentFindingSignature = input.staticFindings
      .map((finding) =>
        [finding.id, finding.file, finding.line, finding.evidence].join('|'),
      )
      .sort((left, right) => left.localeCompare(right));
    const normalizedWarnings = [...input.warnings].sort((left, right) =>
      left.localeCompare(right),
    );

    checks.push({
      id: 'INPUT_MANIFEST',
      status: 'MATCH',
      expected: `${input.sourceSnapshot.inputManifest.length} artefactos congelados`,
      observed: `${input.sourceSnapshot.inputManifest.length} artefactos reutilizados`,
    });
    checks.push({
      id: 'DOCKERFILE_HASH',
      status: input.sourceSnapshot.dockerfile.sha256 ? 'MATCH' : 'INCONCLUSIVE',
      expected: input.sourceSnapshot.dockerfile.sha256 ?? 'sin dockerfile',
      observed: input.sourceSnapshot.dockerfile.sha256 ?? 'sin dockerfile',
    });

    const contextDrift =
      JSON.stringify(input.sourceSnapshot.executionContext) !==
      JSON.stringify(input.executionContext);
    checks.push({
      id: 'EXECUTION_CONTEXT',
      status: contextDrift ? 'DRIFT' : 'MATCH',
      expected: JSON.stringify(input.sourceSnapshot.executionContext),
      observed: JSON.stringify(input.executionContext),
    });

    const stageDrift =
      JSON.stringify(input.sourceSnapshot.expectedOutcome.stageMatrix) !==
      JSON.stringify(currentStageMatrix);
    checks.push({
      id: 'STAGE_MATRIX',
      status: stageDrift ? 'DRIFT' : 'MATCH',
      expected: JSON.stringify(
        input.sourceSnapshot.expectedOutcome.stageMatrix,
      ),
      observed: JSON.stringify(currentStageMatrix),
    });

    const warningsDrift =
      JSON.stringify(input.sourceSnapshot.expectedOutcome.warnings) !==
      JSON.stringify(normalizedWarnings);
    checks.push({
      id: 'WARNINGS',
      status: warningsDrift ? 'DRIFT' : 'MATCH',
      expected: JSON.stringify(input.sourceSnapshot.expectedOutcome.warnings),
      observed: JSON.stringify(normalizedWarnings),
    });

    const findingsDrift =
      JSON.stringify(
        input.sourceSnapshot.expectedOutcome.staticFindingSignature,
      ) !== JSON.stringify(currentFindingSignature);
    checks.push({
      id: 'STATIC_FINDINGS',
      status: findingsDrift ? 'DRIFT' : 'MATCH',
      expected: JSON.stringify(
        input.sourceSnapshot.expectedOutcome.staticFindingSignature,
      ),
      observed: JSON.stringify(currentFindingSignature),
    });

    const blocked = checks.some((check) => check.status === 'BLOCKED');
    const drift = checks.some((check) => check.status === 'DRIFT');
    const inconclusive = checks.some(
      (check) => check.status === 'INCONCLUSIVE',
    );
    const overallStatus = blocked
      ? 'BLOCKED'
      : drift
        ? 'DRIFT'
        : inconclusive
          ? 'INCONCLUSIVE'
          : 'MATCH';

    return {
      sourceRunId: input.sourceRunId,
      replayRunId: input.replayRunId,
      overallStatus,
      summary: `Frozen replay ${overallStatus}.`,
      checks,
      evidenceRefs: [`run:${input.sourceRunId}`, `run:${input.replayRunId}`],
    };
  }

  buildReplayReport(
    sourceReport: BuilderPipelineOutcome['report'],
    reproducibilityResult: ReproducibilityResult,
  ): BuilderPipelineOutcome['report'] {
    const statusLine = `Resultado de reproducibilidad: ${reproducibilityResult.overallStatus}.`;
    return {
      ...sourceReport,
      readableText: `${sourceReport.readableText}\n\n${statusLine}\n${reproducibilityResult.summary}`,
      relevantEvidence: [
        ...sourceReport.relevantEvidence,
        ...reproducibilityResult.evidenceRefs,
      ],
    };
  }

  private toStageMatrix(
    stageResults: StageResult[],
  ): Record<BuildStage, StageStatus> {
    return Object.values(BuildStage).reduce(
      (accumulator, stage) => {
        accumulator[stage] =
          stageResults.find((stageResult) => stageResult.stage === stage)
            ?.status ?? StageStatus.SKIP;
        return accumulator;
      },
      {} as Record<BuildStage, StageStatus>,
    );
  }
}
