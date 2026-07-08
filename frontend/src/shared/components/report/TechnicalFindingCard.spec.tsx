import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TechnicalFindingCard } from './TechnicalFindingCard';
import { normalizeTechnicalFeedbackItem } from '../../utils/technicalFeedback';

describe('TechnicalFindingCard', () => {
  const baseItem = normalizeTechnicalFeedbackItem({
    title: 'Falta validar entrada',
    detail: 'El parámetro no se normaliza antes de usarlo.',
    severity: 'high',
    level: 'intermedio',
    file: 'src/app.py',
    line: 42,
    codeSnippet: 'print(x)',
    conceptExplanation: 'La normalización evita inyección.',
  });

  it('renders title, severity and level', () => {
    render(<TechnicalFindingCard item={baseItem} runtimeFamily="python" />);

    expect(screen.getByText('Falta validar entrada')).toBeInTheDocument();
    expect(screen.getByText('Severidad alta')).toBeInTheDocument();
    expect(screen.getByText('intermedio')).toBeInTheDocument();
  });

  it('renders file and line', () => {
    render(<TechnicalFindingCard item={baseItem} />);

    expect(screen.getByText('src/app.py:42')).toBeInTheDocument();
  });

  it('toggles concept explanation', () => {
    render(<TechnicalFindingCard item={baseItem} />);

    const summary = screen.getByText('Aprende mas');
    expect(summary).toBeInTheDocument();

    fireEvent.click(summary);
    expect(
      screen.getByText('La normalización evita inyección.'),
    ).toBeInTheDocument();
  });
});
