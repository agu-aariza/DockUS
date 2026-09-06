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
  GetBucketLifecycleConfigurationCommand,
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
import { toBoolean } from '../../utils/to-boolean.util';

/**
 * Prefijo bajo el que el motor de evaluación guarda su evidencia
 * (`evidence.service.ts`: `runs/<buildRunId>/<tipo>/...`). Es el único de los
 * tres prefijos del bucket que puede caducar: `deliveries/` y `projects/`
 * guardan entregas y suites docentes, cuyo borrado es una decisión académica.
 */
const EVIDENCE_PREFIX = 'runs/';

interface PutObjectParams {
  bucket: string;
  key: string;
  /**
   * Acepta un flujo además de un `Buffer`: las subidas grandes
   * llegan como fichero en disco y transmitirlas por trozos evita cargarlas enteras en memoria.
   */
  body: Buffer | Readable;
  contentType: string;
  /**
   * Obligatorio cuando `body` es un flujo. El SDK de S3 no puede deducir la
   * longitud de un `Readable` y, sin ella, lo acumula en memoria para calcularla
   * —anulando por completo el motivo de usar un flujo—. Con `Buffer` se omite:
   * el SDK ya conoce el tamaño.
   */
  contentLength?: number;
}

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly signedUrlTtlSeconds: number;
  /** Días tras los que expira la evidencia generada. 0 desactiva la regla. */
  private readonly evidenceRetentionDays: number;
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
      'educodeai_admin',
    );
    const minioPassword = this.configService.get<string>(
      'MINIO_ROOT_PASSWORD',
      'educodeai_secret_key',
    );
    const useSsl = toBoolean(
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
      'educodeai-storage',
    );
    this.signedUrlTtlSeconds = this.configService.get<number>(
      'STORAGE_SIGNED_URL_TTL_SECONDS',
      600,
    );
    this.evidenceRetentionDays = configService.get<number>(
      'STORAGE_EVIDENCE_RETENTION_DAYS',
      90,
    );
    this.bootstrapOnStartup = toBoolean(
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
    await this.verifyRetentionPolicy(this.bucketName);
  }

  /**
   * Comprueba —**sin escribirla**— que la regla de caducidad de evidencia esté
   * puesta en el bucket.
   *
   * Por qué solo se comprueba y no se aplica:
   * - La versión de MinIO desplegada (`RELEASE.2024-08-29`) rechaza
   * `PutBucketLifecycleConfiguration` porque exige el encabezado
   * `Content-Md5`, que el SDK de AWS v3 no envía. Se probó también con
   * `requestChecksumCalculation: 'WHEN_REQUIRED'`, sin efecto. El cliente
   * oficial `mc` sí lo envía, de modo que la regla se fija **fuera de la
   * aplicación**, como paso de despliegue:
   *
   * ```sh
   * mc alias set educodeai http://<host>:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
   * mc ilm rule add educodeai/<bucket> --prefix "runs/" --expire-days 90
   * ```
   *
   * - `GetBucketLifecycleConfiguration` **sí funciona** contra esta versión
   * (verificado), y es lo que permite conservar aquí una red de seguridad.
   *
   * Por qué la comprobación merece la pena:
   * - La versión anterior de este método *aparentaba* aplicar la política y
   * registraba «política aplicada» mientras filtraba por un prefijo
   * (`evidence/`) que **no existe en el bucket** la evidencia vive bajo
   * `runs/`. Dos fallos superpuestos que se tapaban entre sí. Un aviso
   * explícito al arrancar es justo lo que habría delatado el segundo.
   *
   * Nunca impide arrancar: sin regla el sistema funciona igual —es el estado
   * previo— pero el disco crece sin límite, y eso debe verse.
   */
  private async verifyRetentionPolicy(bucket: string): Promise<void> {
    if (this.evidenceRetentionDays <= 0) {
      return;
    }

    const warn = (motivo: string): void => {
      this.logger.warn(
        JSON.stringify({
          event: 'storage_retention_policy_missing',
          bucket,
          prefix: EVIDENCE_PREFIX,
          motivo,
          accion: `mc ilm rule add <alias>/${bucket} --prefix "${EVIDENCE_PREFIX}" --expire-days ${this.evidenceRetentionDays}`,
        }),
      );
    };

    try {
      const config = await this.s3Client.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
      );

      // Basta con que alguna regla activa cubra el prefijo de evidencia. No se
      // exige que los días coincidan con `STORAGE_EVIDENCE_RETENTION_DAYS`: la
      // regla la gobierna quien opera el despliegue y puede tener motivos para
      // fijar otro plazo; lo que no puede es faltar.
      const cubierta = (config.Rules ?? []).some(
        (rule) =>
          rule.Status === 'Enabled' &&
          rule.Expiration?.Days !== undefined &&
          (rule.Filter?.Prefix ?? '') === EVIDENCE_PREFIX,
      );

      if (cubierta) {
        this.logger.log(
          `Politica de retencion verificada en ${bucket} para el prefijo "${EVIDENCE_PREFIX}".`,
        );
        return;
      }

      warn(
        'existe configuracion de ciclo de vida pero ninguna regla activa cubre el prefijo de evidencia',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // MinIO devuelve NoSuchLifecycleConfiguration cuando no hay ninguna regla:
      // es el caso normal de un despliegue nuevo, no una avería.
      warn(
        message.includes('NoSuchLifecycleConfiguration') ||
          message.includes('does not exist')
          ? 'el bucket no tiene ninguna regla de ciclo de vida'
          : `no se pudo consultar la configuracion: ${message}`,
      );
    }
  }

  getBucketName(): string {
    return this.bucketName;
  }

  getSignedUrlTtlSeconds(): number {
    return this.signedUrlTtlSeconds;
  }

  /**
   * Comprueba conectividad y disponibilidad del bucket de almacenamiento MinIO para la sonda de readiness.
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; latencyMs: number; info?: string }> {
    const startedAt = Date.now();
    try {
      await this.s3Client.send(
        new HeadBucketCommand({
          Bucket: this.bucketName,
        }),
      );
      return {
        status: 'up',
        latencyMs: Date.now() - startedAt,
        info: `Bucket "${this.bucketName}" accesible en MinIO.`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Healthcheck de MinIO falló: ${message}`);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        info: message,
      };
    }
  }

  async putObject(params: PutObjectParams): Promise<void> {
    if (params.body instanceof Readable && params.contentLength === undefined) {
      // Fallar aquí y no dejarlo pasar: sin `ContentLength` el SDK bufferiza el
      // flujo entero para deducirla, de modo que el fallo sería un consumo de
      // memoria silencioso —justo lo que este parámetro existe para evitar—
      // en lugar de un error visible.
      throw new Error(
        'putObject requiere contentLength cuando el cuerpo es un flujo.',
      );
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: params.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
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
      typeof body.transformToByteArray === 'function'
    ) {
      const array = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      return Buffer.from(array);
    }

    throw new Error('Tipo de stream no soportado al leer objeto desde MinIO.');
  }
}
