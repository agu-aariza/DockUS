import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOneOptions,
  SelectQueryBuilder,
  DeepPartial,
} from 'typeorm';
import { Project } from '../../entities/project.entity';
import { IProjectRepository } from '../../domain/repositories/project.repository.interface';

@Injectable()
export class ProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repository: Repository<Project>,
  ) {}

  findOne(options: FindOneOptions<Project>): Promise<Project | null> {
    return this.repository.findOne(options);
  }

  create(entityLike: DeepPartial<Project>): Project {
    return this.repository.create(entityLike);
  }

  save(entity: DeepPartial<Project>): Promise<Project> {
    return this.repository.save(entity);
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<Project> {
    return this.repository.createQueryBuilder(alias);
  }
}
