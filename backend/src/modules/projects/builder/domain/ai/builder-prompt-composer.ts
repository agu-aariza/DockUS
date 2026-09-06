/**
 * @fileoverview Motor Builder de evaluación asíncrona (builder-prompt-composer).
 *
 * @module builder-prompt-composer
 */

import type {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderEvaluationContractV3,
  BuilderFactsContractV2,
  BuilderPlanContractV2,
} from '../builder.types';
import { runtimeCatalogToText, selectFewShotExample } from '../runtime-catalog';
import type {
  ComposedPromptPayload,
  PromptSectionBudget,
  PromptSectionInput,
  PromptSectionPriority,
} from './prompt-composer.types';

// Se re-exportan para no romper los imports existentes que tomaban estos tipos
// desde el compositor.
export type { ComposedPromptPayload } from './prompt-composer.types';

const PRIORITY_ORDER: PromptSectionPriority[] = [
  'low',
  'medium',
  'high',
  'critical',
];

const PLAN_PROMPT_MAX_SECTION_CHARS: Record<string, PromptSectionBudget> = {
  runtimeCatalog: { preferredChars: 1200, reserveChars: 80 },
  expectations: { preferredChars: 1600, reserveChars: 80 },
  oracle: { preferredChars: 1800, reserveChars: 80 },
  rubric: { preferredChars: 3000, reserveChars: 96 },
  workspace: { preferredChars: 12000, reserveChars: 400 },
  fewShots: { preferredChars: 2500, reserveChars: 120 },
};

const FACTS_PROMPT_MAX_SECTION_CHARS: Record<string, PromptSectionBudget> = {
  logs: { preferredChars: 12000, reserveChars: 400 },
  oracle: { preferredChars: 2500, reserveChars: 96 },
  source: { preferredChars: 6000, reserveChars: 160 },
};

const EVAL_PROMPT_MAX_SECTION_CHARS: Record<string, PromptSectionBudget> = {
  facts: { preferredChars: 6000, reserveChars: 160 },
  source: { preferredChars: 8000, reserveChars: 160 },
  rubric: { preferredChars: 3500, reserveChars: 120 },
  oracle: { preferredChars: 2500, reserveChars: 96 },
  plannerSummary: { preferredChars: 1200, reserveChars: 80 },
};

const QUALITY_PROMPT_MAX_SECTION_CHARS: Record<string, PromptSectionBudget> = {
  context: { preferredChars: 3500, reserveChars: 120 },
  assessment: { preferredChars: 7000, reserveChars: 160 },
  source: { preferredChars: 10000, reserveChars: 200 },
  logs: { preferredChars: 4000, reserveChars: 120 },
};

const REPORTING_PROMPT_MAX_SECTION_CHARS: Record<string, PromptSectionBudget> =
  {
    evaluation: { preferredChars: 14000, reserveChars: 800 },
  };

/**
 * Renderiza la sección de rúbrica combinando las instrucciones docentes en
 * texto libre con los criterios ponderados estructurados (si existen). Los
 * pesos son porcentajes que suman 100 y guían al evaluador para repartir la
 * nota final de forma proporcional a la importancia de cada criterio.
 */
function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function renderRubricSection(
  assignmentContext: AssignmentContext,
): string {
  const parts: string[] = [];

  const criteria = assignmentContext.rubricCriteria;
  if (criteria && criteria.length > 0) {
    // Los pesos se expresan al modelo directamente en puntos sobre 10, no en
    // porcentajes: pedirle porcentajes y a la vez un desglose en puntos le deja
    // elegir la escala, y si elige la porcentual la suma se dispara por encima
    // de 10.
    const lines = criteria.map(
      (criterion) =>
        `- ${criterion.name} (maxPoints: ${roundToTwoDecimals(criterion.weight / 10)})` +
        (criterion.description ? `: ${criterion.description}` : ''),
    );
    parts.push(
      [
        'WEIGHTED RUBRIC CRITERIA. The maxPoints shown are already expressed on the 0-10 final scale and add up to 10.',
        'In criteria, reuse each criterion name and its maxPoints verbatim, and set awarded between 0 and maxPoints. recommendedGrade is the exact sum of the awarded values.',
        ...lines,
      ].join('\n'),
    );
  }

  const instructions = assignmentContext.rubricInstructions?.trim();
  if (instructions) {
    parts.push(instructions);
  }

  return parts.length > 0
    ? parts.join('\n\n')
    : 'No rubric instructions were provided.';
}

