/**
 * @fileoverview Utilidad de apoyo de interfaz (technicalFeedback.spec).
 *
 * @module technicalFeedback.spec
 */

import { describe, expect, it } from "vitest";

import {
  groupFindingsByLocation,
  normalizeTechnicalFeedbackItem,
  splitFindingDetail,
} from "./technicalFeedback";
import type { TechnicalFeedbackItem } from "../../features/builder/types";

function item(overrides: Partial<TechnicalFeedbackItem> = {}): TechnicalFeedbackItem {
  return normalizeTechnicalFeedbackItem({
    title: "Hallazgo",
    detail: "Observación: algo. Impacto: consecuencia. Recomendación: corrígelo.",
    severity: "medium",
    file: null,
    line: null,
    codeSnippet: "",
    level: "basico",
    conceptExplanation: "",
    ...overrides,
  });
}

describe("splitFindingDetail", () => {
  it("separa las tres partes que pide el contrato", () => {
    const parts = splitFindingDetail(
      "Observación: la función cuenta espacios. Impacto: resultados incorrectos. Recomendación: corregir la lógica.",
    );

    expect(parts.observation).toBe("la función cuenta espacios.");
    expect(parts.impact).toBe("resultados incorrectos.");
    expect(parts.recommendation).toBe("corregir la lógica.");
  });

  it("no pierde texto cuando el evaluador no respeta el formato", () => {
    const parts = splitFindingDetail("El programa no libera la memoria reservada.");

    expect(parts.observation).toBe("El programa no libera la memoria reservada.");
    expect(parts.impact).toBe("");
    expect(parts.recommendation).toBe("");
  });
});

describe("groupFindingsByLocation", () => {
  it("agrupa los hallazgos que apuntan al mismo archivo y línea", () => {
    const groups = groupFindingsByLocation([
      item({ title: "Error lógico", file: "src/cadenas.c", line: 50 }),
      item({ title: "Falla con cadenas vacías", file: "src/cadenas.c", line: 50 }),
      item({ title: "Fuga de memoria", file: "src/cadenas.c", line: 10 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].item.title).toBe("Error lógico");
    expect(groups[0].related.map((related) => related.title)).toEqual([
      "Falla con cadenas vacías",
    ]);
    expect(groups[1].related).toHaveLength(0);
  });

  it("nunca agrupa hallazgos sin ubicación", () => {
    const groups = groupFindingsByLocation([
      item({ title: "Sin ubicación A" }),
      item({ title: "Sin ubicación B" }),
    ]);

    expect(groups).toHaveLength(2);
  });
});
