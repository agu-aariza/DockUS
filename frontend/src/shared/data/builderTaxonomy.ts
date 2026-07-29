/**
 * @fileoverview Módulo de la interfaz de usuario (builderTaxonomy).
 *
 * Traduce los códigos internos del contrato `builder-llm/v2` (T1–T4, E1–E4,
 * C1–C6, `yes`/`no`/`unknown`) a etiquetas en castellano legibles por cualquier
 * usuario. La UI nunca debe imprimir el código pelado: el alumno no tiene forma
 * de saber qué significa "E2". El código sigue disponible en el tooltip del
 * glosario ([[Glossary]]) para quien necesite cruzarlo con artefactos y logs.
 *
 * @module builderTaxonomy
 */

/**
 * Estados evaluativos del contrato, en el orden E1 (mejor) → E4 (peor).
 *
 * Las etiquetas describen **qué hizo el programa al ejecutarse**, no si la
 * entrega aprueba: el veredicto ya lo da `OutcomeBadge` (Apto / Necesita
 * mejoras / No apto) junto a la nota, y duplicarlo aquí solo genera lecturas
 * contradictorias. E4 es el único que habla del sistema en vez de la entrega,
 * porque es literalmente el caso "no hemos podido juzgarte".
 */
export const EVALUATIVE_STATE_LABELS: Record<string, string> = {
  E1: "Funcionó como se esperaba",
  E2: "Funcionó con fallos",
  E3: "No llegó a funcionar",
  E4: "No se pudo evaluar",
};

/** Tipos estructurales del proyecto, de más simple (T1) a más complejo (T4). */
export const STRUCTURAL_TYPE_LABELS: Record<string, string> = {
  T1: "Proyecto simple",
  T2: "Proyecto con estructura básica",
  T3: "Proyecto con varias piezas",
  T4: "Proyecto complejo",
};

/** Capacidades que el sistema intenta reconocer en la entrega. */
export const CAPABILITY_LABELS: Record<string, string> = {
  C1: "Reconocer el proyecto",
  C2: "Encontrar cómo ejecutarlo",
  C3: "Detectar un servicio en marcha",
  C4: "Detectar pruebas automáticas",
  C5: "Comprobar que el servicio responde",
  C6: "Detectar configuración externa",
};

const CAPABILITY_STATUS_LABELS: Record<string, string> = {
  yes: "Sí",
  no: "No",
  unknown: "No determinado",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/**
 * El evaluador puede devolver el código solo (`"E2"`) o acompañado de prosa
 * (`"T2 (CLI batch)"`). Se extrae el código inicial para poder etiquetarlo.
 */
function extractCode(value: string): string | null {
  const match = /^([ETC][1-9])\b/i.exec(value.trim());
  return match ? match[1].toUpperCase() : null;
}

function labelFrom(
  labels: Record<string, string>,
  value: string | null | undefined,
  fallback: string,
): string {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }

  const code = extractCode(raw);
  // Sin código reconocible el valor ya es texto descriptivo: se muestra tal cual.
  return (code && labels[code]) ?? raw;
}

/** Etiqueta legible del estado evaluativo (E1–E4). */
export function evaluativeStateLabel(
  state: string | null | undefined,
  fallback = "Sin estado",
): string {
  return labelFrom(EVALUATIVE_STATE_LABELS, state, fallback);
}

/** Etiqueta legible del tipo estructural (T1–T4). */
export function structuralTypeLabel(
  type: string | null | undefined,
  fallback = "Tipo no identificado",
): string {
  return labelFrom(STRUCTURAL_TYPE_LABELS, type, fallback);
}

/** Etiqueta legible de una capacidad (C1–C6). */
export function capabilityLabel(capabilityId: string): string {
  return labelFrom(CAPABILITY_LABELS, capabilityId, capabilityId);
}

/** Etiqueta legible del veredicto de una capacidad. */
export function capabilityStatusLabel(status: string | null | undefined): string {
  const raw = status?.trim().toLowerCase();
  if (!raw) {
    return CAPABILITY_STATUS_LABELS.unknown;
  }

  return CAPABILITY_STATUS_LABELS[raw] ?? raw;
}

/** El nivel de confianza del evaluador, en castellano y con una sola forma en toda la UI. */
export function confidenceLabel(confidence?: string | null): string {
  if (!confidence) return "n/d";
  return CONFIDENCE_LABELS[confidence] ?? confidence;
}
