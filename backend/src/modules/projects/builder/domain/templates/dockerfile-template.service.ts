import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassificationResult } from '../classification/classifier.service';
import {
  DEFAULT_BASE_PYTHON_IMAGE,
  DEFAULT_PYTHON_VERSION,
} from '../builder.constants';
import { StrategyResult } from '../builder.types';

@Injectable()
export class DockerfileTemplateService {
  constructor(private readonly configService: ConfigService) {}

  render(
    strategy: StrategyResult,
    classification: ClassificationResult,
  ): string | null {
    if (strategy.build.dockerTemplate === 'none') {
      return null;
    }

    const installStep = this.resolveInstallStep(strategy, classification);
    const baseImage = this.resolveBaseImage();
    const header = [
      `FROM ${baseImage}`,
      'ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1',
      'WORKDIR /app',
      'COPY . /app',
    ];

    if (installStep) {
      header.push(`RUN ${installStep}`);
    }

    if (strategy.build.dockerTemplate === 'batch') {
      const entrypoint = classification.resolvedEntrypoint ?? 'main.py';
      return [...header, `CMD ["python","${entrypoint}"]`, ''].join('\n');
    }

    if (strategy.build.dockerTemplate === 'django') {
      return [
        ...header,
        'EXPOSE 8000',
        'CMD ["python","manage.py","runserver","0.0.0.0:8000"]',
        '',
      ].join('\n');
    }

    if (strategy.build.dockerTemplate === 'fastapi') {
      if (!strategy.execution.appModule || !strategy.execution.appVariable) {
        return null;
      }
      return [
        ...header,
        'EXPOSE 8000',
        `CMD ["python","-m","uvicorn","${strategy.execution.appModule}:${strategy.execution.appVariable}","--host","0.0.0.0","--port","8000"]`,
        '',
      ].join('\n');
    }

    if (strategy.build.dockerTemplate === 'flask') {
      if (!strategy.execution.appModule || !strategy.execution.appVariable) {
        return null;
      }
      return [
        ...header,
        'EXPOSE 8000',
        `CMD ["python","-m","flask","--app","${strategy.execution.appModule}:${strategy.execution.appVariable}","run","--host","0.0.0.0","--port","8000"]`,
        '',
      ].join('\n');
    }

    return null;
  }

  private resolveInstallStep(
    strategy: StrategyResult,
    classification: ClassificationResult,
  ): string | null {
    if (
      strategy.build.mode === 'requirements' &&
      classification.requirementsPath
    ) {
      return `pip install --no-cache-dir -r ${classification.requirementsPath}`;
    }
    if (strategy.build.mode === 'pyproject' && classification.pyprojectPath) {
      return 'pip install --no-cache-dir .';
    }
    return null;
  }

  private resolveBaseImage(): string {
    const configuredImage = this.configService.get<string>(
      'BUILDER_BASE_PYTHON_IMAGE',
      DEFAULT_BASE_PYTHON_IMAGE,
    );
    if (configuredImage?.trim()) {
      return configuredImage;
    }
    const fallbackVersion = this.configService.get<string>(
      'BUILDER_DEFAULT_PYTHON_VERSION',
      DEFAULT_PYTHON_VERSION,
    );
    return `python:${fallbackVersion}-slim`;
  }
}
