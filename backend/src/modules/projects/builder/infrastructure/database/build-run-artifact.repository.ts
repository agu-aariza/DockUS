/**
 * @fileoverview Adaptador TypeORM de `IBuildRunArtifactRepository`
 * (build-run-artifact.repository).
 *
 * @module build-run-artifact.repository
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BuildRunArtifact,
  BuildRunArtifactType,
} from '../../domain/entities/build-run-artifact.entity';
import {
  IBuildRunArtifactRepository,
  NewBuildRunArtifactData,
} from '../../domain/repositories/build-run-artifact.repository.interface';

@Injectable()
export class BuildRunArtifactRepository implements IBuildRunArtifactRepository {
  constructor(
    @InjectRepository(BuildRunArtifact)
    private readonly repository: Repository<BuildRunArtifact>,
  ) {}

  findAllByBuildRun(buildRunId: string): Promise<BuildRunArtifact[]> {
    return this.repository.find({
      where: { buildRunId },
      order: { createdAt: 'ASC' },
    });
  }

  findOneByBuildRunAndId(
    buildRunId: string,
    artifactId: string,
  ): Promise<BuildRunArtifact | null> {
    return this.repository.findOne({
      where: { id: artifactId, buildRunId },
    });
  }

  findOneByBuildRunAndType(
    buildRunId: string,
    artifactType: BuildRunArtifactType,
  ): Promise<BuildRunArtifact | null> {
    return this.repository.findOne({
      where: { buildRunId, artifactType },
    });
  }

  create(data: NewBuildRunArtifactData): BuildRunArtifact {
    return this.repository.create(data);
  }

  save(artifact: BuildRunArtifact): Promise<BuildRunArtifact> {
    return this.repository.save(artifact);
  }
}
