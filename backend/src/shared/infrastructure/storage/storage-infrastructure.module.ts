/**
 * @fileoverview Módulo de infraestructura para almacenamiento de objetos.
 *
 * Contexto:
 * - Expone un cliente MinIO/S3 reutilizable para dominios de negocio.
 * - Aísla detalles técnicos de conexión y signed URLs.
 *
 * @module StorageInfrastructureModule
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MinioStorageService } from './minio-storage.service';

@Module({
  imports: [ConfigModule],
  providers: [MinioStorageService],
  exports: [MinioStorageService],
})
export class StorageInfrastructureModule {}
