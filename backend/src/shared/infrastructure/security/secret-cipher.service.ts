/**
 * @fileoverview Cifrado simétrico de secretos en reposo (AES-256-GCM).
 *
 * Contexto:
 * - Las claves de API de los proveedores de LLM se guardan en Postgres. En
 *   claro serían legibles por cualquiera con acceso a un backup o a la réplica.
 * - La clave maestra sale de `LLM_CREDENTIALS_SECRET`. Si no está configurada,
 *   `isEnabled()` devuelve false y la capa de aplicación rechaza guardar
 *   secretos en vez de degradar a texto plano.
 *
 * @module SecretCipherService
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
/** Sal fija: la clave maestra ya es un secreto de alta entropía por validación. */
const KEY_SALT = 'dockus/llm-credentials/v1';
const ENVELOPE_PREFIX = 'v1';

@Injectable()
export class SecretCipherService {
  private readonly key: Buffer | null;

  constructor(configService: ConfigService) {
    const secret = configService.get<string>('LLM_CREDENTIALS_SECRET');
    this.key = secret ? scryptSync(secret, KEY_SALT, KEY_BYTES) : null;
  }

  isEnabled(): boolean {
    return this.key !== null;
  }

  /** Devuelve un sobre `v1:iv:tag:ciphertext` en base64url. */
  encrypt(plaintext: string): string {
    if (!this.key) {
      throw new Error(
        'LLM_CREDENTIALS_SECRET no está configurada: no se pueden cifrar secretos.',
      );
    }

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return [
      ENVELOPE_PREFIX,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  /**
   * Descifra un sobre generado por `encrypt`. Devuelve null si el sobre está
   * corrupto o si se cifró con otra clave maestra: un secreto ilegible debe
   * comportarse como "no configurado", no tumbar el run.
   */
  decrypt(envelope: string): string | null {
    if (!this.key) {
      return null;
    }

    const parts = envelope.split(':');
    if (parts.length !== 4 || parts[0] !== ENVELOPE_PREFIX) {
      return null;
    }

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(parts[1], 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));

      return Buffer.concat([
        decipher.update(Buffer.from(parts[3], 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