export function composePlanPrompt(
  sourceCodePayload: string,
  assignmentContext: AssignmentContext,
  maxChars: number,
): ComposedPromptPayload {
  return composePromptSections(
    [
      {
        label: 'RUNTIME CATALOG',
        content: runtimeCatalogToText(),
        priority: 'critical',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.runtimeCatalog,
      },
      {
        label: 'PROFESSOR EXPECTATIONS',
        content: `Expected project type:\n${assignmentContext.expectedType ?? 'Not specified.'}`,
        priority: 'critical',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.expectations,
      },
      {
        label: 'EXPECTED OUTPUT ORACLE',
        content:
          assignmentContext.expectedOutput ??
          'No exact expected output was defined.',
        priority: 'critical',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.oracle,
      },
      {
        label: 'RUBRIC INSTRUCTIONS',
        content: renderRubricSection(assignmentContext),
        priority: 'critical',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.rubric,
      },
      {
        label: 'STUDENT WORKSPACE',
        content: sourceCodePayload || 'Workspace empty.',
        priority: 'high',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.workspace,
      },
      {
        label: 'FEW-SHOT EXAMPLES',
        content: selectFewShotExample(assignmentContext.expectedType),
        priority: 'low',
        budget: PLAN_PROMPT_MAX_SECTION_CHARS.fewShots,
      },
    ],
    maxChars,
  );
}

export function composeFactsPrompt(
  sourceCodePayload: string,
  executionLogs: string,
  assignmentContext: AssignmentContext,
  maxChars: number,
): ComposedPromptPayload {
  return composePromptSections(
    [
      {
        label: 'EXECUTION LOGS',
        content: executionLogs || 'No execution logs were captured.',
        priority: 'high',
        budget: FACTS_PROMPT_MAX_SECTION_CHARS.logs,
      },
      {
        label: 'EXPECTED OUTPUT ORACLE',
        content:
          assignmentContext.expectedOutput ??
          'No exact expected output was defined.',
        priority: 'critical',
        budget: FACTS_PROMPT_MAX_SECTION_CHARS.oracle,
      },
      {
        label: 'SOURCE EXCERPTS',
        content: sourceCodePayload || 'Workspace empty.',
        priority: 'medium',
        budget: FACTS_PROMPT_MAX_SECTION_CHARS.source,
      },
    ],
    maxChars,
  );
}

export function composeEvaluationPrompt(
  sourceCodePayload: string,
  facts: BuilderFactsContractV2,
  assignmentContext: AssignmentContext,
  plannerAssessment: BuilderPlanContractV2 | undefined,
  maxChars: number,
): ComposedPromptPayload {
  const plannerSummary = plannerAssessment
    ? JSON.stringify(
        {
          runtime: plannerAssessment.runtime,
          recipe: {
            install: plannerAssessment.recipe.install,
            run: plannerAssessment.recipe.run,
            test: plannerAssessment.recipe.test,
            systemPackages: plannerAssessment.recipe.systemPackages,
            service: plannerAssessment.recipe.service,
          },
          structuralType: plannerAssessment.structuralType,
        },
        null,
        2,
      )
    : 'Planner hypothesis unavailable.';

  return composePromptSections(
    [
      {
        label: 'VERIFIED FACTS',
        content: serializeFactsForPrompt(
          facts,
          EVAL_PROMPT_MAX_SECTION_CHARS.facts.preferredChars ?? 6000,
        ),
        priority: 'critical',
        budget: EVAL_PROMPT_MAX_SECTION_CHARS.facts,
      },
      {
        label: 'SOURCE EXCERPTS',
        content: sourceCodePayload || 'Workspace empty.',
        priority: 'medium',
        budget: EVAL_PROMPT_MAX_SECTION_CHARS.source,
      },
      {
        label: 'RUBRIC INSTRUCTIONS',
        content: renderRubricSection(assignmentContext),
        priority: 'critical',
        budget: EVAL_PROMPT_MAX_SECTION_CHARS.rubric,
      },
      {
        label: 'EXPECTED OUTPUT ORACLE',
        content:
          assignmentContext.expectedOutput ??
          'No exact expected output was defined.',
        priority: 'critical',
        budget: EVAL_PROMPT_MAX_SECTION_CHARS.oracle,
      },
      {
        label: 'PLANNER HYPOTHESIS SUMMARY',
        content: plannerSummary,
        priority: 'medium',
        budget: EVAL_PROMPT_MAX_SECTION_CHARS.plannerSummary,
      },
    ],
    maxChars,
  );
}

