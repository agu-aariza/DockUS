import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BuildRunEntity } from '@/features/builder/types';
import { ReportHeader } from '@/reporting/components/report/ReportHeader';

function buildRun(partial: Partial<BuildRunEntity> = {}): BuildRunEntity {
  return {
    id: 'run-1',
    deliveryId: 'd-1',
    triggeredById: 'u-1',
    status: 'SUCCESS',
    isTerminal: true,
    warnings: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    finishedAt: '2026-01-01T12:00:00Z',
    report: {
      overallOutcome: 'PARTIAL',
      professionalVerdict: 'Veredicto de prueba.',
      learningObjective: 'Aprender a validar entradas.',
    },
    ...partial,
  } as BuildRunEntity;
}

describe('ReportHeader', () => {
  it('renders outcome badge, verdict, learning objective and metadata', () => {
    render(<ReportHeader run={buildRun()} deliveryVersion={3} mode="student" />);

    expect(screen.getByText('Necesita mejoras')).toBeInTheDocument();
    expect(screen.getByText('Veredicto de prueba.')).toBeInTheDocument();
    expect(screen.getByText('Aprender a validar entradas.')).toBeInTheDocument();
    expect(screen.getByText(/Entrega v3/)).toBeInTheDocument();
  });

  it('renders failure reason when present', () => {
    render(
      <ReportHeader
        run={buildRun({ failureReason: 'Timeout durante tests' })}
        mode="teacher"
      />,
    );

    expect(screen.getByText('Timeout durante tests')).toBeInTheDocument();
  });

  it('falls back to status-based outcome when report lacks overallOutcome', () => {
    render(
      <ReportHeader
        run={buildRun({ report: {}, status: 'FAILED' })}
        mode="teacher"
      />,
    );

    expect(screen.getByText('No apto')).toBeInTheDocument();
  });
});
/**
 * Pruebas de la cabecera de informe, sus metadatos y acciones.
 */
