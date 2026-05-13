import { Module, Global } from '@nestjs/common';
import { OllamaGenerationService } from './ollama-generation.service';
import { PromptRegistryService } from './prompt-registry.service';

@Global()
@Module({
  providers: [PromptRegistryService, OllamaGenerationService],
  exports: [PromptRegistryService, OllamaGenerationService],
})
export class AiModule {}
