import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiMapPinLine } from 'react-icons/ri';
import { ReportCard } from './ReportCard';

describe('ReportCard', () => {
  it('renders title, description and icon', () => {
    render(
      <ReportCard
        tone="indigo"
        icon={RiMapPinLine}
        title="Narrativa pedagógica"
        description="Tu recorrido"
        dataTestId="report-card"
      />,
    );

    expect(screen.getByTestId('report-card')).toBeInTheDocument();
    expect(screen.getByText('Narrativa pedagógica')).toBeInTheDocument();
    expect(screen.getByText('Tu recorrido')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <ReportCard title="Contenido" description="Extra">
        <p>child content</p>
      </ReportCard>,
    );

    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('applies tone styles', () => {
    render(
      <ReportCard
        tone="emerald"
        title="Aprobado"
        dataTestId="tone-card"
      />,
    );

    const card = screen.getByTestId('tone-card');
    expect(card.className).toContain('border-emerald-200');
    expect(card.className).toContain('bg-white');
  });
});
