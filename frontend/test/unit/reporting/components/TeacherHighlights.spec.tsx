import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeacherHighlights } from '@/reporting/components/TeacherHighlights';

describe('TeacherHighlights', () => {
  it('renders null when all sections are empty', () => {
    const { container } = render(
      <TeacherHighlights highlights={{ strengths: [], concerns: [], followUp: [] }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders strengths, concerns and follow-up columns', () => {
    const highlights = {
      strengths: ['Compilación limpia'],
      concerns: ['Salida incorrecta'],
      followUp: ['Revisar indexación'],
    };

    render(<TeacherHighlights highlights={highlights} />);

    expect(screen.getByText('Puntos clave para la revisión')).toBeInTheDocument();
    expect(screen.getByText('Fortalezas')).toBeInTheDocument();
    expect(screen.getByText('Preocupaciones')).toBeInTheDocument();
    expect(screen.getByText('Seguimiento')).toBeInTheDocument();
    expect(screen.getByText('Compilación limpia')).toBeInTheDocument();
    expect(screen.getByText('Salida incorrecta')).toBeInTheDocument();
    expect(screen.getByText('Revisar indexación')).toBeInTheDocument();
  });
});
/**
 * Pruebas de los destacados docentes y de su comportamiento cuando faltan métricas.
 */
