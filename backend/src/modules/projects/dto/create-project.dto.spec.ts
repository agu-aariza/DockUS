import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

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
