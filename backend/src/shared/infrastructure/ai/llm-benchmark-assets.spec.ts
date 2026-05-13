import { readFileSync } from 'fs';
import * as path from 'path';

describe('LLM benchmark assets', () => {
  it('defines benchmark cases that cover the golden failure and success scenarios', () => {
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(
          __dirname,
          '../../../../scripts/llm-benchmark/benchmark-manifest.json',
        ),
        'utf8',
      ),
    ) as {
      cases: Array<{ id: string; stages: string[] }>;
    };

    const caseIds = manifest.cases.map((entry) => entry.id);
    expect(caseIds).toEqual(
      expect.arrayContaining([
        'python-cli-calculator',
        'c-cli-oracle-args',
        'task-manager-api',
        'format-equivalent-output',
        'broken-c-compile',
        'legacy-hybrid-ambiguous',
        'quality-strengths-and-mustfix',
      ]),
    );
  });

  it('keeps golden expectations aligned with the benchmark cases', () => {
    const manifest = JSON.parse(
      readFileSync(
        path.resolve(
          __dirname,
          '../../../../scripts/llm-benchmark/benchmark-manifest.json',
        ),
        'utf8',
      ),
    ) as {
      cases: Array<{ id: string; stages: string[] }>;
    };

    const golden = JSON.parse(
      readFileSync(
        path.resolve(
          __dirname,
          '../../../../scripts/llm-benchmark/benchmark-golden-results.json',
        ),
        'utf8',
      ),
    ) as {
      expectations: Array<{ caseId: string; stage: string }>;
    };

    const expectedStagePairs = new Set(
      manifest.cases.flatMap((entry) =>
        entry.stages.map((stage) => `${entry.id}:${stage}`),
      ),
    );

    for (const expectation of golden.expectations) {
      expect(expectedStagePairs.has(`${expectation.caseId}:${expectation.stage}`)).toBe(
        true,
      );
    }
  });
});
