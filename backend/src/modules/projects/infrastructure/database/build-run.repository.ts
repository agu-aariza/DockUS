import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOneOptions,
  SelectQueryBuilder,
  DeepPartial,
} from 'typeorm';
import { BuildRun } from '../../builder/domain/entities/build-run.entity';
import { IBuildRunRepository } from '../../domain/repositories/build-run.repository.interface';

@Injectable()
export class BuildRunRepository implements IBuildRunRepository {
  constructor(
    @InjectRepository(BuildRun)
    private readonly repository: Repository<BuildRun>,
  ) {}

  findOne(options: FindOneOptions<BuildRun>): Promise<BuildRun | null> {
    return this.repository.findOne(options);
  }

  create(entityLike: DeepPartial<BuildRun>): BuildRun {
    return this.repository.create(entityLike);
  }

  save(entity: DeepPartial<BuildRun>): Promise<BuildRun> {
    return this.repository.save(entity);
  }

  createQueryBuilder(alias?: string): SelectQueryBuilder<BuildRun> {
    return this.repository.createQueryBuilder(alias);
  }
}
