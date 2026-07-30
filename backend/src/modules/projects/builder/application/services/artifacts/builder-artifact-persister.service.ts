/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-artifact-persister.service).
 *
 * @module builder-artifact-persister.service
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  BuilderCodeQualityContractV2,
  BuilderLlmStagePromptSnapshot,
  BuilderLlmContractV2,
  BuilderLlmStageTrace,
  BuilderCodeQualityPromptSnapshot,
  BuilderCodeQualityTrace,
  CODE_QUALITY_CATEGORIES,
  EvidenceArtifactPublic,
} from '../../../domain/builder.types';
import { BuildRunArtifactType } from '../../../domain/entities/build-run-artifact.entity';
import type { ICodeQualityFindingRepository } from '../../../domain/repositories/code-quality-finding.repository.interface';
import { CODE_QUALITY_FINDING_REPOSITORY } from '../../../domain/repositories/code-quality-finding.repository.interface';
import { EvidenceService } from '../../../infrastructure/evidence/evidence.service';
import { BuilderRunSupportService } from '../orchestration/builder-run-support.service';

@Injectable()
export class BuilderArtifactPersister {
  constructor(
    @Inject(CODE_QUALITY_FINDING_REPOSITORY)
    private readonly codeQualityFindingsRepository: ICodeQualityFindingRepository,
    private readonly evidenceService: EvidenceService,
    private readonly builderRunSupportService: BuilderRunSupportService,
  ) {}

  async persistCodeQualityFindingRows(
    buildRunId: string,
    projectId: string,
    studentId: string,
    findings: BuilderCodeQualityContractV2,
  ): Promise<void> {
    await this.codeQualityFindingsRepository.deleteByProjectAndStudent(
      projectId,
      studentId,
    );

    const rows = CODE_QUALITY_CATEGORIES.flatMap((category) =>
      findings[category].map((finding) => ({
        buildRunId,
        projectId,
        studentId,
        category,
        title: finding.title,
        detail: finding.detail,
        severity: finding.severity,
        file: finding.file ?? null,
        line: finding.line ?? null,
        codeSnippet: finding.codeSnippet,
        level: finding.level ?? 'basico',
        conceptExplanation: finding.conceptExplanation,
      })),
    );

    await this.codeQualityFindingsRepository.saveMany(rows);
  }

  async persistPromptArtifact(
    buildRunId: string,
    snapshot: BuilderLlmStagePromptSnapshot,
  ): Promise<void> {
    const artifactType =
      snapshot.stage === 'plan'
        ? BuildRunArtifactType.LLM_PLAN_PROMPT
        : snapshot.stage === 'facts'
          ? BuildRunArtifactType.LLM_FACTS_PROMPT
          : BuildRunArtifactType.LLM_EVAL_PROMPT;
    const promptId = snapshot.promptId ?? `${snapshot.stage}-legacy`;
    const model = snapshot.model;
    const modelProfile = snapshot.modelProfile;
    const sections = snapshot.sections;
    const modelId = modelProfile?.modelId ?? 'unknown';
    const profileVersion = modelProfile?.profileVersion ?? 'legacy';

    const renderedPrompt = [
      `stage: ${snapshot.stage}`,
      `promptId: ${promptId}`,
      `model: ${model}`,
      `modelId: ${modelId}`,
      `profileVersion: ${profileVersion}`,
      `createdAt: ${snapshot.createdAt}`,
      '',
      '[MODEL PROFILE]',
      JSON.stringify(modelProfile, null, 2),
      '',
      '[PROMPT SECTIONS]',
      JSON.stringify(sections, null, 2),
      '',
      '[SYSTEM PROMPT]',
      snapshot.systemPrompt ?? '',
      '',
      '[USER PROMPT]',
      snapshot.prompt,
      '',
    ].join('\n');

    await this.persistTextArtifact(
      buildRunId,
      artifactType,
      renderedPrompt,
      `Prompt ${snapshot.stage} persistido para debugging.`,
    );
  }

  async persistQualityPromptArtifact(
    buildRunId: string,
    snapshot: BuilderCodeQualityPromptSnapshot,
  ): Promise<void> {
    const promptId = snapshot.promptId ?? 'quality-legacy';
    const model = snapshot.model ?? 'unknown';
    const modelProfile = snapshot.modelProfile ?? null;
    const sections = snapshot.sections ?? [];
    const modelId = modelProfile?.modelId ?? 'unknown';
    const profileVersion = modelProfile?.profileVersion ?? 'legacy';

    const renderedPrompt = [
      'stage: quality',
      `promptId: ${promptId}`,
      `model: ${model}`,
      `modelId: ${modelId}`,
      `profileVersion: ${profileVersion}`,
      `createdAt: ${snapshot.createdAt}`,
      '',
      '[MODEL PROFILE]',
      JSON.stringify(modelProfile, null, 2),
      '',
      '[PROMPT SECTIONS]',
      JSON.stringify(sections, null, 2),
      '',
      '[SYSTEM PROMPT]',
      snapshot.systemPrompt ?? '',
      '',
      '[USER PROMPT]',
      snapshot.prompt,
      '',
    ].join('\n');

    await this.persistTextArtifact(
      buildRunId,
      BuildRunArtifactType.LLM_QUALITY_PROMPT,
      renderedPrompt,
      'Prompt quality persistido para debugging.',
    );
  }

