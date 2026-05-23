import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MinioStorageService } from '../../../../../shared/infrastructure/storage/minio-storage.service';
import { EvidenceArtifactPublic } from '../../domain/builder.types';
import {
  BuildRunArtifact,
  BuildRunArtifactType,
} from '../../domain/entities/build-run-artifact.entity';
import { toSha256Hex } from '../utils/builder-analysis.util';

@Injectable()
export class EvidenceService {
  constructor(
    @InjectRepository(BuildRunArtifact)
    private readonly artifactsRepository: Repository<BuildRunArtifact>,
    private readonly minioStorageService: MinioStorageService,
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
    const artifacts = await this.artifactsRepository.find({
      where: { buildRunId },
      order: { createdAt: 'ASC' },
    });
    return artifacts.map((artifact) => this.toPublicArtifact(artifact));
  }

  async getArtifactContent(
    buildRunId: string,
    artifactId: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    const artifact = await this.artifactsRepository.findOne({
      where: { id: artifactId, buildRunId },
    });
    if (!artifact) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }

    const content = await this.minioStorageService.getObjectBuffer(
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
    const artifact = await this.artifactsRepository.findOne({
      where: { id: artifactId, buildRunId },
    });
    if (!artifact) {
      throw new NotFoundException('Artefacto de evidencia no encontrado.');
    }

    const downloadUrl = await this.minioStorageService.createDownloadSignedUrl(
      artifact.bucket,
      artifact.objectKey,
    );
    const expiresAt = new Date(
      Date.now() + this.minioStorageService.getSignedUrlTtlSeconds() * 1000,
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
    const bucket = this.minioStorageService.getBucketName();
    const sha256 = toSha256Hex(content);
    const objectKey = [
      'runs',
      buildRunId,
      type.toLowerCase(),
      `${Date.now()}-${sha256.slice(0, 8)}.${extension}`,
    ].join('/');

    await this.minioStorageService.putObject({
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
