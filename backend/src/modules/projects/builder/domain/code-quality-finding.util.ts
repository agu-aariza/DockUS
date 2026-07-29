/**
 * @fileoverview Motor Builder de evaluación asíncrona (code-quality-finding.util).
 *
 * @module code-quality-finding.util
 */

import type { CodeQualityFinding } from './builder.types';

const STRENGTH_PREFIX = 'BUENA PRACTICA:';

/**
 * La recomendación de un elogio pide *conservar* algo; la de un defecto pide
 * cambiarlo. Es la señal más fiable cuando el modelo olvida el prefijo.
 */
const KEEP_DOING_RECOMMENDATION =
  /^(manten|manté|sigue|siga|seguir|continu|continú|conserva|conservar|replica|replicar)/iu;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .trim();
}

/** Texto que sigue a "Recomendación:" dentro del detalle de un hallazgo. */
export function extractRecommendation(detail: string): string {
  const match = /Recomendaci[oó]n:\s*(.+)$/iu.exec(detail);
  if (match?.[1]) {
    return match[1].trim();
  }

  const firstSentence = detail
    .split('.')
    .map((part) => part.trim())
    .find(Boolean);
  return firstSentence ?? detail.trim();
}

/**
 * Un hallazgo positivo no es trabajo pendiente: no puede acabar en "qué debes
 * corregir" ni en el checklist de la siguiente versión.
 *
 * El contrato con el LLM es el prefijo `BUENA PRÁCTICA:` en el título, pero se
 * lo salta con frecuencia (un informe real llegó con "Separación correcta en
 * archivos .h y .c" — severidad baja, recomendación "Mantener esta práctica" —
 * y el alumno lo vio listado como deuda técnica). De ahí el segundo criterio:
 * severidad baja *y* una recomendación que pide mantener lo que ya hace. Se
 * exigen ambas para no marcar como elogio un defecto menor real.
 */
export function isStrengthFinding(finding: CodeQualityFinding): boolean {
  if (normalize(finding.title).startsWith(STRENGTH_PREFIX)) {
    return true;
  }

  return (
    finding.severity === 'low' &&
    KEEP_DOING_RECOMMENDATION.test(extractRecommendation(finding.detail))
  );
}
