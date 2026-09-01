/**
 * @fileoverview Persistencia propia del contexto Builder.
 *
 * Este módulo es la única composición de los adaptadores TypeORM del Builder.
 * El resto del contexto consume únicamente los tokens de sus puertos.
 *
 * @module BuilderPersistenceModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildRunArtifact } from './domain/entities/build-run-artifact.entity';
import { BuildRunChatMessage } from './domain/entities/build-run-chat-message.entity';
import { BuildRunEventEntity } from './domain/entities/build-run-event.entity';
import { BuildRun } from './domain/entities/build-run.entity';
import { CodeQualityFindingEntity } from './domain/entities/code-quality-finding.entity';
import { LlmConfiguration } from './domain/entities/llm-configuration.entity';
import { BUILD_RUN_ARTIFACT_REPOSITORY } from './domain/repositories/build-run-artifact.repository.interface';
import { BUILD_RUN_CHAT_MESSAGE_REPOSITORY } from './domain/repositories/build-run-chat-message.repository.interface';
import { BUILD_RUN_EVENT_REPOSITORY } from './domain/repositories/build-run-event.repository.interface';
import { BUILD_RUN_REPOSITORY } from './domain/repositories/build-run.repository.interface';
import { CODE_QUALITY_FINDING_REPOSITORY } from './domain/repositories/code-quality-finding.repository.interface';
import { LLM_CONFIGURATION_REPOSITORY } from './domain/repositories/llm-configuration.repository.interface';
import { BuildRunArtifactRepository } from './infrastructure/database/build-run-artifact.repository';
import { BuildRunChatMessageRepository } from './infrastructure/database/build-run-chat-message.repository';
import { BuildRunEventRepository } from './infrastructure/database/build-run-event.repository';
import { BuildRunRepository } from './infrastructure/database/build-run.repository';
import { CodeQualityFindingRepository } from './infrastructure/database/code-quality-finding.repository';
import { LlmConfigurationRepository } from './infrastructure/database/llm-configuration.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BuildRun,
      BuildRunArtifact,
      BuildRunEventEntity,
      CodeQualityFindingEntity,
      BuildRunChatMessage,
      LlmConfiguration,
    ]),
  ],
  providers: [
    {
      provide: BUILD_RUN_REPOSITORY,
      useClass: BuildRunRepository,
    },
    {
      provide: CODE_QUALITY_FINDING_REPOSITORY,
      useClass: CodeQualityFindingRepository,
    },
    {
      provide: BUILD_RUN_ARTIFACT_REPOSITORY,
      useClass: BuildRunArtifactRepository,
    },
    {
      provide: BUILD_RUN_CHAT_MESSAGE_REPOSITORY,
      useClass: BuildRunChatMessageRepository,
    },
    {
      provide: BUILD_RUN_EVENT_REPOSITORY,
      useClass: BuildRunEventRepository,
    },
    {
      provide: LLM_CONFIGURATION_REPOSITORY,
      useClass: LlmConfigurationRepository,
    },
  ],
  exports: [
    BUILD_RUN_REPOSITORY,
    CODE_QUALITY_FINDING_REPOSITORY,
    BUILD_RUN_ARTIFACT_REPOSITORY,
    BUILD_RUN_CHAT_MESSAGE_REPOSITORY,
    BUILD_RUN_EVENT_REPOSITORY,
    LLM_CONFIGURATION_REPOSITORY,
  ],
})
export class BuilderPersistenceModule {}
