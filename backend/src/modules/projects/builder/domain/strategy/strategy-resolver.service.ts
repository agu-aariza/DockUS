import { Injectable } from '@nestjs/common';
import {
  ClassificationResult,
  ServiceCandidate,
} from '../classification/classifier.service';
import {
  Deployability,
  ExecutionProfile,
  ProjectClass,
  StrategyResult,
} from '../builder.types';

@Injectable()
export class StrategyResolverService {
  resolve(input: ClassificationResult): StrategyResult {
    const selectedClass = input.characterization.mainClass;
    const deployability = input.characterization.facets.deployability;
    const serviceCandidate = this.selectServiceCandidate(
      input.serviceCandidates,
    );

    const strategy: StrategyResult = {
      selectedClass,
      build: {
        mode: this.resolveBuildMode(input),
        dockerTemplate: this.resolveTemplate(selectedClass, serviceCandidate),
        pythonVersion: input.pythonVersion,
      },
      execution: {
        profile: input.characterization.facets.execution_profile,
        command: this.resolveExecutionCommand(input),
        serviceType:
          serviceCandidate?.framework ??
          (selectedClass === ProjectClass.DJANGO_APP ? 'django' : null),
        appModule: serviceCandidate?.module ?? null,
        appVariable: serviceCandidate?.appVar ?? null,
        namespace: null,
      },
      notes: [],
      blockingConditions: [...input.blockingReasons],
    };

    if (deployability !== Deployability.DEPLOYABLE) {
      strategy.execution.command = null;
      strategy.execution.profile = ExecutionProfile.ANALYSIS_ONLY;
    }

    if (selectedClass === ProjectClass.ANALYZABLE_NON_DEPLOYABLE) {
      strategy.notes.push(
        'Se detectó proyecto Python analizable, pero sin receta de arranque determinista.',
      );
    }
    if (selectedClass === ProjectClass.INCOMPLETE_OR_INVALID) {
      strategy.notes.push(
        'La entrega no contiene señales suficientes para build/ejecución segura.',
      );
    }

    return strategy;
  }

  private resolveBuildMode(
    input: ClassificationResult,
  ): StrategyResult['build']['mode'] {
    if (input.requirementsPath) {
      return 'requirements';
    }
    if (input.pyprojectPath) {
      return 'pyproject';
    }
    if (
      input.characterization.mainClass === ProjectClass.SIMPLE_SCRIPT ||
      input.characterization.mainClass === ProjectClass.INSTALLABLE_PACKAGE
    ) {
      return 'copy_only';
    }
    return 'none';
  }

  private resolveTemplate(
    selectedClass: ProjectClass,
    serviceCandidate: ServiceCandidate | null,
  ): StrategyResult['build']['dockerTemplate'] {
    if (selectedClass === ProjectClass.DJANGO_APP) {
      return 'django';
    }
    if (selectedClass === ProjectClass.WEB_SERVICE_FASTAPI_FLASK) {
      if (serviceCandidate?.framework === 'fastapi') {
        return 'fastapi';
      }
      if (serviceCandidate?.framework === 'flask') {
        return 'flask';
      }
      return 'none';
    }
    if (
      selectedClass === ProjectClass.SIMPLE_SCRIPT ||
      selectedClass === ProjectClass.INSTALLABLE_PACKAGE
    ) {
      return 'batch';
    }
    return 'none';
  }

  private resolveExecutionCommand(
    input: ClassificationResult,
  ): string[] | null {
    const selectedClass = input.characterization.mainClass;
    const profile = input.characterization.facets.execution_profile;
    if (profile === ExecutionProfile.ANALYSIS_ONLY) {
      return null;
    }

    if (selectedClass === ProjectClass.DJANGO_APP) {
      return ['python', 'manage.py', 'runserver', '0.0.0.0:8000'];
    }

    if (
      (selectedClass === ProjectClass.SIMPLE_SCRIPT ||
        selectedClass === ProjectClass.INSTALLABLE_PACKAGE) &&
      input.resolvedEntrypoint
    ) {
      return ['python', input.resolvedEntrypoint];
    }

    return null;
  }

  private selectServiceCandidate(
    candidates: ServiceCandidate[],
  ): ServiceCandidate | null {
    if (candidates.length !== 1) {
      return null;
    }
    return candidates[0];
  }
}
