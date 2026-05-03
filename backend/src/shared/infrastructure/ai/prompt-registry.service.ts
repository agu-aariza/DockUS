import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';

export enum PromptId {
  PLAN = 'plan',
  EVAL = 'eval',
}

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);
  private readonly prompts = new Map<PromptId, string>();

  constructor() {
    this.loadFromManifest();
  }

  private loadFromManifest() {
    const manifestPath = path.resolve(__dirname, 'prompts.json');

    if (!existsSync(manifestPath)) {
      this.logger.error(`Prompt manifest not found at ${manifestPath}`);
      return;
    }

    try {
      const rawData = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(rawData);

      for (const [key, value] of Object.entries(manifest)) {
        this.prompts.set(key as PromptId, value as string);
      }

      this.logger.log(
        `Prompt registry initialized with ${this.prompts.size} prompts from JSON.`,
      );
    } catch (error) {
      this.logger.error(`Failed to load prompt manifest: ${error.message}`);
    }
  }

  getPrompt(id: PromptId, variables?: Record<string, string>): string {
    const basePrompt = this.prompts.get(id);
    if (!basePrompt) {
      throw new Error(`Prompt with ID ${id} not found in registry.`);
    }

    if (!variables) {
      return basePrompt;
    }

    // Simple template replacement: {{variable_name}}
    let processed = basePrompt;
    for (const [key, value] of Object.entries(variables)) {
      processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return processed;
  }
}
