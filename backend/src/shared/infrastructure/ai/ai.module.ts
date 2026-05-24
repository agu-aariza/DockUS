import { Module, Global } from '@nestjs/common';
import { BedrockGenerationService } from './bedrock-generation.service';
import { LLM_GENERATION_SERVICE } from './llm-generation.token';
import { PromptRegistryService } from './prompt-registry.service';

@Global()
@Module({
  providers: [
    PromptRegistryService,
    BedrockGenerationService,
    {
      provide: LLM_GENERATION_SERVICE,
      useExisting: BedrockGenerationService,
    },
  ],
  exports: [PromptRegistryService, BedrockGenerationService, LLM_GENERATION_SERVICE],
})
export class AiModule {}
