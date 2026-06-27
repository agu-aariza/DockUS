import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Project } from './project.entity';

describe('Project entity storage mapping', () => {
  it('maps core project columns', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === Project,
    );

    const titleColumn = columns.find(
      (column) => column.propertyName === 'title',
    );
    const statusColumn = columns.find(
      (column) => column.propertyName === 'status',
    );

    expect(titleColumn).toBeDefined();
    expect(statusColumn).toBeDefined();
  });
});
