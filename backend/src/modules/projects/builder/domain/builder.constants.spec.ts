import * as builderConstants from './builder.constants';

describe('builder constants cleanup', () => {
  it('does not export dead constants anymore', () => {
    expect('CLASSIFIER_VERSION' in builderConstants).toBe(false);
    expect('DEFAULT_LOG_TAIL_LINES' in builderConstants).toBe(false);
    expect('DEFAULT_STATIC_REVIEW_TIMEOUT_MS' in builderConstants).toBe(false);
    expect('DEFAULT_PYTHON_VERSION' in builderConstants).toBe(false);
    expect('DEFAULT_WORKSPACE_NETWORK_PREFIX' in builderConstants).toBe(false);
  });
});
