import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutcomeBadge } from '@/reporting/components/report/OutcomeBadge';

describe('OutcomeBadge', () => {
  it.each([
    ['PASS', 'Apto', 'border-success-200'],
    ['FAIL', 'No apto', 'border-rose-200'],
    ['PARTIAL', 'Necesita mejoras', 'border-warning-200'],
    ['UNKNOWN', 'Sin evaluar', 'border-slate-200'],
  ] as const)('renders %s as "%s" with expected tone', (outcome, label, toneClass) => {
    render(<OutcomeBadge outcome={outcome} />);

    const badge = screen.getByText(label);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain(toneClass);
  });
});
/**
 * Pruebas de las etiquetas visuales de resultado del Builder.
 */
