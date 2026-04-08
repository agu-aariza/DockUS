import { ConflictException, Injectable } from '@nestjs/common';
import {
  Assessment,
  BuilderCapabilityDelta,
  BuilderLlmAssessment,
  BuilderReport,
  BuilderRunComparison,
  BuilderStageDelta,
  BuildStage,
  ComparisonVerdict,
  ExecutionContext,
  StageResult,
  StageStatus,
  StaticFinding,
} from '../builder.types';
import { BuildRun, BuildRunStatus } from '../entities/build-run.entity';
import { toSha256Hex } from '../../infrastructure/utils/builder-analysis.util';

const TERMINAL_STATUSES = new Set<BuildRunStatus>([
  BuildRunStatus.SUCCESS,
  BuildRunStatus.FAILED,
  BuildRunStatus.CANCELLED,
]);

const EVALUATIVE_STATE_SCORE: Record<string, number> = {
  E1: 4,
  E2: 3,
  E3: 2,
  E4: 1,
};

const ASSESSMENT_SCORE: Record<Assessment, number> = {
  yes: 2,
  unknown: 1,
  no: 0,
};

const STAGE_STATUS_SCORE: Record<StageStatus, number> = {
  PASS: 2,
  SKIP: 1,
  FAIL: 0,
};

@Injectable()
export class BuilderRunComparisonService {
  compare(baseRun: BuildRun, candidateRun: BuildRun): BuilderRunComparison {
    if (!TERMINAL_STATUSES.has(baseRun.status)) {
      throw new ConflictException('El run base no está en estado terminal.');
    }
    if (!TERMINAL_STATUSES.has(candidateRun.status)) {
      throw new ConflictException(
        'El run candidato no está en estado terminal.',
      );
    }
    if (baseRun.deliveryId !== candidateRun.deliveryId) {
      throw new ConflictException(
        'Solo se pueden comparar runs de la misma entrega.',
      );
    }

    const baseAssessment = this.readAssessment(baseRun);
    const candidateAssessment = this.readAssessment(candidateRun);
    const baseFindings = this.readFindings(baseRun);
    const candidateFindings = this.readFindings(candidateRun);
    const baseStageResults = this.readStageResults(baseRun);
    const candidateStageResults = this.readStageResults(candidateRun);
    const baseWarnings = this.readWarnings(baseRun);
    const candidateWarnings = this.readWarnings(candidateRun);
    const baseContext = this.readExecutionContext(baseRun);
    const candidateContext = this.readExecutionContext(candidateRun);

    const capabilityDelta = this.buildCapabilityDelta(
      baseAssessment,
      candidateAssessment,
    );
    const stageDelta = this.buildStageDelta(
      baseStageResults,
      candidateStageResults,
    );
    const findingDelta = this.buildFindingDelta(
      baseFindings,
      candidateFindings,
    );
    const warningsDelta = this.buildStringDelta(
      baseWarnings,
      candidateWarnings,
    );

    const improved =
      EVALUATIVE_STATE_SCORE[candidateAssessment.evaluativeState] >
        EVALUATIVE_STATE_SCORE[baseAssessment.evaluativeState] ||
      capabilityDelta.some((delta) => delta.change === 'IMPROVED') ||
      stageDelta.some((delta) => delta.change === 'IMPROVED') ||
      findingDelta.resolved.length > 0 ||
      Boolean(baseRun.failureReason && !candidateRun.failureReason);

    const regressed =
      EVALUATIVE_STATE_SCORE[candidateAssessment.evaluativeState] <
        EVALUATIVE_STATE_SCORE[baseAssessment.evaluativeState] ||
      capabilityDelta.some((delta) => delta.change === 'REGRESSED') ||
      stageDelta.some((delta) => delta.change === 'REGRESSED') ||
      findingDelta.added.length > 0 ||
      Boolean(!baseRun.failureReason && candidateRun.failureReason);

    const overallVerdict = this.resolveVerdict(improved, regressed);
    const recipeHashDelta = {
      base: this.hashJson(baseAssessment.recipe),
      candidate: this.hashJson(candidateAssessment.recipe),
    };
    const dockerfileHashDelta = {
      base:
        typeof baseRun.dockerfileContent === 'string'
          ? toSha256Hex(baseRun.dockerfileContent)
          : null,
      candidate:
        typeof candidateRun.dockerfileContent === 'string'
          ? toSha256Hex(candidateRun.dockerfileContent)
          : null,
    };
    const changedFields = this.findChangedExecutionContextFields(
      baseContext,
      candidateContext,
    );

    return {
      baseRunId: baseRun.id,
      candidateRunId: candidateRun.id,
      deliveryId: baseRun.deliveryId,
      overallVerdict,
      evaluativeStateDelta: {
        base: baseAssessment.evaluativeState,
        candidate: candidateAssessment.evaluativeState,
      },
      confidenceDelta: {
        base: baseAssessment.confidence,
        candidate: candidateAssessment.confidence,
      },
      capabilityDelta,
      stageDelta,
      findingDelta,
      warningsDelta,
      failureReasonDelta: {
        base: baseRun.failureReason,
        candidate: candidateRun.failureReason,
      },
      recipeHashDelta,
      dockerfileHashDelta,
      executionContextDelta: {
        base: baseContext,
        candidate: candidateContext,
        changedFields,
      },
      technicalSummary: this.buildTechnicalSummary({
        overallVerdict,
        baseAssessment,
        candidateAssessment,
        capabilityDelta,
        stageDelta,
        findingDelta,
      }),
      evidenceRefs: this.collectEvidenceRefs(baseRun, candidateRun),
    };
  }

