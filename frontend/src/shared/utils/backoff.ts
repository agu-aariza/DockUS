/**
 * @fileoverview Utilidad de apoyo de interfaz (backoff).
 *
 * @module backoff
 */

/**
 * Retroceso exponencial con dispersión aleatoria para reconexiones y sondeos.
 *
 * El motivo no es la amabilidad con el servidor sino evitar una sincronización
 * espontánea. Con un retardo fijo —el stream del builder reconectaba siempre a
 * los 2.000 ms— cualquier evento que corte todas las conexiones a la vez (un
 * redespliegue, el reinicio del balanceador, una caída breve de la red) hace
 * que todos los clientes vuelvan **en el mismo instante**, y el pico se repite
 * intacto en cada intento porque nada rompe la alineación. Con 10.000 usuarios
 * eso convierte un corte de un segundo en una avalancha sostenida contra la API
 * y contra Postgres (ESC-ALTO-06).
 *
 * La dispersión es multiplicativa sobre la ventana completa en vez de un
 * pequeño porcentaje alrededor del valor nominal: reparte los reintentos por
 * todo el intervalo [base, base·2^n] y es lo que de verdad aplana el pico.
 */

export const DEFAULT_BASE_DELAY_MS = 2_000;
export const DEFAULT_MAX_DELAY_MS = 30_000;

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Inyectable para poder probarlo de forma determinista. */
  random?: () => number;
}

/**
 * Calcula el retardo del intento `attempt` (0 para el primero).
 *
 * Devuelve un valor en `[baseDelayMs, min(baseDelayMs · 2^attempt, maxDelayMs)]`:
 * nunca por debajo de la base, para no castigar a un servidor que ya está
 * teniendo problemas, y nunca por encima del techo, para que un cliente
 * olvidado en una pestaña acabe reconectando en un tiempo razonable.
 */
export function computeBackoffDelay(
  attempt: number,
  options: BackoffOptions = {},
): number {
  const base = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const max = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const random = options.random ?? Math.random;

  const safeAttempt = Math.max(0, Math.floor(attempt));
  // 2^30 ya desborda cualquier techo razonable; acotar el exponente evita que
  // un contador de intentos desbocado produzca Infinity.
  const ceiling = Math.min(base * 2 ** Math.min(safeAttempt, 30), max);

  return Math.round(base + random() * (ceiling - base));
}
