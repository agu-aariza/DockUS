import { FindOneOptions, SelectQueryBuilder, DeepPartial } from 'typeorm';
import { BuildRun } from '../../builder/domain/entities/build-run.entity';

export interface IBuildRunRepository {
  findOne(options: FindOneOptions<BuildRun>): Promise<BuildRun | null>;
  create(entityLike: DeepPartial<BuildRun>): BuildRun;
  save(entity: DeepPartial<BuildRun>): Promise<BuildRun>;
  save(entities: DeepPartial<BuildRun>[]): Promise<BuildRun[]>;
  createQueryBuilder(alias?: string): SelectQueryBuilder<BuildRun>;
}
