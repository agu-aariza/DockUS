/**
 * @fileoverview Servicio de disyuntor/cortacircuitos (Circuit Breaker) para proveedores de LLM.
 *
 * @description
 * Evita la saturación de proveedores de IA ante errores 429 (Rate Limit), 5xx o fallos de red.
 * Almacena el contador de fallos y el estado de cuarentena en Redis para sincronizar todos los workers de evaluación.
 * Cae a modo Fail-Open (permite la llamada) si Redis no está disponible.
 *
 * @module LlmCircuitBreakerService
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientService } from '../cache/redis-client.service';

const KEY_PREFIX = 'llm:cb:';
const CACHE_TIMEOUT_MS = 200;

const DEFAULTS = {
  /** Fallos consecutivos en la ventana antes de abrir. */
  threshold: 5,
  /** Ventana del contador de fallos, en segundos. */
  windowSeconds: 60,
  /** Cuánto permanece abierto antes de volver a dejar pasar tráfico. */
  cooldownSeconds: 120,
} as const;

@Injectable()
export class LlmCircuitBreakerService {
  private readonly logger = new Logger(LlmCircuitBreakerService.name);
  private readonly threshold: number;
  private readonly windowSeconds: number;
  private readonly cooldownSeconds: number;

  constructor(
    private readonly redisClientService: RedisClientService,
    configService: ConfigService,
  ) {
    this.threshold = configService.get<number>(
      'LLM_CIRCUIT_BREAKER_THRESHOLD',
      DEFAULTS.threshold,
    );
    this.windowSeconds = configService.get<number>(
      'LLM_CIRCUIT_BREAKER_WINDOW_SECONDS',
      DEFAULTS.windowSeconds,
    );
    this.cooldownSeconds = configService.get<number>(
      'LLM_CIRCUIT_BREAKER_COOLDOWN_SECONDS',
      DEFAULTS.cooldownSeconds,
    );
  }

  /** Con umbral 0 el mecanismo queda inerte: interruptor sin desplegar. */
  get isEnabled(): boolean {
    return this.threshold > 0;
  }

  /**
   * `true` si el proveedor está en cuarentena y conviene no intentarlo.
   *
   * Es una recomendación, no una prohibición: el despachador la ignora cuando
   * no queda ningún otro candidato, porque intentar un proveedor dudoso siempre
   * es mejor que no intentar ninguno.
   */
  async isOpen(providerId: string): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    try {
      return await this.redisClientService.exists(
        this.openKey(providerId),
        CACHE_TIMEOUT_MS,
      );
    } catch {
      return false;
    }
  }

  /**
   * Registra un fallo atribuible al proveedor y abre el circuito si la racha
   * alcanza el umbral.
   *
   * Solo deben contarse fallos que digan algo sobre la **salud del proveedor**
   * —rechazo por tasa, 5xx, problemas de conexión—. Un contrato mal formado o
   * unas credenciales inválidas no son indisponibilidad y abrir por ellos
   * sacaría de servicio a un proveedor que responde perfectamente.
   */
  async recordFailure(providerId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const failures = await this.redisClientService.incrementWithTtl(
        this.failureKey(providerId),
        this.windowSeconds,
        CACHE_TIMEOUT_MS,
      );

      if (failures < this.threshold) {
        return;
      }

      await this.redisClientService.set(
        this.openKey(providerId),
        String(Date.now()),
        this.cooldownSeconds,
        CACHE_TIMEOUT_MS,
      );

      this.logger.warn(
        JSON.stringify({
          event: 'llm_circuit_opened',
          providerId,
          failures,
          cooldownSeconds: this.cooldownSeconds,
        }),
      );
    } catch {
      // Sin contador no hay protección, pero tampoco bloqueo.
    }
  }

  /**
   * Una llamada correcta salda la racha.
   *
   * No cierra el circuito abierto de forma explícita: ese vence por su propio
   * plazo. Lo que evita es que fallos dispersos a lo largo de horas se sumen
   * hasta abrirlo sin que haya habido nunca una indisponibilidad real.
   */
  async recordSuccess(providerId: string): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.redisClientService.del(
        this.failureKey(providerId),
        CACHE_TIMEOUT_MS,
      );
    } catch {
      // Irrelevante: el contador caduca solo.
    }
  }

  private failureKey(providerId: string): string {
    return `${KEY_PREFIX}fail:${providerId}`;
  }

  private openKey(providerId: string): string {
    return `${KEY_PREFIX}open:${providerId}`;
  }
}