export function composeQualityPrompt(
  sourceCodePayload: string,
  executionLogs: string,
  assignmentContext: AssignmentContext,
  assessment: BuilderEvaluationContractV2 | BuilderEvaluationContractV3,
  maxChars: number,
): ComposedPromptPayload {
  const serializedAssessment =
    'criteria' in assessment && Array.isArray(assessment.criteria)
      ? serializeAssessmentForReporting(
          assessment as BuilderEvaluationContractV3,
          QUALITY_PROMPT_MAX_SECTION_CHARS.assessment.preferredChars ?? 7000,
        )
      : JSON.stringify(assessment, null, 2);

  return composePromptSections(
    [
      {
        label: 'ASSIGNMENT CONTEXT',
        content: [
          `Expected project type: ${assignmentContext.expectedType ?? 'Not specified.'}`,
          `Rubric:\n${renderRubricSection(assignmentContext)}`,
          `Expected output oracle: ${assignmentContext.expectedOutput ?? 'No exact expected output was defined.'}`,
        ].join('\n'),
        priority: 'critical',
        budget: QUALITY_PROMPT_MAX_SECTION_CHARS.context,
      },
      {
        label: 'CURRENT ACADEMIC ASSESSMENT',
        content: serializedAssessment,
        priority: 'high',
        budget: QUALITY_PROMPT_MAX_SECTION_CHARS.assessment,
      },
      {
        label: 'SOURCE EXCERPTS',
        content: sourceCodePayload || 'Workspace empty.',
        priority: 'medium',
        budget: QUALITY_PROMPT_MAX_SECTION_CHARS.source,
      },
      {
        label: 'EXECUTION LOGS',
        content: executionLogs || 'No execution logs were captured.',
        priority: 'medium',
        budget: QUALITY_PROMPT_MAX_SECTION_CHARS.logs,
      },
    ],
    maxChars,
  );
}

/**
 * La redacción recibe exclusivamente el contrato de evaluación ya validado.
 * No se incluyen código, logs, oráculo ni prompts docentes en esta frontera.
 */
export function composeReportingPrompt(
  assessment: BuilderEvaluationContractV3,
  maxChars: number,
): ComposedPromptPayload {
  return composePromptSections(
    [
      {
        label: 'VALIDATED EVALUATION',
        content: serializeAssessmentForReporting(
          assessment,
          REPORTING_PROMPT_MAX_SECTION_CHARS.evaluation.preferredChars ?? 14000,
        ),
        priority: 'critical',
        budget: REPORTING_PROMPT_MAX_SECTION_CHARS.evaluation,
      },
    ],
    maxChars,
  );
}

/**
 * Serializa los hechos verificados de ejecución para el prompt del evaluador.
 * Si el contenido excede el presupuesto de la sección, trunca el texto libre
 * de logs (stdout/stderr) y razonamiento interno conservando intactas las
 * propiedades estructurales críticas (exitCode, compilationStatus, matchesOracle,
 * archivos y discrepancias) y garantizando que el resultado sea siempre un JSON válido.
 */
export function serializeFactsForPrompt(
  facts: BuilderFactsContractV2,
  maxChars: number,
): string {
  const raw = JSON.stringify(facts, null, 2);
  if (raw.length <= maxChars) {
    return raw;
  }

  const trimmed: BuilderFactsContractV2 = {
    ...facts,
    evidenceLimits: [...(facts.evidenceLimits || [])],
  };

  if (trimmed.thought && trimmed.thought.length > 300) {
    trimmed.thought = truncateContent(trimmed.thought, 300);
  }
  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  if (trimmed.executionSummary && trimmed.executionSummary.length > 300) {
    trimmed.executionSummary = truncateContent(trimmed.executionSummary, 300);
  }
  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  const trimLines = (lines: string[], targetLength: number): string[] => {
    if (!lines || lines.length === 0) return [];
    const joined = lines.join('\n');
    if (joined.length <= targetLength) return lines;
    return [truncateContent(joined, targetLength)];
  };

  const allowedLogsChars = Math.max(200, maxChars - 1500);
  trimmed.observedStdout = trimLines(
    trimmed.observedStdout ?? [],
    Math.floor(allowedLogsChars * 0.7),
  );
  trimmed.observedStderr = trimLines(
    trimmed.observedStderr ?? [],
    Math.floor(allowedLogsChars * 0.3),
  );

  if (!trimmed.evidenceLimits.includes('logs_truncated_for_context')) {
    trimmed.evidenceLimits.push('logs_truncated_for_context');
  }

  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  if (trimmed.filesPresent && trimmed.filesPresent.length > 20) {
    trimmed.filesPresent = trimmed.filesPresent.slice(0, 20);
  }

  return JSON.stringify(trimmed, null, 2);
}

/**
 * Serializa la evaluación validada para la etapa de redacción de informes (reporting).
 * Si el contenido excede el presupuesto, trunca la narrativa y razonamiento interno
 * conservando los criterios estructurados, hallazgos y evidencias intactos en un JSON válido.
 */
