import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Project } from './project.entity';

describe('Project entity storage mapping', () => {
  it('persists runtime metadata with Docker-first column names', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (column) => column.target === Project,
    );

    const runtimeNetworkNameColumn = columns.find(
      (column) => column.propertyName === 'runtimeNetworkName',
    );
    const runtimeEnvironmentStatusColumn = columns.find(
      (column) => column.propertyName === 'runtimeEnvironmentStatus',
    );

    expect(runtimeNetworkNameColumn?.options.name).toBeUndefined();
    expect(runtimeEnvironmentStatusColumn?.options.name).toBeUndefined();
  });
});
