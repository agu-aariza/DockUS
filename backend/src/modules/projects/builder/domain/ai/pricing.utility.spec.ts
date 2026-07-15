import { calculateCost, resolveModelPricing } from './pricing.utility';

describe('pricing.utility', () => {
  describe('resolveModelPricing', () => {
    it('resuelve un modelo exacto de la tabla', () => {
      expect(resolveModelPricing('gpt-4o')).toEqual({
        inputCostPerMillion: 2.5,
        outputCostPerMillion: 10.0,
      });
    });

    it('prefiere la clave más específica al emparejar por subcadena', () => {
      // "gpt-4o-mini-2024-07-18" contiene tanto "gpt-4o" como "gpt-4o-mini";
      // cobrar la primera saldría 16 veces más caro en salida.
      expect(resolveModelPricing('gpt-4o-mini-2024-07-18')).toEqual({
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      });
    });

    it('devuelve null para un modelo desconocido en vez de inventar tarifa', () => {
      expect(resolveModelPricing('mistral:7b-instruct')).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('calcula el coste por millón de tokens', () => {
      const cost = calculateCost(
        { inputCostPerMillion: 3, outputCostPerMillion: 15 },
        { inputTokens: 1_000_000, outputTokens: 100_000 },
      );

      expect(cost).toBeCloseTo(4.5, 6);
    });

    it('sin tarifa conocida, el coste es 0', () => {
      expect(
        calculateCost(null, { inputTokens: 900_000, outputTokens: 500_000 }),
      ).toBe(0);
    });
  });
});
