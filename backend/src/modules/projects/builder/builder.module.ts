/**
 * @fileoverview Fachada pública del contexto Builder.
 *
 * La composición se reparte entre persistencia, runtime, IA y pipeline. Esta
 * fachada conserva el contrato de integración con controllers y bounded
 * contexts externos sin poseer providers de infraestructura o ejecución.
 *
 * @module BuilderModule
 */

import { Module } from '@nestjs/common';
import { BuilderController } from './presentation/builder.controller';
import { BuilderAiModule } from './builder-ai.module';
import { BuilderPersistenceModule } from './builder-persistence.module';
import { BuilderPipelineModule } from './builder-pipeline.module';
import { BuilderRuntimeModule } from './builder-runtime.module';
import { BUILD_RUN_REPOSITORY } from './domain/repositories/build-run.repository.interface';
import { BuilderQualityAggregationService } from './application/services/evaluation/builder-quality-aggregation.service';
import { BuilderRunCommandsService } from './application/services/orchestration/builder-run-commands.service';
import { BuilderRunLifecycleService } from './application/services/orchestration/builder-run-lifecycle.service';

@Module({
  imports: [
    BuilderPersistenceModule,
    BuilderRuntimeModule,
    BuilderAiModule,
    BuilderPipelineModule,
  ],
  controllers: [BuilderController],
  exports: [
    BuilderQualityAggregationService,
    BuilderRunCommandsService,
    BuilderRunLifecycleService,
    BUILD_RUN_REPOSITORY,
  ],
})
export class BuilderModule {}
