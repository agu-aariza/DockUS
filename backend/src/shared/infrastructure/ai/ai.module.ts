import { Module, Global } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { SecretCipherService } from '../security/secret-cipher.service';
import { LlmCircuitBreakerService } from './llm-circuit-breaker.service';
import { BedrockGenerationService } from './bedrock-generation.service';
import { LlmGenerationRouter } from './llm-generation.router';
import { PromptRegistryService } from './prompt-registry.service';
import { AnthropicGenerationService } from './providers/anthropic-generation.service';
import { GeminiGenerationService } from './providers/gemini-generation.service';
import { OpenAiCompatibleGenerationService } from './providers/openai-compatible-generation.service';

@Global()
@Module({
  // `CacheModule` da el cliente Redis que respalda el cortacircuitos por
  // proveedor: su estado se comparte entre workers para que el primero que
  // detecta la indisponibilidad proteja a los demás (ESC-ALTO-02).
  imports: [CacheModule],
  providers: [
    LlmCircuitBreakerService,
    PromptRegistryService,
    SecretCipherService,
    BedrockGenerationService,
    OpenAiCompatibleGenerationService,
    AnthropicGenerationService,
    GeminiGenerationService,
    LlmGenerationRouter,
  ],
  exports: [
    LlmCircuitBreakerService,
    PromptRegistryService,
    SecretCipherService,
    BedrockGenerationService,
    LlmGenerationRouter,
  ],
})
export class AiModule {}
