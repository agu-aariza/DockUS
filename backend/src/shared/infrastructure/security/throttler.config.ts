/**
 * @fileoverview Configuración global de rate limiting.
 *
 * Contexto:
 * - Define límites de peticiones por ventana temporal.
 * - Endurece la superficie HTTP ante abuso y fuerza bruta.
 *
 * @module ThrottlerConfig
 */

export const throttlerConfig = [
  {
    ttl: 60000,
    limit: 100,
  },
];
