/**
 * @fileoverview Motor Builder de evaluación asíncrona (code-quality-finding.util.spec).
 *
 * @module code-quality-finding.util.spec
 */

import {
  extractRecommendation,
  isStrengthFinding,
} from '@app/modules/projects/builder/domain/code-quality-finding.util';
import type { CodeQualityFinding } from '@app/modules/projects/builder/domain/builder.types';

function finding(
  overrides: Partial<CodeQualityFinding> = {},
): CodeQualityFinding {
  return {
    title: 'Hallazgo',
    detail:
      'Observación: algo concreto. Impacto: una consecuencia. Recomendación: corregir la lógica.',
    severity: 'medium',
    codeSnippet: '',
    level: 'basico',
    conceptExplanation: 'Explicación.',
    ...overrides,
  };
}

describe('isStrengthFinding', () => {
  it('reconoce el prefijo del contrato con y sin tildes', () => {
    expect(
      isStrengthFinding(finding({ title: 'BUENA PRÁCTICA: uso de const' })),
    ).toBe(true);
    expect(
      isStrengthFinding(finding({ title: 'Buena practica: uso de const' })),
    ).toBe(true);
  });

  it('reconoce un elogio sin prefijo por severidad baja y recomendación de mantener', () => {
    // Caso real: el evaluador omitió el prefijo y el alumno vio este elogio
    // listado como deuda técnica en "qué debes corregir".
    const praise = finding({
      title: 'Separación correcta en archivos .h y .c',
      severity: 'low',
      detail:
        'Observación: el código está separado en .h y .c. Impacto: facilita la reutilización. Recomendación: Mantener esta práctica para proyectos futuros.',
    });

    expect(isStrengthFinding(praise)).toBe(true);
  });

  it('no confunde un defecto leve con un elogio', () => {
    const minorDefect = finding({
      title: 'Nombre de variable poco descriptivo',
      severity: 'low',
      detail:
        'Observación: la variable se llama x. Impacto: dificulta la lectura. Recomendación: renombrarla a contadorPalabras.',
    });

    expect(isStrengthFinding(minorDefect)).toBe(false);
  });

  it('no marca como elogio un hallazgo grave aunque pida mantener algo', () => {
    const severe = finding({
      title: 'Desbordamiento de buffer',
      severity: 'high',
      detail:
        'Observación: strcpy sin límite. Impacto: corrupción de memoria. Recomendación: mantener el uso de strncpy en el resto del archivo y corregir esta línea.',
    });

    expect(isStrengthFinding(severe)).toBe(false);
  });
});

describe('extractRecommendation', () => {
  it('devuelve el texto que sigue a Recomendación', () => {
    expect(
      extractRecommendation(
        'Observación: x. Impacto: y. Recomendación: liberar la memoria con free.',
      ),
    ).toBe('liberar la memoria con free.');
  });

  it('cae a la primera frase cuando el formato no se respeta', () => {
    expect(
      extractRecommendation('El código no compila. Falta el punto y coma.'),
    ).toBe('El código no compila');
  });
});
