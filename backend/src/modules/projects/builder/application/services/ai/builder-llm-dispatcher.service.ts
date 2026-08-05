/**
 * @fileoverview Despacho de una llamada de inferencia con conmutación entre
 * proveedores.
 *
 * Contexto:
 * - El sistema ya soportaba seis proveedores (Bedrock, OpenAI, Azure, Ollama,
 * Anthropic y Gemini) con asignación por rol, pero esa capacidad **no se
 * aprovechaba ante un fallo** la etapa se resolvía contra el proveedor
 * asignado y, si ese empezaba a rechazar por tasa, el run fallaba con otros
 * cinco proveedores configurados y ociosos.
 * - Este servicio no cambia quién sirve cada rol. Intenta primero el proveedor
 * asignado por el docente y solo recurre a los demás cuando el titular está
 * indisponible.
 *
 * Vive en `application/services/ai/` porque necesita `BuilderLlmConfigService`
 * para resolver la cadena — una dependencia de infraestructura del propio
 * módulo builder, no un tipo puro de dominio.
 *
 * @module BuilderLlmDispatcherService
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { LlmCircuitBreakerService } from '../../../../../../shared/infrastructure/ai/llm-circuit-breaker.service';
import type { ILlmGenerationService } from '../../../../../../shared/infrastructure/ai/llm-generation.token';
import { LLM_GENERATION_SERVICE } from '../../../../../../shared/infrastructure/ai/llm-generation.token';
import { LlmRequestError } from '../../../../../../shared/infrastructure/ai/llm-request.util';
import type {
  BuilderLlmPromptStage,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmModelProfile,
  LlmProviderCredentials,
} from '../../../../../../shared/infrastructure/ai/llm.types';
import { BuilderLlmConfigService } from '../config/builder-llm-config.service';

/**
 * Construye la petición concreta para un candidato. El prompt ya está compuesto
 * por quien llama; lo único que cambia entre candidatos es el perfil y las
 * credenciales.
 */
export type StageRequestFactory = (
  profile: LlmModelProfile,
  credentials: LlmProviderCredentials | null,
) => LlmGenerateRequest;

export interface DispatchOutcome {
  result: LlmGenerateResult;
  /** Perfil que realmente atendió la llamada; puede no ser el asignado al rol. */
  profile: LlmModelProfile;
  /** Proveedor titular, presente solo si hubo conmutación. */
  fellBackFrom: string | null;
}

/**
 * Códigos que indican indisponibilidad del proveedor y justifican probar otro.
 *
 * Deliberadamente **no** incluye `invalid_contract` ni los errores de
 * autenticación: una respuesta mal formada o unas credenciales caducadas no
 * mejoran cambiando de proveedor —la segunda las tendría igual de mal
 * configuradas— y conmutar por ellos escondería un problema de configuración
 * detrás de una evaluación hecha con otro modelo.
 */
const PROVIDER_UNAVAILABLE_CODES = new Set(['throttling', 'connectivity']);

function isProviderUnavailable(error: unknown): boolean {
  if (!(error instanceof LlmRequestError)) {
    return false;
  }
  if (PROVIDER_UNAVAILABLE_CODES.has(error.code)) {
    return true;
  }
  return (
    error.code === 'http_error' &&
    typeof error.httpStatus === 'number' &&
    error.httpStatus >= 500
  );
}

@Injectable()
export class BuilderLlmDispatcherService {
  private readonly logger = new Logger(BuilderLlmDispatcherService.name);

  constructor(
    @Inject(LLM_GENERATION_SERVICE)
    private readonly llmService: ILlmGenerationService,
    private readonly llmConfigService: BuilderLlmConfigService,
    private readonly circuitBreaker: LlmCircuitBreakerService,
  ) {}

  /**
   * Ejecuta la etapa contra el primer proveedor disponible de su cadena.
   *
   * `onAttempt` se invoca antes de cada intento con el perfil que va a usarse,
   * para que quien llama pueda registrar la instantánea del prompt con el
   * modelo real y no con el que se pretendía usar.
   *
   * Si se agotan los candidatos se propaga el **último** error, que es el más
   * informativo sobre por qué no se pudo evaluar.
   */
  async dispatch(
    stage: BuilderLlmPromptStage,
    buildRequest: StageRequestFactory,
    onAttempt?: (profile: LlmModelProfile) => void | Promise<void>,
  ): Promise<DispatchOutcome> {
    const candidates =
      await this.llmConfigService.resolveStageCandidates(stage);
    const primaryProviderId = candidates[0]?.profile.providerId ?? null;

    // Un proveedor en cuarentena se descarta, pero solo mientras quede alguna
    // alternativa: si todos están abiertos se intenta igualmente el titular. No
    // intentar nada garantiza el fallo; intentar uno dudoso al menos puede
    // funcionar, y es además lo que permite que el circuito se recupere.
    const viable: typeof candidates = [];
    for (const candidate of candidates) {
      if (!(await this.circuitBreaker.isOpen(candidate.profile.providerId))) {
        viable.push(candidate);
      }
    }
    const attempts = viable.length > 0 ? viable : candidates.slice(0, 1);

    let lastError: unknown;

    for (const candidate of attempts) {
      const { profile, credentials } = candidate;
      await onAttempt?.(profile);

      try {
        const result = await this.llmService.generate(
          buildRequest(profile, credentials),
        );
        await this.circuitBreaker.recordSuccess(profile.providerId);

        if (!candidate.isPrimary) {
          this.logger.warn(
            JSON.stringify({
              event: 'llm_provider_failover',
              stage,
              from: primaryProviderId,
              to: profile.providerId,
              modelId: profile.modelId,
            }),
          );
        }

        return {
          result,
          profile,
          fellBackFrom: candidate.isPrimary ? null : primaryProviderId,
        };
      } catch (error) {
        lastError = error;

        if (!isProviderUnavailable(error)) {
          // Un error que no es de disponibilidad se propaga tal cual: cambiar
          // de proveedor no lo arreglaría y enmascararía la causa real.
          throw error;
        }

        await this.circuitBreaker.recordFailure(profile.providerId);
        this.logger.warn(
          JSON.stringify({
            event: 'llm_provider_unavailable',
            stage,
            providerId: profile.providerId,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }

    throw lastError;
  }
}
