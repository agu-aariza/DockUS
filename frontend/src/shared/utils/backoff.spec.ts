import { describe, expect, it } from "vitest";

import {
  computeBackoffDelay,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_DELAY_MS,
} from "./backoff";

describe("computeBackoffDelay — reconexión sin oleadas", () => {
  it("crece de forma exponencial con el número de intentos", () => {
    // Con random() = 1 se obtiene el techo de cada ventana, que es lo que
    // permite comprobar el crecimiento sin depender del azar.
    const ceilingAt = (attempt: number) =>
      computeBackoffDelay(attempt, { random: () => 1 });

    expect(ceilingAt(0)).toBe(DEFAULT_BASE_DELAY_MS);
    expect(ceilingAt(1)).toBe(DEFAULT_BASE_DELAY_MS * 2);
    expect(ceilingAt(2)).toBe(DEFAULT_BASE_DELAY_MS * 4);
    expect(ceilingAt(3)).toBe(DEFAULT_BASE_DELAY_MS * 8);
  });

  it("nunca supera el techo, por alto que sea el contador de intentos", () => {
    expect(computeBackoffDelay(50, { random: () => 1 })).toBe(
      DEFAULT_MAX_DELAY_MS,
    );
    // Un contador desbocado no debe producir Infinity ni NaN.
    expect(Number.isFinite(computeBackoffDelay(1000))).toBe(true);
  });

  it("nunca baja de la base, para no castigar a un servidor ya degradado", () => {
    expect(computeBackoffDelay(5, { random: () => 0 })).toBe(
      DEFAULT_BASE_DELAY_MS,
    );
  });

  /**
   * Es la propiedad que justifica el cambio: con el retardo fijo anterior, cien
   * clientes cortados a la vez volvían los cien en el mismo milisegundo.
   */
  it("dispersa a clientes simultáneos por toda la ventana", () => {
    const delays = Array.from({ length: 200 }, () => computeBackoffDelay(3));
    const distintos = new Set(delays);

    expect(distintos.size).toBeGreaterThan(100);
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(DEFAULT_BASE_DELAY_MS);
    expect(Math.max(...delays)).toBeLessThanOrEqual(DEFAULT_BASE_DELAY_MS * 8);
  });

  it("trata los intentos negativos o fraccionarios como el primero", () => {
    expect(computeBackoffDelay(-5, { random: () => 1 })).toBe(
      DEFAULT_BASE_DELAY_MS,
    );
    expect(computeBackoffDelay(0.9, { random: () => 1 })).toBe(
      DEFAULT_BASE_DELAY_MS,
    );
  });
});
