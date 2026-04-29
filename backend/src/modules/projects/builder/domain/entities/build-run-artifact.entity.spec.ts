import { BuildRunArtifactType } from './build-run-artifact.entity';

describe('BuildRunArtifactType', () => {
  it('uses Docker-first persisted values for runtime diagnostics', () => {
    expect(BuildRunArtifactType.RUNTIME_EVENTS).toBe('RUNTIME_EVENTS');
    expect(BuildRunArtifactType.CONTAINER_INSPECT).toBe('CONTAINER_INSPECT');
    expect(BuildRunArtifactType.CONTAINER_LOG).toBe('CONTAINER_LOG');
  });
});
