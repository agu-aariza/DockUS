import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  it.each([
    ['high', 'Severidad alta', 'border-rose-200'],
    ['medium', 'Severidad media', 'border-amber-200'],
    ['low', 'Severidad baja', 'border-sky-200'],
  ] as const)('renders %s severity badge', (severity, label, toneClass) => {
    render(<SeverityBadge severity={severity} level="intermedio" />);

    const badge = screen.getByText(label);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain(toneClass);
    expect(screen.getByText('intermedio')).toBeInTheDocument();
  });

  it('renders without level when omitted', () => {
    render(<SeverityBadge severity="low" />);

    expect(screen.getByText('Severidad baja')).toBeInTheDocument();
    expect(screen.queryByText('basico')).not.toBeInTheDocument();
  });
});
