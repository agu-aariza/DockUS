import type {
  AssignmentContext,
  BuilderEvaluationContractV2,
  BuilderFactsContractV2,
  BuilderPlanContractV2,
} from '../builder.types';
import { runtimeCatalogToText } from '../../application/services/compilation/builder-plan-runtime-adapter';

export type PromptSectionPriority = 'critical' | 'high' | 'medium' | 'low';

interface PromptSectionBudget {
  preferredChars?: number;
  reserveChars?: number;
}

interface PromptSectionInput {
  label: string;
  content: string;
  priority: PromptSectionPriority;
  budget?: PromptSectionBudget;
}

export interface PromptSectionTrace {
  label: string;
  priority: PromptSectionPriority;
  originalChars: number;
  renderedChars: number;
  truncated: boolean;
}

export interface ComposedPromptPayload {
  prompt: string;
  sections: PromptSectionTrace[];
}

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
        content:
          assignmentContext.rubricInstructions ??
          'No rubric instructions were provided.',
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
        content: selectFewShotExamples(assignmentContext.expectedType),
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
        content: JSON.stringify(facts, null, 2),
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
        content:
          assignmentContext.rubricInstructions ??
          'No rubric instructions were provided.',
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

function selectFewShotExamples(expectedType: string | null): string {
  const type = (expectedType ?? '').toLowerCase();

  if (
    type.includes('fastapi') ||
    type.includes('flask') ||
    type.includes('service')
  ) {
    return `Python service example:\n{\n  "recipe": {\n    "install": [["pip", "install", "-r", "requirements.txt"]],\n    "run": ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],\n    "test": [],\n    "systemPackages": [],\n    "service": { "port": 8000, "healthcheck": ["curl", "-f", "http://localhost:8000/health"] }\n  },\n  "runtime": { "family": "python", "version": "3.11" }\n}`;
  }

  if (type.includes('c')) {
    return `C CLI example with Makefile:\n{\n  "recipe": {\n    "install": [["make"]],\n    "run": ["./main"],\n    "test": [],\n    "systemPackages": ["build-essential"],\n    "service": null\n  },\n  "runtime": { "family": "c", "version": "c11" }\n}\n\nC CLI example without Makefile:\n{\n  "recipe": {\n    "install": [["gcc", "-Wall", "-Wextra", "-std=c11", "main.c", "-o", "main"]],\n    "run": ["./main"],\n    "test": [],\n    "systemPackages": ["build-essential"],\n    "service": null\n  },\n  "runtime": { "family": "c", "version": "c11" }\n}`;
  }

  return `Python CLI example:\n{\n  "recipe": {\n    "install": [["pip", "install", "-r", "requirements.txt"]],\n    "run": ["python", "main.py"],\n    "test": [],\n    "systemPackages": [],\n    "service": null\n  },\n  "runtime": { "family": "python", "version": "3.11" }\n}`;
}

export function composeQualityPrompt(
  sourceCodePayload: string,
  executionLogs: string,
  assignmentContext: AssignmentContext,
  assessment: BuilderEvaluationContractV2,
  maxChars: number,
): ComposedPromptPayload {
  return composePromptSections(
    [
      {
        label: 'ASSIGNMENT CONTEXT',
        content: [
          `Expected project type: ${assignmentContext.expectedType ?? 'Not specified.'}`,
          `Rubric instructions: ${assignmentContext.rubricInstructions ?? 'No rubric instructions were provided.'}`,
          `Expected output oracle: ${assignmentContext.expectedOutput ?? 'No exact expected output was defined.'}`,
        ].join('\n'),
        priority: 'critical',
        budget: QUALITY_PROMPT_MAX_SECTION_CHARS.context,
      },
      {
        label: 'CURRENT ACADEMIC ASSESSMENT',
        content: JSON.stringify(assessment, null, 2),
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
