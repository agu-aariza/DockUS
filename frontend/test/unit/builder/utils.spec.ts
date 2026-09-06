import { describe, expect, it } from 'vitest';
import { formatDate, mergeEvents } from '../../../src/builder/utils';
import type { BuildRunEvent } from '../../../src/features/builder/types';

describe('mergeEvents — optimización de rendimiento y coherencia', () => {
  const createEvent = (
    id: string,
    sequence: number,
    type: string = 'LOG_CHUNK',
  ): BuildRunEvent =>
    ({
      id,
      sequence,
      type,
      stream: 'stdout',
      timestamp: new Date().toISOString(),
      payload: { message: `event ${id}` },
    }) as unknown as BuildRunEvent;

  it('devuelve el array actual si el array entrante está vacío', () => {
    const current = [createEvent('e1', 1)];
    const result = mergeEvents(current, []);
    expect(result).toBe(current);
  });

  it('anexa de forma directa y secuencial un evento entrante con mayor secuencia (fast-path O(1))', () => {
    const current = [createEvent('e1', 1), createEvent('e2', 2)];
    const incoming = [createEvent('e3', 3)];

    const result = mergeEvents(current, incoming);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('e1');
    expect(result[1].id).toBe('e2');
    expect(result[2].id).toBe('e3');
  });

  it('actualiza el contenido de un evento si coincide el ID en streaming', () => {
    const current = [createEvent('e1', 1), createEvent('e2', 2)];
    const updatedE2 = {
      ...createEvent('e2', 2),
      payload: { message: 'actualizado' },
    };

    const result = mergeEvents(current, [updatedE2]);
    expect(result).toHaveLength(2);
    expect(result[1].payload).toEqual({ message: 'actualizado' });
  });

  it('inserta correctamente eventos fuera de orden en su posición secuencial correspondiente', () => {
    const current = [createEvent('e1', 1), createEvent('e3', 3)];
    const outOfOrderE2 = createEvent('e2', 2);

    const result = mergeEvents(current, [outOfOrderE2]);
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(result.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('fusiona lotes múltiples eliminando duplicados y ordenando por secuencia', () => {
    const current = [createEvent('e2', 2), createEvent('e1', 1)];
    const batch = [
      createEvent('e4', 4),
      createEvent('e3', 3),
      createEvent('e1', 1), // duplicado
    ];

    const result = mergeEvents(current, batch);
    expect(result).toHaveLength(4);
    expect(result.map((e) => e.sequence)).toEqual([1, 2, 3, 4]);
  });
});

describe('formatDate', () => {
  it('devuelve n/a si el valor es nulo o indefinido', () => {
    expect(formatDate(null)).toBe('n/a');
    expect(formatDate(undefined)).toBe('n/a');
  });

  it('formatea fechas válidas', () => {
    const dateStr = '2026-09-06T15:00:00.000Z';
    expect(formatDate(dateStr)).not.toBe('n/a');
  });
});