export function serializeAssessmentForReporting(
  assessment: BuilderEvaluationContractV3,
  maxChars: number,
): string {
  const raw = JSON.stringify(assessment, null, 2);
  if (raw.length <= maxChars) {
    return raw;
  }

  const trimmed: BuilderEvaluationContractV3 = {
    ...assessment,
  };

  if (trimmed.thought && trimmed.thought.length > 400) {
    trimmed.thought = truncateContent(trimmed.thought, 400);
  }
  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  if (Array.isArray(trimmed.evidence)) {
    trimmed.evidence = trimmed.evidence.map((ev) => ({
      ...ev,
      detail:
        ev.detail && ev.detail.length > 250
          ? truncateContent(ev.detail, 250)
          : ev.detail,
    }));
  }
  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  if (Array.isArray(trimmed.findings)) {
    trimmed.findings = trimmed.findings.map((f) => ({
      ...f,
      explanation:
        f.explanation && f.explanation.length > 250
          ? truncateContent(f.explanation, 250)
          : f.explanation,
      recommendation:
        f.recommendation && f.recommendation.length > 250
          ? truncateContent(f.recommendation, 250)
          : f.recommendation,
    }));
  }
  if (JSON.stringify(trimmed, null, 2).length <= maxChars) {
    return JSON.stringify(trimmed, null, 2);
  }

  if (Array.isArray(trimmed.criteria)) {
    trimmed.criteria = trimmed.criteria.map((c) => ({
      ...c,
      justification:
        c.justification && c.justification.length > 200
          ? truncateContent(c.justification, 200)
          : c.justification,
    }));
    trimmed.gradeBreakdown = trimmed.criteria;
  }

  return JSON.stringify(trimmed, null, 2);
}

function composePromptSections(
  sections: PromptSectionInput[],
  maxChars: number,
): ComposedPromptPayload {
  const normalizedSections = sections.map((section) => ({
    ...section,
    content: normalizeSectionContent(section.content),
  }));

  const prepared = normalizedSections.map((section) => {
    const originalChars = section.content.length;
    const preferredChars =
      section.budget?.preferredChars ?? section.content.length;
    const reserveChars =
      section.budget?.reserveChars ?? Math.min(64, preferredChars);
    const limitedContent = truncateContent(
      section.content,
      Math.min(section.content.length, preferredChars),
    );
    return {
      ...section,
      originalChars,
      reserveChars: Math.max(0, Math.min(reserveChars, limitedContent.length)),
      content: limitedContent,
    };
  });

  const rendered = renderPreparedSections(prepared);
  if (rendered.length <= maxChars) {
    return buildPayload(prepared);
  }

  let overflow = rendered.length - maxChars;
  for (const priority of PRIORITY_ORDER) {
    for (const section of prepared.filter(
      (candidate) => candidate.priority === priority,
    )) {
      if (overflow <= 0) {
        break;
      }

      const reducibleChars = section.content.length - section.reserveChars;
      if (reducibleChars <= 0) {
        continue;
      }

      const reduction = Math.min(reducibleChars, overflow);
      section.content = truncateContent(
        section.content,
        section.content.length - reduction,
      );
      overflow = renderPreparedSections(prepared).length - maxChars;
    }
  }

  while (overflow > 0) {
    const reducibleSection = PRIORITY_ORDER.flatMap((priority) =>
      prepared.filter(
        (section) =>
          section.priority === priority && section.content.length > 0,
      ),
    )[0];

    if (!reducibleSection) {
      break;
    }

    reducibleSection.content = truncateContent(
      reducibleSection.content,
      Math.max(0, reducibleSection.content.length - overflow),
    );
    overflow = renderPreparedSections(prepared).length - maxChars;
  }

  return buildPayload(prepared);
}

function buildPayload(
  sections: Array<
    PromptSectionInput & {
      originalChars: number;
      content: string;
      reserveChars: number;
    }
  >,
): ComposedPromptPayload {
  const prompt = renderPreparedSections(sections);
  return {
    prompt,
    sections: sections.map((section) => ({
      label: section.label,
      priority: section.priority,
      originalChars: section.originalChars,
      renderedChars: section.content.length,
      truncated:
        section.content.includes('...[truncated]') ||
        section.content.length < section.originalChars,
    })),
  };
}

function renderPreparedSections(
  sections: Array<PromptSectionInput & { content: string }>,
): string {
  return sections
    .map((section) => `${section.label}\n${section.content}`)
    .join('\n\n')
    .trim();
}

function normalizeSectionContent(content: string): string {
  return content.trim() || 'No additional evidence was provided.';
}

function truncateContent(content: string, maxChars: number): string {
  if (!content || content.length <= maxChars) {
    return content;
  }

  if (maxChars <= 0) {
    return '';
  }

  const suffix = '\n...[truncated]';
  if (maxChars <= suffix.length) {
    return content.slice(0, maxChars);
  }

  const sliced = content.slice(0, maxChars - suffix.length).trimEnd();
  return `${sliced}${suffix}`;
}
