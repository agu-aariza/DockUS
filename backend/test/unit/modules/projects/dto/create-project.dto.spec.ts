import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProjectDto } from '@app/modules/projects/dto/create-project.dto';

function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProjectDto, payload);
  return validateSync(dto, { whitelist: true });
}

describe('CreateProjectDto rubricCriteria', () => {
  it('accepts a project without rubric criteria (optional)', () => {
    const errors = validateDto({ title: 'Proyecto sin rúbrica' });
    expect(errors).toHaveLength(0);
  });

  it('accepts weighted criteria that sum to 100', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricCriteria: [
        { name: 'Correctitud', weight: 60 },
        { name: 'Calidad', weight: 40, description: 'Legible y modular.' },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects criteria whose weights do not sum to 100', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricCriteria: [
        { name: 'Correctitud', weight: 60 },
        { name: 'Calidad', weight: 30 },
      ],
    });
    const flattened = JSON.stringify(errors);
    expect(errors.length).toBeGreaterThan(0);
    expect(flattened).toContain('deben sumar 100');
  });

  it('rejects a criterion with a weight above 100', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricCriteria: [{ name: 'Correctitud', weight: 150 }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a criterion without a name', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricCriteria: [{ weight: 100 }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('CreateProjectDto free-text length caps', () => {
  // Ambos campos se incrustan en cada prompt LLM del proyecto: sin tope, el
  // coste de inferencia por ejecución no tiene techo.
  it('accepts rubricInstructions within the cap', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricInstructions: 'A'.repeat(8000),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects rubricInstructions above 8000 characters', () => {
    const errors = validateDto({
      title: 'Proyecto',
      rubricInstructions: 'A'.repeat(8001),
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('8000 caracteres');
  });

  it('accepts expectedOutput within the cap', () => {
    const errors = validateDto({
      title: 'Proyecto',
      expectedOutput: 'A'.repeat(4000),
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects expectedOutput above 4000 characters', () => {
    const errors = validateDto({
      title: 'Proyecto',
      expectedOutput: 'A'.repeat(4001),
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('4000 caracteres');
  });
});

describe('CreateProjectDto assignedGroupIds', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('accepts an array of valid UUIDs', () => {
    const errors = validateDto({
      title: 'Proyecto',
      assignedGroupIds: [uuid],
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts the field being absent', () => {
    const errors = validateDto({ title: 'Proyecto' });
    expect(errors).toHaveLength(0);
  });

  // Antes pasaban la capa DTO y afloraban como error crudo de consulta en vez
  // de un 400 limpio.
  it('rejects a non-UUID identifier', () => {
    const errors = validateDto({
      title: 'Proyecto',
      assignedGroupIds: ['no-es-un-uuid'],
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('UUID válido');
  });

  it('rejects a mixed array where only one entry is malformed', () => {
    const errors = validateDto({
      title: 'Proyecto',
      assignedGroupIds: [uuid, 'x'],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects more than 200 groups', () => {
    const errors = validateDto({
      title: 'Proyecto',
      assignedGroupIds: Array.from({ length: 201 }, () => uuid),
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('más de 200 grupos');
  });

  it('rejects a value that is not an array', () => {
    const errors = validateDto({
      title: 'Proyecto',
      assignedGroupIds: uuid,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
