/**
 * @fileoverview Política de endpoints configurables de proveedores LLM.
 *
 * Contexto:
 * - `endpoint` en la configuración ADMIN de un proveedor (Azure/OpenAI/
 *   Anthropic/Gemini) es un string libre sin validación de host: una cuenta
 *   ADMIN comprometida podía redirigirlo a loopback/link-local/metadata/red
 *   privada y el adaptador HTTP enviaba igualmente la API key cifrada
 *   guardada a ese nuevo origen — SSRF más exfiltración de un secreto que el
 *   propio ADMIN no puede leer en claro.
 * - Ollama es la única excepción legítima: su propósito es apuntar a un host
 *   local o de red privada (`http://localhost:11434` es su valor por
 *   defecto), así que aquí se permite explícitamente en vez de intentar
 *   distinguir "localhost bueno" de "localhost malo" por heurística.
 *
 * Alcance de esta comprobación (documentado, no implícito): se aplica en
 * `BuilderLlmConfigService.saveConfigs`, cuando un ADMIN declara o cambia un
 * endpoint — no en cada llamada de inferencia. Cierra el vector de ataque
 * real ("guardar un endpoint malicioso y probarlo"), pero no revalida en
 * caliente si un endpoint ya guardado y legítimo cambia de IP después por
 * DNS rebinding entre el guardado y una llamada posterior; eso requeriría
 * validar la IP resuelta en el propio cliente HTTP de cada proveedor, fuera
 * del alcance de esta tanda (ver plan_de_accion.md, P1.1).
 *
 * @module llm-endpoint-policy
 */

import { lookup } from 'dns/promises';
import type { LlmProviderId } from './llm.types';

export class UnsafeLlmEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeLlmEndpointError';
  }
}

/** Ollama existe precisamente para apuntar a infraestructura local/privada. */
const PROVIDERS_ALLOWING_PRIVATE_NETWORKS: ReadonlySet<LlmProviderId> = new Set(
  ['ollama'],
);

/** Bedrock usa el SDK de AWS (región + IAM), no un `endpoint` HTTP libre. */
const PROVIDERS_WITHOUT_CONFIGURABLE_ENDPOINT: ReadonlySet<LlmProviderId> =
  new Set(['bedrock']);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

/**
 * Valida (y, si hace falta, resuelve por DNS) el host de un endpoint antes de
 * guardarlo. Lanza `UnsafeLlmEndpointError` si el destino es loopback,
 * link-local, de red privada o la IP de metadatos de nube — salvo que el
 * proveedor esté en la lista que legítimamente apunta a red privada.
 */
export async function assertSafeLlmEndpoint(
  providerId: LlmProviderId,
  endpoint: string,
): Promise<void> {
  if (PROVIDERS_WITHOUT_CONFIGURABLE_ENDPOINT.has(providerId)) {
    return;
  }

  const allowsPrivateNetworks =
    PROVIDERS_ALLOWING_PRIVATE_NETWORKS.has(providerId);

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} no es una URL válida.`,
    );
  }

  if (url.protocol !== 'https:' && !allowsPrivateNetworks) {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} debe usar HTTPS.`,
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} debe usar http o https.`,
    );
  }

  if (allowsPrivateNetworks) {
    return;
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} no puede apuntar a "${hostname}".`,
    );
  }

  if (isUnsafeIpLiteral(hostname)) {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} no puede apuntar a una IP privada, loopback o de metadatos ("${hostname}").`,
    );
  }

  // El hostname no es él mismo una IP insegura, pero puede resolver a una:
  // sin esto, "endpoint-del-atacante.example.com" apuntando por DNS a
  // 169.254.169.254 pasaría el filtro de arriba sin problema.
  let addresses: string[];
  try {
    addresses = (await lookup(hostname, { all: true })).map((a) => a.address);
  } catch {
    // No se pudo resolver: no es un endpoint invocable, pero tampoco es un
    // riesgo de SSRF por sí mismo. Se deja pasar; la prueba de conexión ADMIN
    // (o la primera llamada real) fallará con un error de red normal.
    return;
  }

  const unsafeAddress = addresses.find((address) => isUnsafeIpLiteral(address));
  if (unsafeAddress) {
    throw new UnsafeLlmEndpointError(
      `El endpoint de ${providerId} ("${hostname}") resuelve a una dirección privada, loopback o de metadatos ("${unsafeAddress}").`,
    );
  }
}

function isUnsafeIpLiteral(address: string): boolean {
  return isUnsafeIpv4(address) || isUnsafeIpv6(address);
}

function isUnsafeIpv4(address: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
  if (!match) return false;

  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  const [a, b] = octets;

  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local + metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 0) return true; // "this network"
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT, usado por metadata en algunas nubes

  return false;
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized === '::') return true;
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (fc00::/7)
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6: reutiliza la misma comprobación sobre la parte IPv4.
    return isUnsafeIpv4(normalized.replace('::ffff:', ''));
  }

  return false;
}
