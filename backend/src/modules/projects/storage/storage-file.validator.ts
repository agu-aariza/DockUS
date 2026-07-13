/**
 * @fileoverview Validador de extensiones de archivo para ParseFilePipe.
 *
 * Contexto:
 * - NestJS FileTypeValidator compara contra mimetype, que no es fiable para
 *   extensiones compuestas como .tar.gz o para archivos sin mimetype estandar.
 * - Este validador inspecciona el nombre original del archivo de forma robusta.
 *
 * @module FileExtensionValidator
 */

import { FileValidator } from '@nestjs/common';

export interface FileExtensionValidationOptions {
  allowedExtensions: string[];
}

interface FileWithOriginalName {
  originalname?: string;
}

export class FileExtensionValidator extends FileValidator<FileExtensionValidationOptions> {
  buildErrorMessage(): string {
    return `Extension no permitida. Use ${this.validationOptions.allowedExtensions.join(', ')}.`;
  }

  isValid(file?: unknown): boolean {
    const originalname = (file as FileWithOriginalName | undefined)
      ?.originalname;
    if (typeof originalname !== 'string') {
      return false;
    }

    const normalizedName = originalname.trim().toLowerCase();
    const extension = normalizedName.endsWith('.tar.gz')
      ? '.tar.gz'
      : `.${normalizedName.split('.').pop()}`;

    return this.validationOptions.allowedExtensions.includes(extension);
  }
}
