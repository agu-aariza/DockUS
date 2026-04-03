/**
 * @fileoverview Cliente reutilizable para operaciones de almacenamiento MinIO/S3.
 *
 * Contexto:
 * - Centraliza upload, delete, verificacion y signed URLs de objetos.
 * - Gestiona bootstrap de bucket para entorno local.
 *
 * @module MinioStorageService
 */

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

interface PutObjectParams {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly signedUrlTtlSeconds: number;
  private readonly bootstrapOnStartup: boolean;
  private readonly nodeEnv: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<number>('MINIO_API_PORT', 9000);
    const minioUser = this.configService.get<string>(
      'MINIO_ROOT_USER',
      'dockus_admin',
    );
    const minioPassword = this.configService.get<string>(
      'MINIO_ROOT_PASSWORD',
      'dockus_secret_key',
    );
    const useSsl = this.toBoolean(
      this.configService.get<string | boolean>('MINIO_USE_SSL', false),
    );
    const protocol = useSsl ? 'https' : 'http';
    const endpointUrl =
      endpoint.startsWith('http://') || endpoint.startsWith('https://')
        ? endpoint
        : `${protocol}://${endpoint}:${port}`;

    this.s3Client = new S3Client({
      endpoint: endpointUrl,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: minioUser,
        secretAccessKey: minioPassword,
      },
    });

    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET_NAME',
      'dockus-storage',
    );
    this.signedUrlTtlSeconds = this.configService.get<number>(
      'STORAGE_SIGNED_URL_TTL_SECONDS',
      600,
    );
    this.bootstrapOnStartup = this.toBoolean(
      this.configService.get<string | boolean>(
        'STORAGE_BOOTSTRAP_ON_STARTUP',
        true,
      ),
    );
    this.nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
  }

  async onModuleInit(): Promise<void> {
    if (!this.bootstrapOnStartup || this.nodeEnv === 'test') {
      return;
    }

    await this.ensureBucketExists(this.bucketName);
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getSignedUrlTtlSeconds(): number {
    return this.signedUrlTtlSeconds;
  }

  async putObject(params: PutObjectParams): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async createDownloadSignedUrl(bucket: string, key: string): Promise<string> {
    return getSignedUrl(
      this.s3Client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: this.signedUrlTtlSeconds },
    );
  }

  async getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      return Buffer.alloc(0);
    }

    return this.readBodyAsBuffer(response.Body as unknown);
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: bucket,
        }),
      );
      return;
    } catch (error) {
      this.logger.warn(
        `Bucket "${bucket}" no encontrado. Intentando crearlo en bootstrap...`,
      );
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: bucket,
        }),
      );
      this.logger.log(`Bucket "${bucket}" creado correctamente.`);
      if (error) {
        return;
      }
    }
  }

  private toBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true';
  }

  private async readBodyAsBuffer(body: unknown): Promise<Buffer> {
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body as AsyncIterable<unknown>) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
          continue;
        }
        if (typeof chunk === 'string') {
          chunks.push(Buffer.from(chunk, 'utf8'));
          continue;
        }
        if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
          continue;
        }
        throw new Error('Chunk de stream no soportado al leer objeto MinIO.');
      }
      return Buffer.concat(chunks);
    }

    if (body instanceof Uint8Array) {
      return Buffer.from(body);
    }

    if (
      body &&
      typeof body === 'object' &&
      'transformToByteArray' in body &&
      typeof (body as { transformToByteArray: unknown })
        .transformToByteArray === 'function'
    ) {
      const array = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(array);
    }

    throw new Error('Tipo de stream no soportado al leer objeto desde MinIO.');
  }
}
