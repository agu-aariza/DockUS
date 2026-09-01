import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PedagogicalReport } from '@/reporting/components/PedagogicalReport';

describe('PedagogicalReport', () => {
  it('renders null when items is empty', () => {
    const { container } = render(<PedagogicalReport items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the four narrative steps with labels and content', () => {
    const items = [
      { kind: 'success' as const, content: 'Compilaste sin errores.' },
      { kind: 'gap' as const, content: 'La salida no coincide con el oráculo.' },
      { kind: 'bridge' as const, content: 'Entiende la indexación de matrices.' },
      { kind: 'action' as const, content: 'Corrige la función de impresión.' },
    ];

    render(<PedagogicalReport items={items} />);

    expect(screen.getByText('Tu recorrido en esta entrega')).toBeInTheDocument();
    expect(screen.getByText('Logro')).toBeInTheDocument();
    expect(screen.getByText('Brecha')).toBeInTheDocument();
    expect(screen.getByText('Puente de aprendizaje')).toBeInTheDocument();
    expect(screen.getByText('Próximo paso')).toBeInTheDocument();
    expect(screen.getByText('Compilaste sin errores.')).toBeInTheDocument();
  });
});
/**
 * Pruebas de representación del informe pedagógico y de sus estados vacíos o incompletos.
 */
