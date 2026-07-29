import {
  BuildRunArtifactType,
  STAFF_ONLY_BUILD_RUN_ARTIFACT_TYPES,
  isStaffOnlyBuildRunArtifactType,
} from './build-run-artifact.entity';

describe('BuildRunArtifactType', () => {
  it('uses Docker-first persisted values for runtime diagnostics', () => {
    expect(BuildRunArtifactType.RUNTIME_EVENTS).toBe('RUNTIME_EVENTS');
    expect(BuildRunArtifactType.CONTAINER_INSPECT).toBe('CONTAINER_INSPECT');
    expect(BuildRunArtifactType.CONTAINER_LOG).toBe('CONTAINER_LOG');
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
    ).toBe(false);
  });

  it('treats every LLM_-prefixed member as staff-only, and no other member as staff-only', () => {
    for (const type of Object.values(BuildRunArtifactType)) {
      expect(isStaffOnlyBuildRunArtifactType(type)).toBe(
        type.startsWith('LLM_'),
      );
    }
  });
});