  private readAssessment(run: BuildRun): BuilderLlmAssessment {
    const assessment = run.llmAssessment as BuilderLlmAssessment | null;
    if (!assessment) {
      throw new ConflictException(
        `El run ${run.id} no contiene llmAssessment para comparar.`,
      );
    }
    return assessment;
  }

  private readFindings(run: BuildRun): StaticFinding[] {
    return Array.isArray(run.staticFindings)
      ? (run.staticFindings as StaticFinding[])
      : [];
  }

  private readStageResults(run: BuildRun): StageResult[] {
    return Array.isArray(run.stageResults)
      ? (run.stageResults as StageResult[])
      : [];
  }

  private readWarnings(run: BuildRun): string[] {
    return Array.isArray(run.warnings) ? [...run.warnings] : [];
  }

  private readExecutionContext(run: BuildRun): ExecutionContext | null {
    return (run.executionContext as ExecutionContext | null) ?? null;
  }

  private buildCapabilityDelta(
    base: BuilderLlmAssessment,
    candidate: BuilderLlmAssessment,
  ): BuilderCapabilityDelta[] {
    return Object.keys(base.capabilities)
      .sort((left, right) => left.localeCompare(right))
      .map((capabilityId) => {
        const baseStatus =
          base.capabilities[capabilityId as keyof typeof base.capabilities]
            .status;
        const candidateStatus =
          candidate.capabilities[
            capabilityId as keyof typeof candidate.capabilities
          ].status;
        return {
          capabilityId: capabilityId as BuilderCapabilityDelta['capabilityId'],
          baseStatus,
          candidateStatus,
          change: this.compareRank(
            ASSESSMENT_SCORE[baseStatus],
            ASSESSMENT_SCORE[candidateStatus],
          ),
        };
      });
  }

  private buildStageDelta(
    base: StageResult[],
    candidate: StageResult[],
  ): BuilderStageDelta[] {
    const baseMap = new Map(
      base.map((stageResult) => [stageResult.stage, stageResult]),
    );
    const candidateMap = new Map(
      candidate.map((stageResult) => [stageResult.stage, stageResult]),
    );

    return Object.values(BuildStage).map((stage) => {
      const baseStatus = baseMap.get(stage)?.status ?? StageStatus.SKIP;
      const candidateStatus =
        candidateMap.get(stage)?.status ?? StageStatus.SKIP;
      return {
        stage,
        baseStatus,
        candidateStatus,
        change: this.compareRank(
          STAGE_STATUS_SCORE[baseStatus],
          STAGE_STATUS_SCORE[candidateStatus],
        ),
      };
    });
  }

  private buildFindingDelta(
    base: StaticFinding[],
    candidate: StaticFinding[],
  ): BuilderRunComparison['findingDelta'] {
    const baseMap = new Map(
      base.map((finding) => [this.findingKey(finding), finding]),
    );
    const candidateMap = new Map(
      candidate.map((finding) => [this.findingKey(finding), finding]),
    );

    return {
      resolved: [...baseMap.entries()]
        .filter(([key]) => !candidateMap.has(key))
        .map(([, finding]) => finding),
      added: [...candidateMap.entries()]
        .filter(([key]) => !baseMap.has(key))
        .map(([, finding]) => finding),
      persisting: [...candidateMap.entries()]
        .filter(([key]) => baseMap.has(key))
        .map(([, finding]) => finding),
    };
  }

  private buildStringDelta(base: string[], candidate: string[]) {
    const baseSet = new Set(base);
    const candidateSet = new Set(candidate);
    return {
      resolved: [...baseSet].filter((value) => !candidateSet.has(value)).sort(),
      added: [...candidateSet].filter((value) => !baseSet.has(value)).sort(),
      persisting: [...candidateSet]
        .filter((value) => baseSet.has(value))
        .sort(),
    };
  }

