/**
 * @fileoverview Configuración global de rate limiting.
 *
 * Contexto:
 * - Define dos cubos independientes para balancear usabilidad y seguridad.
 * - `global`  → ventana de 60 s, límite alto para permitir navegación fluida
 *               en el workspace (múltiples GET simultáneos al cambiar de proyecto).
 * - `burst`   → ventana de 1 s, límite bajo para absorber ráfagas normales
 *               sin permitir flood real. Detiene scripts de abuso sin afectar
 *               al usuario legítimo.
 *
 * Los endpoints de autenticación sobreescriben estos valores con
 * @Throttle({ global: { limit: 10, ttl: 60000 }, burst: { limit: 3, ttl: 1000 } })
 *
 * @module ThrottlerConfig
 */

export const throttlerConfig = [
  {
    name: 'global',
    ttl: 60_000,
    limit: 1_000,
  },
  {
    name: 'burst',
    ttl: 1_000,
    limit: 40,
  },
];
