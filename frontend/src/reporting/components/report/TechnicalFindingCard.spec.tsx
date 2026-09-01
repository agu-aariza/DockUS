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
    expect(screen.getByText('Nivel intermedio')).toBeInTheDocument();
  });

  it('destaca la recomendación en lugar de enterrarla en el párrafo', () => {
    const item = normalizeTechnicalFeedbackItem({
      title: 'Error lógico',
      detail:
        'Observación: cuenta espacios. Impacto: resultados incorrectos. Recomendación: corregir la lógica de conteo.',
      severity: 'high',
      level: 'basico',
    });

    render(<TechnicalFindingCard item={item} />);

    expect(screen.getByText('Qué hacer')).toBeInTheDocument();
    expect(
      screen.getByText('corregir la lógica de conteo.'),
    ).toBeInTheDocument();
  });

  it('marca los elogios como buena práctica y les quita el prefijo', () => {
    const item = normalizeTechnicalFeedbackItem({
      title: 'BUENA PRÁCTICA: uso de const',
      detail:
        'Observación: usa const. Impacto: evita mutaciones. Recomendación: mantener este patrón.',
      severity: 'low',
      level: 'intermedio',
    });

    render(<TechnicalFindingCard item={item} tone="strength" />);

    expect(screen.getByText('Buena práctica')).toBeInTheDocument();
    expect(screen.getByText('uso de const')).toBeInTheDocument();
    expect(screen.queryByText('Severidad baja')).not.toBeInTheDocument();
  });

  it('renders file and line', () => {
    render(<TechnicalFindingCard item={baseItem} />);

    expect(screen.getByText('src/app.py:42')).toBeInTheDocument();
  });

  it('toggles concept explanation', () => {
    render(<TechnicalFindingCard item={baseItem} />);

    const summary = screen.getByText('Aprende más');
    expect(summary).toBeInTheDocument();

    fireEvent.click(summary);
    expect(
      screen.getByText('La normalización evita inyección.'),
    ).toBeInTheDocument();
  });
});
/**
 * Pruebas de la tarjeta de hallazgo técnico y de sus detalles expandibles.
 */
