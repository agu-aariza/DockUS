/**
 * @fileoverview Módulo de integración con la API REST (query-params).
 *
 * @module query-params
 */

export function toParams(
  input: Record<string, string | number | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return;
    }

    params.set(key, normalized);
  });

  return params;
}

export function normalizeStringArray(values?: string[]): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}
