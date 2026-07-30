/**
 * @fileoverview Adaptador TypeORM de `ILlmConfigurationRepository`
 * (llm-configuration.repository).
 *
 * @module llm-configuration.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LlmConfiguration } from '../../domain/entities/llm-configuration.entity';
import {
  ILlmConfigurationRepository,
  NewLlmConfigurationData,
} from '../../domain/repositories/llm-configuration.repository.interface';

@Injectable()
export class LlmConfigurationRepository implements ILlmConfigurationRepository {
  constructor(
    @InjectRepository(LlmConfiguration)
    private readonly repository: Repository<LlmConfiguration>,
  ) {}

  findAll(): Promise<LlmConfiguration[]> {
    return this.repository.find();
  }

  findAllOrderedByProviderId(): Promise<LlmConfiguration[]> {
    return this.repository.find({ order: { providerId: 'ASC' } });
  }

  create(data: NewLlmConfigurationData): LlmConfiguration {
    return this.repository.create(data);
  }

  saveMany(entities: LlmConfiguration[]): Promise<LlmConfiguration[]> {
    return this.repository.save(entities);
  }
}
