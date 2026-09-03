import { readFileSync } from 'fs';
import * as path from 'path';

import {
  PromptBundle,
  renderPromptBundle,
} from '@app/shared/infrastructure/ai/prompt.types';
import { parseBuilderEvaluationContractV3 } from '@app/modules/projects/builder/domain/ai/builder-evaluation-contract-v3.parser';
import { parseBuilderReportCopyContractV1 } from '@app/modules/projects/builder/domain/ai/builder-report-copy-contract.parser';

describe('prompts.json', () => {
  function loadManifest(): Record<string, PromptBundle> {
    const manifestPath = path.resolve(
      process.cwd(),
      'src/shared/infrastructure/ai/prompts.json',
    );
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<
      string,
      PromptBundle
    >;
  }

  it('stores each builder prompt as a structured bundle with stable sections', () => {
    const manifest = loadManifest();

    for (const key of ['plan', 'eval', 'reporting', 'technical-feedback']) {
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
      if (key !== 'reporting') {
        expect(manifest[key].decision_policy?.length).toBeGreaterThan(1);
      }
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
    expect(renderedEval).toContain('builder-evaluation/v3');
    expect(renderedEval).toContain('expectedOutput');
  });

  it('documents anti-hallucination planning rules for CLI, C, and service inference', () => {
    const manifest = loadManifest();
    const hardRules = manifest.plan.hard_rules.join('\n');
    const policy = manifest.plan.decision_policy?.join('\n');

    expect(hardRules).toContain(
      'Cada comando debe ser un array de tokens de tipo string',
    );
    const examples = manifest.plan.examples?.join('\n');
    expect(policy).toContain('Makefile');
    expect(examples).toContain('.c');
    expect(hardRules).toContain('recipe.install es la fase de compilación');
    expect(hardRules).toContain(
      'Las invocaciones del compilador o herramienta de construcción nunca aparecen en recipe.run',
    );
    expect(policy).toContain('Proyecto C con Makefile');
    expect(policy).toContain("recipe.install=[['make']]");
    expect(policy).toContain('Alinea C3 y C5 con recipe.service');
  });

  it('documents evidence-first adjudication and pedagogical review priorities', () => {
    const manifest = loadManifest();

    expect(manifest.eval.hard_rules.join('\n')).toContain('evidenceRefs');
    expect(manifest.eval.hard_rules.join('\n')).toContain(
      'NUNCA inventes salida del programa',
    );
    expect(manifest.eval.decision_policy?.join('\n')).toContain(
      'Antes de puntuar cualquier criterio',
    );

    const qualityRules = manifest['technical-feedback'].hard_rules.join('\n');
    const qualityPolicy =
      manifest['technical-feedback'].decision_policy?.join('\n');

    expect(qualityRules).toContain('BUENA PR');
    expect(qualityPolicy).toContain('malloc sin free');
    expect(qualityPolicy).toContain('desbordamiento de buffer');
    expect(qualityRules).toContain('codeSnippet');
    expect(qualityRules).toContain('conceptExplanation');
    expect(qualityPolicy).toContain('rubricCompliance');
    expect(qualityPolicy).toContain('impacto de aprendizaje');
  });

  it('documents anti-hallucination eval rules for fabricated output and vacuous truth', () => {
    const manifest = loadManifest();
    const evalRules = manifest.eval.hard_rules.join('\n');
    const evalPolicy = manifest.eval.decision_policy?.join('\n');

    expect(evalRules).toContain('NUNCA inventes salida del programa');
    expect(evalRules).toContain(
      'Los mensajes del compilador y de las herramientas de construcción',
    );
    expect(evalRules).toContain('recommendedGrade');
    expect(evalRules).toContain('VERDAD VACUA');
    expect(evalRules).toContain('evidenceRefs');
    expect(evalPolicy).toContain('Antes de puntuar cualquier criterio');
    expect(evalPolicy).toContain('evaluativeState=E3');
    expect(evalPolicy).toContain('Archivos vacíos o stub');
  });

  it('documents minimum findings and mandatory good practices for quality analysis', () => {
    const manifest = loadManifest();
    const qualityRules = manifest['technical-feedback'].hard_rules.join('\n');
    const qualityPolicy =
      manifest['technical-feedback'].decision_policy!.join('\n');

    expect(qualityRules).toContain('Mínimo 3 hallazgos en total');
    expect(qualityRules).toContain('BUENA PR');
    expect(qualityPolicy).toContain('impacto de aprendizaje');
    expect(qualityPolicy).toContain('rubricCompliance');
  });

  it('keeps evaluation and reporting JSON examples compatible with their strict schemas', () => {
    const manifest = loadManifest();
    const evaluationExample = manifest.eval.json_examples?.[0];
    const reportingExample = manifest.reporting.json_examples?.[0];

    expect(evaluationExample).toBeDefined();
    expect(reportingExample).toBeDefined();
    expect(() =>
      parseBuilderEvaluationContractV3(evaluationExample as string),
    ).not.toThrow();
    expect(() =>
      parseBuilderReportCopyContractV1(reportingExample as string),
    ).not.toThrow();
  });
});
/**
 * Pruebas de carga, selección y resolución de prompts registrados.
 */
