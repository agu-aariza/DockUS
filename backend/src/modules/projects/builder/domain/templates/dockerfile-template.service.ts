import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_BASE_PYTHON_IMAGE } from '../builder.constants';
import { BuilderLlmAssessment } from '../builder.types';

@Injectable()
export class DockerfileTemplateService {
  constructor(private readonly configService: ConfigService) {}

  render(assessment: BuilderLlmAssessment): string | null {
    const needsImage =
      assessment.recipe.install.length > 0 ||
      assessment.recipe.run !== null ||
      assessment.recipe.test.length > 0 ||
      assessment.recipe.healthcheck !== null ||
      assessment.recipe.systemPackages.length > 0;

    if (!needsImage) {
      return null;
    }

    const baseImage = this.resolveBaseImage();
    const workingDirectory = assessment.recipe.workingDirectory?.trim() || '.';
    const normalizedWorkdir =
      workingDirectory === '.'
        ? '/app'
        : `/app/${workingDirectory.replace(/^\.?\//u, '').replace(/\/+$/u, '')}`;
    const lines = [
      `FROM ${baseImage}`,
      'ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1',
    ];

    // Auto-instalación de gestores de dependencias si se solicitan en la receta
    const allCommands = [
      ...assessment.recipe.install.flat(),
      ...(assessment.recipe.run || []),
      ...assessment.recipe.test.flat(),
    ].map((t) => t.toLowerCase());

    const toolsToInstall: string[] = [];
    if (allCommands.includes('pipenv')) toolsToInstall.push('pipenv');
    if (allCommands.includes('poetry')) toolsToInstall.push('poetry');
    if (allCommands.includes('uv')) toolsToInstall.push('uv');
    if (allCommands.includes('pdm')) toolsToInstall.push('pdm');

    if (toolsToInstall.length > 0) {
      lines.push(`RUN pip install --no-cache-dir ${toolsToInstall.join(' ')}`);
    }

    lines.push('COPY . /app');

    if (assessment.recipe.systemPackages.length > 0) {
      lines.push(
        `RUN apt-get update && apt-get install -y --no-install-recommends ${assessment.recipe.systemPackages.join(
          ' ',
        )} && rm -rf /var/lib/apt/lists/*`,
      );
    }

    const envEntries = Object.entries(assessment.recipe.environment ?? {}).sort(
      ([a], [b]) => a.localeCompare(b),
    );
    for (const [key, value] of envEntries) {
      lines.push(`ENV ${key}=${JSON.stringify(value)}`);
    }

    lines.push(`WORKDIR ${normalizedWorkdir}`);

    for (const installCommand of assessment.recipe.install) {
      lines.push(`RUN ${JSON.stringify(installCommand)}`);
    }

    if (assessment.recipe.servicePort !== null) {
      lines.push(`EXPOSE ${assessment.recipe.servicePort}`);
    }

    if (assessment.recipe.healthcheck) {
      lines.push(
        `HEALTHCHECK CMD ${JSON.stringify(assessment.recipe.healthcheck)}`,
      );
    }

    if (assessment.recipe.run) {
      lines.push(`CMD ${JSON.stringify(assessment.recipe.run)}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  private resolveBaseImage(): string {
    const configuredImage =
      this.configService.get<string>('BUILDER_BASE_PYTHON_IMAGE')?.trim() ?? '';
    return configuredImage || DEFAULT_BASE_PYTHON_IMAGE;
  }
}
