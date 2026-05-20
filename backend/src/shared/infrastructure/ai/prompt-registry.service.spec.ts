import { readFileSync } from 'fs';
import * as path from 'path';

import { PromptBundle, renderPromptBundle } from './prompt.types';

describe('prompts.json', () => {
  function loadManifest(): Record<string, PromptBundle> {
    const manifestPath = path.resolve(__dirname, 'prompts.json');
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      PromptBundle
    >;
  }

  it('stores each builder prompt as a structured bundle with stable sections', () => {
    const manifest = loadManifest();

    for (const key of ['plan', 'eval', 'repair', 'technical-feedback']) {
      expect(manifest[key]).toEqual(
        expect.objectContaining({
          role: expect.any(String),
          task: expect.any(String),
          hard_rules: expect.any(Array),
          schema_contract: expect.any(String),
          decision_policy: expect.any(Array),
        }),
      );
      expect(manifest[key].hard_rules.length).toBeGreaterThan(2);
      expect(manifest[key].decision_policy.length).toBeGreaterThan(1);
    }
  });

  it('renders bundles into canonical system prompts with named sections', () => {
    const manifest = loadManifest();

    const renderedPlan = renderPromptBundle(manifest.plan);
    const renderedEval = renderPromptBundle(manifest.eval);

    expect(renderedPlan).toContain('ROLE');
    expect(renderedPlan).toContain('HARD RULES');
    expect(renderedPlan).toContain('SCHEMA CONTRACT');
    expect(renderedPlan).toContain('DECISION POLICY');

    expect(renderedEval).toContain('EXAMPLES');
    expect(renderedEval).toContain('builder-llm/v2');
    expect(renderedEval).toContain('expectedOutput');
  });

  it('documents anti-hallucination planning rules for CLI, C, and service inference', () => {
    const manifest = loadManifest();
    const hardRules = manifest.plan.hard_rules.join('\n');
    const policy = manifest.plan.decision_policy.join('\n');

    expect(hardRules).toContain('Cada comando es un array de tokens');
    expect(hardRules).toContain('Makefile');
    expect(hardRules).toContain('.c');
    expect(hardRules).toContain('service=null');
    expect(hardRules).toContain('NUNCA pongas make, gcc');
    expect(hardRules).toContain('recipe.install es el paso de COMPILACI');
    expect(policy).toContain('Para C con Makefile');
    expect(hardRules).toContain('run=null');
    expect(policy).toContain('recipe segura');
    expect(policy).toContain("recipe.run=['./TARGET']");
  });

  it('documents evidence-first adjudication and pedagogical review priorities', () => {
    const manifest = loadManifest();

    expect(manifest.eval.hard_rules.join('\n')).toContain('observedEvidence');
    expect(manifest.eval.hard_rules.join('\n')).toContain('PROHIBIDO INVENTAR SALIDA');
    expect(manifest.eval.decision_policy.join('\n')).toContain(
      'ANTES de evaluar criterios de r',
    );

    const qualityRules = manifest['technical-feedback'].hard_rules.join('\n');
    const qualityPolicy =
      manifest['technical-feedback'].decision_policy.join('\n');

    expect(qualityRules).toContain('BUENA PR');
    expect(qualityRules).toContain('malloc sin free');
    expect(qualityRules).toContain('off-by-one');
    expect(qualityRules).toContain('impide aprobar');
    expect(qualityRules).toContain('codeSnippet');
    expect(qualityRules).toContain('conceptExplanation');
    expect(qualityPolicy).toContain('Primero clasifica bloqueos de aprobaci');
  });

  it('documents anti-hallucination eval rules for fabricated output and vacuous truth', () => {
    const manifest = loadManifest();
    const evalRules = manifest.eval.hard_rules.join('\n');
    const evalPolicy = manifest.eval.decision_policy.join('\n');

    expect(evalRules).toContain('PROHIBIDO INVENTAR SALIDA');
    expect(evalRules).toContain('DISTINGUE compilaci');
    expect(evalRules).toContain('nota m');
    expect(evalRules).toContain('VERDAD VACUA');
    expect(evalRules).toContain('archivo');
    expect(evalPolicy).toContain('ANTES de evaluar criterios de r');
    expect(evalPolicy).toContain('evaluativeState=E3');
    expect(evalRules).toContain('NUNCA repitas el mismo argumento');
  });

  it('documents minimum findings and mandatory good practices for quality analysis', () => {
    const manifest = loadManifest();
    const qualityRules = manifest['technical-feedback'].hard_rules.join('\n');
    const qualityPolicy = manifest['technical-feedback'].decision_policy.join('\n');

    expect(qualityRules).toContain('NIMO de 3 hallazgos totales');
    expect(qualityRules).toContain('BUENA PR');
    expect(qualityRules).toContain('pr');
    expect(qualityPolicy).toContain('rubricCompliance');
  });
});
