/**
 * @fileoverview Cortacircuitos por proveedor de LLM.
 *
 * Contexto (ESC-ALTO-02):
 * - Cuando un proveedor empieza a rechazar por tasa o a devolver 5xx, seguir
 *   enviándole peticiones no solo falla: **empeora el rechazo**, porque cada
 *   intento cuenta contra la misma cuota que ya está agotada. El cortacircuitos
 *   corta la racha y deja que el despachador pruebe otro proveedor configurado.
 *
 * Por qué el estado vive en Redis y no en memoria del proceso:
 * - Con varios workers, un cortacircuitos local obliga a **cada** proceso a
 *   descubrir por su cuenta que el proveedor está caído. Con la concurrencia por
 *   defecto son decenas de llamadas desperdiciadas antes de que todos abran, y
 *   precisamente cuando el problema es un límite de tasa esas llamadas son las
 *   que lo agravan. Compartir el estado hace que el primero que lo detecta
 *   proteja a los demás.
 * - El sobrecoste es despreciable: una o dos operaciones de Redis frente a una
 *   llamada de inferencia que dura segundos.
 *
 * Modo de fallo: **abrir el paso** (nunca el circuito). Si Redis no responde se
 * considera el proveedor disponible y se intenta la llamada. Un fallo de la
 * caché no puede dejar sin evaluar a nadie; como mucho se pierde la protección.
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
