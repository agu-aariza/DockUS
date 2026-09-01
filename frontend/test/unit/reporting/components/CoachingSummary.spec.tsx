import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachingSummary } from '@/reporting/components/CoachingSummary';
import type { TechnicalFeedbackItem } from '@/features/builder/types';

function finding(
  overrides: Partial<TechnicalFeedbackItem> = {},
): TechnicalFeedbackItem {
  return {
    title: 'Hallazgo',
    detail:
      'Observación: la función cuenta espacios. Impacto: resultados incorrectos. Recomendación: corregir la lógica.',
    severity: 'high',
    file: null,
    line: null,
    codeSnippet: '',
    level: 'basico',
    conceptExplanation: '',
    ...overrides,
  };
}

const rubricFinding = finding({
  title: 'Incumplimiento parcial de la suite de pruebas',
  file: '.educodeai/teacher-tests/test_main.c',
  line: 1,
});

describe('CoachingSummary', () => {
  it('no repite en la rúbrica un hallazgo ya mostrado como bloqueo', () => {
    render(
      <CoachingSummary
        coaching={{
          passReadiness: 'BLOCKED',
          mustFix: [rubricFinding],
          shouldImprove: [],
          strengths: [],
          nextAttemptChecklist: [],
        }}
        rubricItems={[rubricFinding]}
      />,
    );

    expect(screen.getAllByText(rubricFinding.title)).toHaveLength(1);
    expect(screen.queryByText('Cumplimiento de rúbrica')).not.toBeInTheDocument();
  });

  it('muestra los elogios como buena práctica, sin severidad', () => {
    render(
      <CoachingSummary
        coaching={{
          passReadiness: 'READY_WITH_SUGGESTIONS',
          mustFix: [],
          shouldImprove: [],
          strengths: [
            finding({
              title: 'BUENA PRÁCTICA: separación en .h y .c',
              severity: 'low',
              detail:
                'Observación: el código está separado. Impacto: facilita la reutilización. Recomendación: mantener esta práctica.',
            }),
          ],
          nextAttemptChecklist: [],
        }}
      />,
    );

    expect(screen.getByText('Qué has hecho bien')).toBeInTheDocument();
    expect(screen.getByText('Buena práctica')).toBeInTheDocument();
    // El prefijo del contrato no se repite bajo el epígrafe de fortalezas.
    expect(screen.getByText('separación en .h y .c')).toBeInTheDocument();
    expect(screen.queryByText('Severidad baja')).not.toBeInTheDocument();
  });

  it('agrupa en una tarjeta los hallazgos del mismo archivo y línea', () => {
    render(
      <CoachingSummary
        coaching={{
          passReadiness: 'BLOCKED',
          mustFix: [
            finding({ title: 'Error lógico', file: 'src/cadenas.c', line: 50 }),
            finding({
              title: 'Falla con cadenas vacías',
              file: 'src/cadenas.c',
              line: 50,
            }),
          ],
          shouldImprove: [],
          strengths: [],
          nextAttemptChecklist: [],
        }}
      />,
    );

    // Dos títulos, una sola tarjeta: el segundo cuelga del primero.
    expect(screen.getAllByText('src/cadenas.c:50')).toHaveLength(1);
    expect(screen.getByText('Falla con cadenas vacías')).toBeInTheDocument();
  });

  it('habla en tercera persona cuando lo lee el profesor', () => {
    render(
      <CoachingSummary
        mode="teacher"
        coaching={{
          passReadiness: 'BLOCKED',
          mustFix: [finding()],
          shouldImprove: [],
          strengths: [],
          nextAttemptChecklist: ['Corregir la lógica'],
        }}
      />,
    );

    expect(screen.getByText('Qué debe corregir para aprobar')).toBeInTheDocument();
    expect(screen.getByText('Checklist que verá el alumno')).toBeInTheDocument();
    expect(
      screen.queryByText('Qué debes corregir para pasar'),
    ).not.toBeInTheDocument();
  });
});
