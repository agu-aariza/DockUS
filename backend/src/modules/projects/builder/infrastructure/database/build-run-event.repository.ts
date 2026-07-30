/**
 * @fileoverview Adaptador TypeORM de `IBuildRunEventRepository`
 * (build-run-event.repository).
 *
 * @module build-run-event.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildRunEventEntity } from '../../domain/entities/build-run-event.entity';
import {
  IBuildRunEventRepository,
  NewBuildRunEventData,
} from '../../domain/repositories/build-run-event.repository.interface';

@Injectable()
export class BuildRunEventRepository implements IBuildRunEventRepository {
  constructor(
    @InjectRepository(BuildRunEventEntity)
    private readonly repository: Repository<BuildRunEventEntity>,
  ) {}

  create(data: NewBuildRunEventData): BuildRunEventEntity {
    return this.repository.create(data);
  }

  save(event: BuildRunEventEntity): Promise<BuildRunEventEntity> {
    return this.repository.save(event);
  }

  async findPage(
    buildRunId: string,
    afterSequence: number,
    limit: number,
  ): Promise<BuildRunEventEntity[]> {
    const query = this.repository
      .createQueryBuilder('event')
      .where('event.buildRunId = :buildRunId', { buildRunId })
      .orderBy('event.sequence', 'ASC')
      .take(limit);

    if (afterSequence > 0) {
      query.andWhere('event.sequence > :afterSequence', { afterSequence });
    }

    return query.getMany();
  }
}
