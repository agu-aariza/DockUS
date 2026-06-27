import { Module, Global } from '@nestjs/common';
import { BedrockGenerationService } from './bedrock-generation.service';
import { PromptRegistryService } from './prompt-registry.service';

@Global()
@Module({
  providers: [
    PromptRegistryService,
    BedrockGenerationService,
  ],
  exports: [PromptRegistryService, BedrockGenerationService],
})
export class AiModule {}
