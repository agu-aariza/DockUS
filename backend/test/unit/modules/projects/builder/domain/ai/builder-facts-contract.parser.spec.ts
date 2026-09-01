import { parseBuilderFactsContractV2 } from '@app/modules/projects/builder/domain/ai/builder-facts-contract.parser';

function buildFactsPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 'builder-llm/v2',
    thought: 'Extracción de hechos sin interpretación.',
    observedStdout: ['Servicio arrancado en el puerto 8000.'],
    observedStderr: [],
    exitCode: 0,
    compilationStatus: 'success',
    matchesOracle: true,
    discrepancies: [],
    filesPresent: ['main.py'],
    executionSummary: 'Ejecución completada sin errores.',
    evidenceLimits: [],
    ...overrides,
  };
}

describe('parseBuilderFactsContractV2', () => {
  it('parses a valid facts contract', () => {
    const contract = parseBuilderFactsContractV2(
      JSON.stringify(buildFactsPayload()),
    );

    expect(contract.matchesOracle).toBe(true);
    expect(contract.compilationStatus).toBe('success');
  });

  it("the literal string 'false' is not coerced to true", () => {
    const contract = parseBuilderFactsContractV2(
      JSON.stringify(buildFactsPayload({ matchesOracle: 'false' })),
    );

    expect(contract.matchesOracle).toBe(false);
  });

  it("the literal string 'true' is accepted as true", () => {
    const contract = parseBuilderFactsContractV2(
      JSON.stringify(buildFactsPayload({ matchesOracle: 'true' })),
    );

    expect(contract.matchesOracle).toBe(true);
  });

  it('case/whitespace variants of the boolean string are accepted', () => {
    const contract = parseBuilderFactsContractV2(
      JSON.stringify(buildFactsPayload({ matchesOracle: ' False ' })),
    );

    expect(contract.matchesOracle).toBe(false);
  });

  it('an ambiguous value fails the contract instead of defaulting to true', () => {
    expect(() =>
      parseBuilderFactsContractV2(
        JSON.stringify(buildFactsPayload({ matchesOracle: 'maybe' })),
      ),
    ).toThrow("matchesOracle debe ser boolean ('true'/'false')");
  });

  it('a missing matchesOracle fails the contract instead of defaulting to false', () => {
    const payload = buildFactsPayload();
    delete (payload as Record<string, unknown>).matchesOracle;

    expect(() => parseBuilderFactsContractV2(JSON.stringify(payload))).toThrow(
      "matchesOracle debe ser boolean ('true'/'false')",
    );
  });

  it('fails when compilationStatus is not one of the known values', () => {
    expect(() =>
      parseBuilderFactsContractV2(
        JSON.stringify(buildFactsPayload({ compilationStatus: 'unknown' })),
      ),
    ).toThrow(
      "compilationStatus debe ser 'success', 'failure' o 'not_applicable'",
    );
  });
});
/**
 * Pruebas de validación del contrato de hechos observables producido durante la evaluación.
 */
