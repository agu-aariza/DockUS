export interface PromptBundle {
  role: string;
  task: string;
  hard_rules: string[];
  schema_contract?: string;
  decision_policy?: string[];
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

function renderSection(
  title: string,
  content: string | undefined | null,
): string | null {
  if (!content) return null;
  return `${title}\n${content.trim()}`;
}

function renderListSection(
  title: string,
  entries: string[] | undefined | null,
): string | null {
  if (!entries || entries.length === 0) return null;
  const lines = entries
    .map((entry, index) => `${index + 1}. ${entry.trim()}`)
    .join('\n');
  return `${title}\n${lines}`;
}

function renderJsonExamplesSection(jsonExamples: string[]): string {
  const blocks = jsonExamples
    .map((example, index) => `--- EXAMPLE ${index + 1} ---\n${example.trim()}`)
    .join('\n\n');
  return `FEW-SHOT JSON EXAMPLES\nEstudia estos ejemplos reales de respuestas correctas. Tu respuesta DEBE igualar o superar su nivel de detalle, extensión y especificidad en cada campo. Replica la estructura exacta del JSON, no omitas campos, y asegúrate de que el contenido sea original y específico al proyecto que estás analizando.\n\n${blocks}`;
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
    schema_contract: bundle.schema_contract
      ? interpolateString(bundle.schema_contract, variables)
      : undefined,
    decision_policy: bundle.decision_policy?.map((entry) =>
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

/**
 * El nombre de la variable se incrusta en una expresión regular: sin escapar,
 * una clave con metacaracteres (`a.b`) coincidiría con marcadores que no son
 * el suyo.
 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function interpolateString(
  value: string,
  variables: Record<string, string>,
): string {
  let rendered = value;
  for (const [key, replacement] of Object.entries(variables)) {
    // La función de reemplazo es obligatoria, no estilística: pasar el valor
    // como string haría que `String.replace` interpretase `$&`, `$$`, `` $` ``
    // y `$'` como referencias a la coincidencia, corrompiendo en silencio
    // cualquier variable que contenga esos patrones. Con una función, el valor
    // se inserta literal.
    rendered = rendered.replace(
      new RegExp(escapeRegExp(`{{${key}}}`), 'g'),
      () => replacement,
    );
  }
  return rendered;
}
