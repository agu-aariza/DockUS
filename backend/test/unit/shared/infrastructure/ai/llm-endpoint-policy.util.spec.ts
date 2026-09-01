import {
  assertSafeLlmEndpoint,
  UnsafeLlmEndpointError,
} from '@app/shared/infrastructure/ai/llm-endpoint-policy.util';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));

import { lookup } from 'dns/promises';

const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

describe('assertSafeLlmEndpoint — ', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it('acepta un endpoint HTTPS de un host público', async () => {
    mockedLookup.mockResolvedValue([
      { address: '8.8.8.8', family: 4 },
    ] as never);

    await expect(
      assertSafeLlmEndpoint('openai', 'https://api.openai.com/v1'),
    ).resolves.toBeUndefined();
  });

  it('rechaza loopback por IP literal sin necesidad de resolver DNS', async () => {
    await expect(
      assertSafeLlmEndpoint('openai', 'https://127.0.0.1/v1'),
    ).rejects.toBeInstanceOf(UnsafeLlmEndpointError);
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('rechaza la IP de metadatos de nube (169.254.169.254)', async () => {
    await expect(
      assertSafeLlmEndpoint('azure', 'https://169.254.169.254/latest'),
    ).rejects.toThrow(/metadatos/);
  });

  it.each([
    '10.0.0.5',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
  ])('rechaza el rango privado/link-local %s', async (ip) => {
    await expect(
      assertSafeLlmEndpoint('gemini', `https://${ip}/v1`),
    ).rejects.toBeInstanceOf(UnsafeLlmEndpointError);
  });

  it('rechaza "localhost" explícitamente', async () => {
    await expect(
      assertSafeLlmEndpoint('anthropic', 'https://localhost/v1'),
    ).rejects.toBeInstanceOf(UnsafeLlmEndpointError);
  });

  it('rechaza un hostname público que resuelve por DNS a una IP privada (rebinding)', async () => {
    mockedLookup.mockResolvedValue([
      { address: '192.168.1.50', family: 4 },
    ] as never);

    await expect(
      assertSafeLlmEndpoint('openai', 'https://gateway.attacker.example/v1'),
    ).rejects.toBeInstanceOf(UnsafeLlmEndpointError);
  });

  it('exige HTTPS para proveedores cloud', async () => {
    await expect(
      assertSafeLlmEndpoint('openai', 'http://api.openai.com/v1'),
    ).rejects.toThrow(/HTTPS/);
  });

  it('permite a Ollama usar HTTP y apuntar a loopback/red privada', async () => {
    await expect(
      assertSafeLlmEndpoint('ollama', 'http://127.0.0.1:11434'),
    ).resolves.toBeUndefined();
    await expect(
      assertSafeLlmEndpoint('ollama', 'http://192.168.1.20:11434'),
    ).resolves.toBeUndefined();
  });

  it('no valida el endpoint de Bedrock (usa el SDK de AWS, no un endpoint HTTP libre)', async () => {
    await expect(
      assertSafeLlmEndpoint('bedrock', 'http://127.0.0.1/anything'),
    ).resolves.toBeUndefined();
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('rechaza una URL no parseable', async () => {
    await expect(
      assertSafeLlmEndpoint('openai', 'no-es-una-url'),
    ).rejects.toBeInstanceOf(UnsafeLlmEndpointError);
  });

  it('no falla si el hostname no resuelve (deja que la prueba de conexión lo reporte)', async () => {
    mockedLookup.mockRejectedValue(new Error('ENOTFOUND'));

    await expect(
      assertSafeLlmEndpoint('openai', 'https://no-existe.example/v1'),
    ).resolves.toBeUndefined();
  });
});
/**
 * Pruebas de la política que decide qué endpoint de LLM puede utilizarse.
 */
