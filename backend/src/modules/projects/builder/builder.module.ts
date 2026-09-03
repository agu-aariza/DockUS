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

@Module({
  imports: [
    BuilderPersistenceModule,
    BuilderRuntimeModule,
    BuilderAiModule,
    BuilderPipelineModule,
  ],
  controllers: [BuilderController],
  exports: [BuilderAiModule, BuilderPipelineModule, BuilderPersistenceModule],
})
export class BuilderModule {}
