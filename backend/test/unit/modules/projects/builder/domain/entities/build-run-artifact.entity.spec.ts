import {
  BuildRunArtifactType,
  STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES,
  isStaffOnlyBuildRunArtifactType,
} from '@app/modules/projects/builder/domain/entities/build-run-artifact.entity';

describe('BuildRunArtifactType', () => {
  it('uses the persisted report and LLM trace values', () => {
    expect(BuildRunArtifactType.REPORT_JSON).toBe('REPORT_JSON');
    expect(BuildRunArtifactType.LLM_FACTS_PROMPT).toBe('LLM_FACTS_PROMPT');
  });

  it('persists explicit LLM debug artifact types for planner and evaluator traces', () => {
    expect(BuildRunArtifactType.LLM_PLAN_PROMPT).toBe('LLM_PLAN_PROMPT');
    expect(BuildRunArtifactType.LLM_PLAN_RAW_RESPONSE).toBe(
      'LLM_PLAN_RAW_RESPONSE',
    );
    expect(BuildRunArtifactType.LLM_PLAN_PARSED).toBe('LLM_PLAN_PARSED');
    expect(BuildRunArtifactType.LLM_PLAN_ERROR).toBe('LLM_PLAN_ERROR');
    expect(BuildRunArtifactType.LLM_EVAL_PROMPT).toBe('LLM_EVAL_PROMPT');
    expect(BuildRunArtifactType.LLM_EVAL_RAW_RESPONSE).toBe(
      'LLM_EVAL_RAW_RESPONSE',
    );
    expect(BuildRunArtifactType.LLM_EVAL_PARSED).toBe('LLM_EVAL_PARSED');
    expect(BuildRunArtifactType.LLM_EVAL_ERROR).toBe('LLM_EVAL_ERROR');
  });

  it('marks LLM debug artifacts as staff-only', () => {
    expect(STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES).toContain(
      BuildRunArtifactType.LLM_PLAN_PROMPT,
    );
    expect(
      isStaffOnlyBuildRunArtifactType(BuildRunArtifactType.LLM_EVAL_ERROR),
    ).toBe(true);
    expect(
      isStaffOnlyBuildRunArtifactType(BuildRunArtifactType.REPORT_JSON),
    ).toBe(true);
  });

  it('treats REPORT_JSON and every LLM artifact as staff-only', () => {
    for (const type of Object.values(BuildRunArtifactType)) {
      expect(isStaffOnlyBuildRunArtifactType(type)).toBe(
        type === BuildRunArtifactType.REPORT_JSON || type.startsWith('LLM_'),
      );
    }
  });
});
/**
 * Pruebas de la entidad de artefactos asociados a una ejecución del Builder.
 */