  async persistStageTraceArtifacts<TContract extends BuilderLlmContractV2>(
    buildRunId: string,
    trace: BuilderLlmStageTrace<TContract>,
  ): Promise<void> {
    const artifactTypes =
      trace.stage === 'plan'
        ? {
            raw: BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE,
            parsed: BuildRunArtifactType.LLM_PLAN_PARSED,
            error: BuildRunArtifactType.LLM_PLAN_ERROR,
          }
        : trace.stage === 'facts'
          ? {
              raw: BuildRunArtifactType.LLM_FACTS_RAW_RESPONSE,
              parsed: BuildRunArtifactType.LLM_FACTS_PARSED,
              error: BuildRunArtifactType.LLM_FACTS_ERROR,
            }
          : {
              raw: BuildRunArtifactType.LLM_EVAL_RAW_RESPONSE,
              parsed: BuildRunArtifactType.LLM_EVAL_PARSED,
              error: BuildRunArtifactType.LLM_EVAL_ERROR,
            };

    if (trace.rawResponse !== null) {
      await this.persistTextArtifact(
        buildRunId,
        artifactTypes.raw,
        trace.rawResponse,
        `Respuesta bruta ${trace.stage} persistida para debugging.`,
      );
    }

    if (trace.parsedContract) {
      await this.persistJsonArtifact(
        buildRunId,
        artifactTypes.parsed,
        trace.parsedContract,
        `Contrato parseado ${trace.stage} persistido para debugging.`,
      );
    }

    if (trace.error) {
      await this.persistJsonArtifact(
        buildRunId,
        artifactTypes.error,
        {
          stage: trace.stage,
          promptId: trace.promptId ?? `${trace.stage}-legacy`,
          model: trace.model,
          modelProfile: trace.modelProfile,
          sections: trace.sections ?? [],
          code: trace.error.code ?? null,
          httpStatus: trace.error.httpStatus ?? null,
          timestamp: trace.error.timestamp,
          error: trace.error,
          rawResponseCaptured: trace.rawResponse !== null,
        },
        `Error ${trace.stage} persistido para debugging.`,
      );
    }
  }

  async persistQualityTraceArtifacts(
    buildRunId: string,
    trace: BuilderCodeQualityTrace,
  ): Promise<void> {
    if (trace.rawResponse !== null) {
      await this.persistTextArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_RAW_RESPONSE,
        trace.rawResponse,
        'Respuesta bruta quality persistida para debugging.',
      );
    }

    if (trace.parsedContract) {
      await this.persistJsonArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_PARSED,
        trace.parsedContract,
        'Contrato parseado quality persistido para debugging.',
      );
    }

    if (trace.error) {
      await this.persistJsonArtifact(
        buildRunId,
        BuildRunArtifactType.LLM_QUALITY_ERROR,
        {
          stage: 'quality',
          promptId: trace.promptId ?? 'quality-legacy',
          model: trace.model ?? 'unknown',
          modelProfile: trace.modelProfile ?? null,
          sections: trace.sections ?? [],
          code: trace.error.code ?? null,
          httpStatus: trace.error.httpStatus ?? null,
          timestamp: trace.error.timestamp,
          error: trace.error,
          rawResponseCaptured: trace.rawResponse !== null,
        },
        'Error quality persistido para debugging.',
      );
    }
  }

  async persistTextArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    text: string,
    message: string,
  ): Promise<void> {
    await this.persistArtifact(
      buildRunId,
      type,
      () => this.evidenceService.persistTextArtifact(buildRunId, type, text),
      message,
    );
  }

  async persistJsonArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    payload: unknown,
    message: string,
  ): Promise<void> {
    await this.persistArtifact(
      buildRunId,
      type,
      () => this.evidenceService.persistJsonArtifact(buildRunId, type, payload),
      message,
    );
  }

  private async persistArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    operation: () => Promise<EvidenceArtifactPublic>,
    message: string,
  ): Promise<void> {
    try {
      const artifact = await operation();
      await this.builderRunSupportService.emitEvent({
        buildRunId,
        eventType: 'ARTIFACT_ADDED',
        message,
        payload: { artifactId: artifact.id, type },
      });
    } catch (artifactError) {
      await this.builderRunSupportService.emitEvent({
        buildRunId,
        eventType: 'LOG_CHUNK',
        message: `Error al persistir artefacto ${type}: ${this.builderRunSupportService.toErrorMessage(artifactError)}`,
      });
    }
  }
}
