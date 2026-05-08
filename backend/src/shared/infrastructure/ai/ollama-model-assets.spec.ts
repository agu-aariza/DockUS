import { readFileSync } from 'fs';
import * as path from 'path';

describe('Ollama builder assets', () => {
  it('keeps the plan, eval and quality Modelfiles aligned with builder stages', () => {
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

    expect(planModelfile).toContain('Python y C');
    expect(planModelfile).toContain('Makefile');
    expect(planModelfile).toContain('CMakeLists.txt');
    expect(planModelfile).toContain('c99');
    expect(planModelfile).toContain('c11');
    expect(planModelfile).toContain('c17');
    expect(planModelfile).toContain('gcc');

    expect(evalModelfile).toContain('expectedOutput');
    expect(evalModelfile).toContain('segfault');
    expect(evalModelfile).toContain('memory leak');
    expect(evalModelfile).toContain('undefined reference');
    expect(evalModelfile).toContain('warnings de compilación');

    expect(qualityModelfile).toContain('feedback técnico');
    expect(qualityModelfile).toContain('seguridad');
    expect(qualityModelfile).toContain('arquitectura');
    expect(qualityModelfile).toContain('calidad');
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

  it('keeps docker compose and bootstrap documentation aligned with the quality model contract', () => {
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
      'QUALITY_BASE_MODEL: ${QUALITY_BASE_MODEL:-deepseek-r1:1.5b}',
    );
    expect(compose).not.toMatch(/\n\s+MODEL_NAME:/);

    expect(readme).toContain('QUALITY_MODEL_NAME');
    expect(readme).toContain('QUALITY_BASE_MODEL');
    expect(readme).not.toMatch(/-\s+`MODEL_NAME`/);
  });
});
