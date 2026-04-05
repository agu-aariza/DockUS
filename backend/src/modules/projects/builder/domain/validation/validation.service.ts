import { Injectable } from '@nestjs/common';
import {
  BuildStage,
  ExecutionProfile,
  StageResult,
  StageStatus,
  ValidationResult,
} from '../builder.types';

@Injectable()
export class ValidationService {
  beginStage(stage: BuildStage): {
    stage: BuildStage;
    startedAt: Date;
  } {
    return {
      stage,
      startedAt: new Date(),
    };
  }

  finishStage(input: {
    stage: BuildStage;
    startedAt: Date;
    status: StageStatus;
    reasonCode: string;
    evidenceRefs?: string[];
  }): StageResult {
    const finishedAt = new Date();
    return {
      stage: input.stage,
      status: input.status,
      startedAt: input.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - input.startedAt.getTime(),
      reasonCode: input.reasonCode,
      evidenceRefs: input.evidenceRefs ?? [],
    };
  }

  buildValidationResult(input: {
    profile: ExecutionProfile;
    stageResults: StageResult[];
    checks: ValidationResult['checks'];
    tests: ValidationResult['tests'];
  }): ValidationResult {
    const failedStage =
      input.stageResults.find((result) => result.status === StageStatus.FAIL)
        ?.stage ?? null;
    const overall = failedStage ? StageStatus.FAIL : StageStatus.PASS;

    return {
      profile: input.profile,
      overall,
      failedStage,
      checks: input.checks,
      tests: input.tests,
    };
  }
}
