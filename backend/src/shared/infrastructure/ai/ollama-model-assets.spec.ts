import { readFileSync } from 'fs';
import * as path from 'path';

describe('Ollama builder assets', () => {
  it('keeps Modelfiles thin and focused on inference profile instead of business policy', () => {
    const planModelfile = readFileSync(
      path.resolve(__dirname, '../../../../scripts/ollama-plan.Modelfile'),
      'utf8',
    );
    const evalModelfile = readFileSync(
      path.resolve(__dirname, '../../../../scripts/ollama-eval.Modelfile'),
      'utf8',
    );
    const qualityModelfile = readFileSync(
      path.resolve(__dirname, '../../../../scripts/ollama-quality.Modelfile'),
      'utf8',
    );

    for (const modelfile of [
      planModelfile,
      evalModelfile,
      qualityModelfile,
    ]) {
      expect(modelfile).toContain('PARAMETER num_ctx');
      expect(modelfile).toContain('PARAMETER temperature');
      expect(modelfile).toContain('PARAMETER top_p');
      expect(modelfile).toContain('PARAMETER repeat_penalty');
      expect(modelfile).toContain('Runtime prompt instructions are the source of truth.');
      expect(modelfile).not.toContain('Taxonomia estructural');
      expect(modelfile).not.toContain('observedEvidence');
      expect(modelfile).not.toContain('Capacidades');
    }
  });

  it('loads explicit Modelfile templates during ollama bootstrap', () => {
    const bootstrapScript = readFileSync(
      path.resolve(__dirname, '../../../../scripts/ollama-bootstrap.mjs'),
      'utf8',
    );

    expect(bootstrapScript).toContain('ollama-plan.Modelfile');
    expect(bootstrapScript).toContain('ollama-eval.Modelfile');
    expect(bootstrapScript).toContain('ollama-quality.Modelfile');
    expect(bootstrapScript).toContain('readFile');
  });

  it('documents prompts as source of truth and keeps bootstrap contract aligned', () => {
    const compose = readFileSync(
      path.resolve(__dirname, '../../../../../docker-compose.yml'),
      'utf8',
    );
    const readme = readFileSync(
      path.resolve(__dirname, '../../../../scripts/README.md'),
      'utf8',
    );

    expect(compose).toContain(
      'QUALITY_MODEL_NAME: ${BUILDER_OLLAMA_QUALITY_MODEL:-dockus-builder-quality}',
    );
    expect(compose).toContain(
      'QUALITY_BASE_MODEL: ${QUALITY_BASE_MODEL:-deepseek-r1:8b}',
    );
    expect(readme).toContain('source of truth');
    expect(readme).toContain('prompts.json');
    expect(readme).toContain('runtime profiles');
  });
});
