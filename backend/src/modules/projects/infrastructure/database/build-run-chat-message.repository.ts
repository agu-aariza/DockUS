/**
 * @fileoverview Adaptador TypeORM de `IBuildRunChatMessageRepository`
 * (build-run-chat-message.repository).
 *
 * @module build-run-chat-message.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuildRunChatMessage } from '../../builder/domain/entities/build-run-chat-message.entity';
import {
  IBuildRunChatMessageRepository,
  NewBuildRunChatMessageData,
} from '../../domain/repositories/build-run-chat-message.repository.interface';

@Injectable()
export class BuildRunChatMessageRepository implements IBuildRunChatMessageRepository {
  constructor(
    @InjectRepository(BuildRunChatMessage)
    private readonly repository: Repository<BuildRunChatMessage>,
  ) {}

  findAllByBuildRun(buildRunId: string): Promise<BuildRunChatMessage[]> {
    return this.repository.find({
      where: { buildRunId },
      order: { createdAt: 'ASC' },
    });
  }

  create(data: NewBuildRunChatMessageData): BuildRunChatMessage {
    return this.repository.create(data);
  }

  save(message: BuildRunChatMessage): Promise<BuildRunChatMessage> {
    return this.repository.save(message);
  }
}
