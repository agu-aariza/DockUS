import { FindOneOptions, SelectQueryBuilder, DeepPartial } from 'typeorm';
import { Project } from '../../entities/project.entity';

export interface IProjectRepository {
  findOne(options: FindOneOptions<Project>): Promise<Project | null>;
  create(entityLike: DeepPartial<Project>): Project;
  save(entity: DeepPartial<Project>): Promise<Project>;
  createQueryBuilder(alias?: string): SelectQueryBuilder<Project>;
}
