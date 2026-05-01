import { Module, Global } from '@nestjs/common';
import { PromptRegistryService } from './prompt-registry.service';

@Global()
@Module({
  providers: [PromptRegistryService],
  exports: [PromptRegistryService],
})
export class AiModule {}
