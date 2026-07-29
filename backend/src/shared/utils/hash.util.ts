/**
 * @fileoverview Hashing de contenido (hash.util).
 *
 * @module hash.util
 */

import { createHash } from 'crypto';

/**
 * Genera un hash SHA-256 en formato hexadecimal.
 */
export function toSha256Hex(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}
