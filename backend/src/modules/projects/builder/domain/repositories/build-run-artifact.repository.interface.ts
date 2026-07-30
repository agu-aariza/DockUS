/**
 * @fileoverview Puerto de persistencia de `BuildRunArtifact`
 * (build-run-artifact.repository.interface).
 *
 * @module build-run-artifact.repository.interface
 */

import {
  BuildRunArtifact,
  BuildRunArtifactType,
} from '../entities/build-run-artifact.entity';

/**
 * Puerto real (ARQ-007 P2-7): sin puerto
 * previo, 2 consumidores reales (`EvidenceService`/`BuilderLlmChatService`).
 * Mismo criterio que ARQ-007: sin tipos de TypeORM en la firma.
 */
export const BUILD_RUN_ARTIFACT_REPOSITORY = Symbol(
  'IBuildRunArtifactRepository',
);

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewBuildRunArtifactData {
  buildRunId: string;
  artifactType: BuildRunArtifactType;
  bucket: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}

export interface IBuildRunArtifactRepository {
  /** Todos los artefactos de un run, por antigüedad ascendente. */
  findAllByBuildRun(buildRunId: string): Promise<BuildRunArtifact[]>;

  /** Un artefacto concreto de un run por su ID (evidencia descargable). */
  findOneByBuildRunAndId(
    buildRunId: string,
    artifactId: string,
  ): Promise<BuildRunArtifact | null>;

  /** El artefacto de un tipo concreto de un run (p. ej. el prompt de evaluación para el Tutor IA). */
  findOneByBuildRunAndType(
    buildRunId: string,
    artifactType: BuildRunArtifactType,
  ): Promise<BuildRunArtifact | null>;

  create(data: NewBuildRunArtifactData): BuildRunArtifact;
  save(artifact: BuildRunArtifact): Promise<BuildRunArtifact>;
}
