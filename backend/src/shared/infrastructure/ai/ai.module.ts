import { Module, Global } from '@nestjs/common';
import { SecretCipherService } from '../security/secret-cipher.service';
import { BedrockGenerationService } from './bedrock-generation.service';
import { LlmGenerationRouter } from './llm-generation.router';
import { PromptRegistryService } from './prompt-registry.service';
import { AnthropicGenerationService } from './providers/anthropic-generation.service';
import { GeminiGenerationService } from './providers/gemini-generation.service';
import { OpenAiCompatibleGenerationService } from './providers/openai-compatible-generation.service';

@Global()
@Module({
  providers: [
    PromptRegistryService,
    SecretCipherService,
    BedrockGenerationService,
    OpenAiCompatibleGenerationService,
    AnthropicGenerationService,
    GeminiGenerationService,
    LlmGenerationRouter,
  ],
  exports: [
    PromptRegistryService,
    SecretCipherService,
    BedrockGenerationService,
    LlmGenerationRouter,
  ],
})
export class AiModule {}
