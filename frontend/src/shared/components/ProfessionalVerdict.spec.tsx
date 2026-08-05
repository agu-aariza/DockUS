import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfessionalVerdict } from './ProfessionalVerdict';

describe('ProfessionalVerdict', () => {
  it('renders null when verdict is empty', () => {
    const { container } = render(<ProfessionalVerdict verdict="" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the verdict text and outcome badge', () => {
    render(
      <ProfessionalVerdict
        verdict="Apto con observaciones. Nota recomendada: 7.5."
        outcome="PARTIAL"
      />,
    );

    expect(screen.getByText('Resumen ejecutivo de la evaluación')).toBeInTheDocument();
    expect(
      screen.getByText('Apto con observaciones. Nota recomendada: 7.5.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Necesita mejoras')).toBeInTheDocument();
  });
});
/**
 * Pruebas de presentación del veredicto profesional y de sus variantes de severidad.
 */
