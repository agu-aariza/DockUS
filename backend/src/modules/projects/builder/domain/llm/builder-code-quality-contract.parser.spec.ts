import { parseBuilderCodeQualityContractV2 } from './builder-code-quality-contract.parser';

function buildQualityPayload(overrides: Record<string, unknown> = {}) {
  return {
    thought: 'Análisis pedagógico consistente.',
    security: [
      {
        title: 'Uso de sprintf inseguro',
        detail:
          'Observación: se usa sprintf en main.c. Impacto: puede provocar buffer overflow. Recomendación: sustituirlo por snprintf.',
        severity: 'high',
        file: 'main.c',
        line: 12,
      },
    ],
    architecture: [],
    quality: [
      {
        title: 'BUENA PRÁCTICA: responsabilidades separadas',
        detail:
          'Observación: la lógica y la E/S están separadas. Impacto: mejora el testeo. Recomendación: mantén esta estructura al crecer el proyecto.',
        severity: 'low',
      },
    ],
    rubricCompliance: [],
    ...overrides,
  };
}

describe('parseBuilderCodeQualityContractV2', () => {
  it('parses a valid structured code quality contract', () => {
    const contract = parseBuilderCodeQualityContractV2(
      JSON.stringify(buildQualityPayload()),
    );

    expect(contract.security[0]).toEqual(
      expect.objectContaining({
        title: 'Uso de sprintf inseguro',
        severity: 'high',
        file: 'main.c',
        line: 12,
      }),
    );
    expect(contract.quality[0]).toEqual(
      expect.objectContaining({
        severity: 'low',
      }),
    );
  });

  it('normalizes alias fields and defaults invalid severity to medium', () => {
    const contract = parseBuilderCodeQualityContractV2(
      JSON.stringify(
        buildQualityPayload({
          security: [
            {
              title: 'Manejo incompleto de argumentos',
              observacion: 'El binario requiere dos argumentos para funcionar.',
              impacto: 'La ejecución batch falla si el pipeline no los suministra.',
              recomendacion:
                'Declara y documenta una invocación completa en la receta de ejecución.',
              severity: 'critical',
              file: 'main.c',
            },
          ],
        }),
      ),
    );

    expect(contract.security).toEqual([
      expect.objectContaining({
        title: 'Manejo incompleto de argumentos',
        severity: 'medium',
        file: 'main.c',
        detail: expect.stringContaining('Impacto: La ejecución batch falla si el pipeline no los suministra.'),
      }),
    ]);
  });

  it('drops irreparable findings while preserving the valid ones in the same axis', () => {
    const contract = parseBuilderCodeQualityContractV2(
      JSON.stringify(
        buildQualityPayload({
          security: [
            {
              title: 'Uso de atoi sin validación',
              observacion: 'atoi devuelve 0 en entradas inválidas.',
              impacto: 'Puede ocultar errores de entrada y producir resultados engañosos.',
              'recomendación':
                'Usa strtol y valida errores para distinguir números válidos de entradas corruptas.',
            },
            {
              title: '',
              detail: '',
            },
          ],
        }),
      ),
    );

    expect(contract.security).toHaveLength(1);
    expect(contract.security[0]).toEqual(
      expect.objectContaining({
        title: 'Uso de atoi sin validación',
      }),
    );
  });

  it('fails when an axis is not an array', () => {
    expect(() =>
      parseBuilderCodeQualityContractV2(
        JSON.stringify(
          buildQualityPayload({
            security: 'no-array',
          }),
        ),
      ),
    ).toThrow('security debe ser un array.');
  });
});
