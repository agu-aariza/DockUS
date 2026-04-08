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
    const lines = [
      `FROM ${baseImage}`,
      'ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1',
      'WORKDIR /app',
      'COPY . /app',
    ];

    if (assessment.recipe.systemPackages.length > 0) {
      lines.push(
        `RUN apt-get update && apt-get install -y --no-install-recommends ${assessment.recipe.systemPackages.join(
          ' ',
        )} && rm -rf /var/lib/apt/lists/*`,
      );
    }

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
