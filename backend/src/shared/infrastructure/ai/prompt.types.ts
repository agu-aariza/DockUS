export interface PromptBundle {
  role: string;
  task: string;
  hard_rules: string[];
  schema_contract: string;
  decision_policy: string[];
  examples?: string[];
  json_examples?: string[];
}

export type PromptManifest = Record<string, PromptBundle>;

export function renderPromptBundle(bundle: PromptBundle): string {
  const sections = [
    renderSection('ROLE', bundle.role),
    renderSection('TASK', bundle.task),
    renderListSection('HARD RULES', bundle.hard_rules),
    renderSection('SCHEMA CONTRACT', bundle.schema_contract),
    renderListSection('DECISION POLICY', bundle.decision_policy),
    bundle.examples && bundle.examples.length > 0
      ? renderListSection('EXAMPLES', bundle.examples)
      : null,
    bundle.json_examples && bundle.json_examples.length > 0
      ? renderJsonExamplesSection(bundle.json_examples)
      : null,
  ].filter((section): section is string => Boolean(section));

  return sections.join('\n\n').trim();
}

function renderSection(title: string, content: string): string {
  return `${title}\n${content.trim()}`;
}

function renderListSection(title: string, entries: string[]): string {
  const lines = entries
    .map((entry, index) => `${index + 1}. ${entry.trim()}`)
    .join('\n');
  return `${title}\n${lines}`;
}

function renderJsonExamplesSection(jsonExamples: string[]): string {
  const blocks = jsonExamples
    .map((example, index) => `--- EXAMPLE ${index + 1} ---\n${example.trim()}`)
    .join('\n\n');
  return `FEW-SHOT JSON EXAMPLES\nImita la estructura, profundidad y nivel de detalle de estos ejemplos reales. Tu respuesta debe tener al menos la misma longitud y riqueza en cada campo.\n\n${blocks}`;
}

export function interpolatePromptBundle(
  bundle: PromptBundle,
  variables: Record<string, string>,
): PromptBundle {
  return {
    role: interpolateString(bundle.role, variables),
    task: interpolateString(bundle.task, variables),
    hard_rules: bundle.hard_rules.map((entry) =>
      interpolateString(entry, variables),
    ),
    schema_contract: interpolateString(bundle.schema_contract, variables),
    decision_policy: bundle.decision_policy.map((entry) =>
      interpolateString(entry, variables),
    ),
    examples: bundle.examples?.map((entry) =>
      interpolateString(entry, variables),
    ),
    json_examples: bundle.json_examples?.map((entry) =>
      interpolateString(entry, variables),
    ),
  };
}

function interpolateString(
  value: string,
  variables: Record<string, string>,
): string {
  let rendered = value;
  for (const [key, replacement] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), replacement);
  }
  return rendered;
}