  private resolveVerdict(
    improved: boolean,
    regressed: boolean,
  ): ComparisonVerdict {
    if (improved && regressed) {
      return 'MIXED';
    }
    if (improved) {
      return 'IMPROVED';
    }
    if (regressed) {
      return 'REGRESSED';
    }
    return 'UNCHANGED';
  }

  private buildTechnicalSummary(input: {
    overallVerdict: ComparisonVerdict;
    baseAssessment: BuilderLlmAssessment;
    candidateAssessment: BuilderLlmAssessment;
    capabilityDelta: BuilderCapabilityDelta[];
    stageDelta: BuilderStageDelta[];
    findingDelta: BuilderRunComparison['findingDelta'];
  }): string {
    const improvedCapabilities = input.capabilityDelta.filter(
      (delta) => delta.change === 'IMPROVED',
    ).length;
    const regressedCapabilities = input.capabilityDelta.filter(
      (delta) => delta.change === 'REGRESSED',
    ).length;
    const improvedStages = input.stageDelta.filter(
      (delta) => delta.change === 'IMPROVED',
    ).length;
    const regressedStages = input.stageDelta.filter(
      (delta) => delta.change === 'REGRESSED',
    ).length;

    return [
      `Veredicto ${input.overallVerdict}.`,
      `Estado evaluativo ${input.baseAssessment.evaluativeState} -> ${input.candidateAssessment.evaluativeState}.`,
      `Capacidades mejoradas: ${improvedCapabilities}; regresiones: ${regressedCapabilities}.`,
      `Etapas mejoradas: ${improvedStages}; regresiones: ${regressedStages}.`,
      `Hallazgos resueltos: ${input.findingDelta.resolved.length}; nuevos: ${input.findingDelta.added.length}.`,
    ].join(' ');
  }

  private collectEvidenceRefs(
    baseRun: BuildRun,
    candidateRun: BuildRun,
  ): string[] {
    const refs = new Set<string>([
      `run:${baseRun.id}`,
      `run:${candidateRun.id}`,
    ]);
    const baseReport = (baseRun.report as BuilderReport | null) ?? null;
    const candidateReport =
      (candidateRun.report as BuilderReport | null) ?? null;

    baseReport?.relevantEvidence?.forEach((ref) => refs.add(`artifact:${ref}`));
    candidateReport?.relevantEvidence?.forEach((ref) =>
      refs.add(`artifact:${ref}`),
    );

    return [...refs];
  }

  private hashJson(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    return toSha256Hex(JSON.stringify(value));
  }

  private findingKey(finding: StaticFinding): string {
    return [finding.id, finding.file, finding.line, finding.evidence].join('|');
  }

  private compareRank(
    baseScore: number,
    candidateScore: number,
  ): 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' {
    if (candidateScore > baseScore) {
      return 'IMPROVED';
    }
    if (candidateScore < baseScore) {
      return 'REGRESSED';
    }
    return 'UNCHANGED';
  }

  private findChangedExecutionContextFields(
    base: ExecutionContext | null,
    candidate: ExecutionContext | null,
  ): string[] {
    if (!base || !candidate) {
      return base === candidate ? [] : ['executionContext'];
    }

    const fields: Array<[string, unknown, unknown]> = [
      ['pythonBaseImage', base.pythonBaseImage, candidate.pythonBaseImage],
      [
        'pythonBaseImageDigest',
        base.pythonBaseImageDigest,
        candidate.pythonBaseImageDigest,
      ],
      ['dockerVersion', base.dockerVersion, candidate.dockerVersion],
      ['kindVersion', base.kindVersion, candidate.kindVersion],
      ['kubectlVersion', base.kubectlVersion, candidate.kubectlVersion],
      ['clusterName', base.clusterName, candidate.clusterName],
      [
        'limits.batchTimeoutSeconds',
        base.limits.batchTimeoutSeconds,
        candidate.limits.batchTimeoutSeconds,
      ],
      [
        'limits.serviceReadyTimeoutSeconds',
        base.limits.serviceReadyTimeoutSeconds,
        candidate.limits.serviceReadyTimeoutSeconds,
      ],
      [
        'limits.stabilityWindowSeconds',
        base.limits.stabilityWindowSeconds,
        candidate.limits.stabilityWindowSeconds,
      ],
    ];

    return fields
      .filter(
        ([, left, right]) => JSON.stringify(left) !== JSON.stringify(right),
      )
      .map(([field]) => field);
  }
}
