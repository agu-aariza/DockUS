/**
 * @fileoverview Módulo de la interfaz de usuario (builderTaxonomy.spec).
 *
 * @module builderTaxonomy.spec
 */

import { describe, expect, it } from "vitest";

import {
  capabilityLabel,
  capabilityStatusLabel,
  confidenceLabel,
  evaluativeStateLabel,
  structuralTypeLabel,
} from "@/shared/data/builderTaxonomy";

describe("builderTaxonomy", () => {
  it.each([
    ["E1", "Funcionó como se esperaba"],
    ["E2", "Funcionó con fallos"],
    ["E3", "No llegó a funcionar"],
    ["E4", "No se pudo evaluar"],
  ])("traduce %s a su etiqueta legible", (code, label) => {
    expect(evaluativeStateLabel(code)).toBe(label);
  });

  it.each([
    ["T1", "Proyecto simple"],
    ["T2", "Proyecto con estructura básica"],
    ["T3", "Proyecto con varias piezas"],
    ["T4", "Proyecto complejo"],
  ])("traduce %s a su etiqueta legible", (code, label) => {
    expect(structuralTypeLabel(code)).toBe(label);
  });

  it("etiqueta las capacidades y sus veredictos sin dejar códigos ni inglés", () => {
    expect(capabilityLabel("C4")).toBe("Detectar pruebas automáticas");
    expect(capabilityStatusLabel("yes")).toBe("Sí");
    expect(capabilityStatusLabel("unknown")).toBe("No determinado");
    expect(confidenceLabel("high")).toBe("alta");
  });

  it("extrae el código cuando el evaluador lo devuelve con prosa detrás", () => {
    expect(structuralTypeLabel("T2 (CLI batch)")).toBe(
      "Proyecto con estructura básica",
    );
    expect(evaluativeStateLabel("e3")).toBe("No llegó a funcionar");
  });

  it("deja pasar el texto tal cual cuando no hay código reconocible", () => {
    expect(structuralTypeLabel("Servicio web con base de datos")).toBe(
      "Servicio web con base de datos",
    );
  });

  it("usa el fallback cuando todavía no hay evaluación", () => {
    expect(evaluativeStateLabel(undefined, "—")).toBe("—");
    expect(structuralTypeLabel(null)).toBe("Tipo no identificado");
    expect(confidenceLabel(undefined)).toBe("n/d");
  });
});
