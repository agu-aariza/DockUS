/**
 * @fileoverview Motor Builder de evaluación asíncrona (evidence.service).
 *
 * @module evidence.service
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IObjectStorage } from '../../../domain/ports/object-storage.port';
import { OBJECT_STORAGE } from '../../../domain/ports/object-storage.port';
import { EvidenceArtifactPublic } from '../../domain/builder.types';
import {
  BuildRunArtifact,
  BuildRunArtifactType,
} from '../../domain/entities/build-run-artifact.entity';
import type { IBuildRunArtifactRepository } from '../../../domain/repositories/build-run-artifact.repository.interface';
import { BUILD_RUN_ARTIFACT_REPOSITORY } from '../../../domain/repositories/build-run-artifact.repository.interface';
import { toSha256Hex } from '../../../../../shared/utils/hash.util';

@Injectable()
export class EvidenceService {
  constructor(
    @Inject(BUILD_RUN_ARTIFACT_REPOSITORY)
    private readonly artifactsRepository: IBuildRunArtifactRepository,
    @Inject(OBJECT_STORAGE)
    private readonly objectStorage: IObjectStorage,
  ) {}

  async persistJsonArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    payload: unknown,
  ): Promise<EvidenceArtifactPublic> {
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    return this.persistBufferArtifact(
      buildRunId,
      type,
      Buffer.from(serialized, 'utf8'),
      'application/json',
      'json',
    );
  }

  async persistTextArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    text: string,
  ): Promise<EvidenceArtifactPublic> {
    return this.persistBufferArtifact(
      buildRunId,
      type,
      Buffer.from(text, 'utf8'),
      'text/plain; charset=utf-8',
      'txt',
    );
  }

  async listArtifacts(buildRunId: string): Promise<EvidenceArtifactPublic[]> {
    const artifacts =
      await this.artifactsRepository.findAllByBuildRun(buildRunId);
    return artifacts.map((artifact) => this.toPublicArtifact(artifact));
  }

  async getArtifactContent(
    buildRunId: string,
    artifactId: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    const artifact = await this.artifactsRepository.findOneByBuildRunAndId(
      buildRunId,
      artifactId,
    );
    if (!artifact) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }

    const content = await this.objectStorage.getObjectBuffer(
      artifact.bucket,
      artifact.objectKey,
    );

    return { content, contentType: artifact.contentType };
  }

  async createArtifactDownloadUrl(
    buildRunId: string,
    artifactId: string,
  ): Promise<{
    downloadUrl: string;
    expiresAt: string;
  }> {
    const artifact = await this.artifactsRepository.findOneByBuildRunAndId(
      buildRunId,
      artifactId,
    );
    if (!artifact) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }

    const downloadUrl = await this.objectStorage.createDownloadSignedUrl(
      artifact.bucket,
      artifact.objectKey,
    );
    const expiresAt = new Date(
      Date.now() + this.objectStorage.getSignedUrlTtlSeconds() * 1000,
    ).toISOString();

    return {
      downloadUrl,
      expiresAt,
    };
  }

  private async persistBufferArtifact(
    buildRunId: string,
    type: BuildRunArtifactType,
    content: Buffer,
    contentType: string,
    extension: string,
  ): Promise<EvidenceArtifactPublic> {
    const bucket = this.objectStorage.getBucketName();
    const sha256 = toSha256Hex(content);
    const objectKey = [
      'runs',
      buildRunId,
      type.toLowerCase(),
      `${Date.now()}-${sha256.slice(0, 8)}.${extension}`,
    ].join('/');

    await this.objectStorage.putObject({
      bucket,
      key: objectKey,
      body: content,
      contentType,
    });

    const saved = await this.artifactsRepository.save(
      this.artifactsRepository.create({
        buildRunId,
        artifactType: type,
        bucket,
        objectKey,
        contentType,
        sizeBytes: content.byteLength,
        sha256,
      }),
    );

    return this.toPublicArtifact(saved);
  }

  private toPublicArtifact(artifact: BuildRunArtifact): EvidenceArtifactPublic {
    return {
      id: artifact.id,
      type: artifact.artifactType,
      contentType: artifact.contentType,
      sizeBytes: artifact.sizeBytes,
      createdAt: artifact.createdAt.toISOString(),
    };
  }
}
