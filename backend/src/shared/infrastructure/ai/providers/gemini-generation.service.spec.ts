import { GeminiGenerationService } from './gemini-generation.service';
import { postJson } from '../llm-request.util';

jest.mock('../llm-request.util', () => {
  const actual = jest.requireActual('../llm-request.util');
  return {
    ...actual,
    postJson: jest.fn(),
  };
});

const mockedPostJson = postJson as jest.MockedFunction<typeof postJson>;

describe('GeminiGenerationService — MED-01: la clave de API no viaja en la URL', () => {
  const service = new GeminiGenerationService();

  const request = {
    stage: 'evaluation',
    promptId: 'eval',
    prompt: 'Evalúa esto.',
    profile: {
      modelId: 'gemini-2.0-flash',
      maxTokens: 100,
      temperature: 0.2,
      topP: 0.9,
      stopSequences: [],
      timeoutMs: 5000,
      region: 'global',
      profileVersion: 'test/v1',
    },
    credentials: {
      apiKey: 'CLAVE-VIVA-NO-DEBE-APARECER-EN-LA-URL',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    },
  } as any;

  beforeEach(() => {
    mockedPostJson.mockReset();
    mockedPostJson.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'respuesta' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
  });

  it('envía la clave en la cabecera x-goog-api-key', async () => {
    await service.generate(request);

    const [, , headers] = mockedPostJson.mock.calls[0];
    expect(headers).toEqual(
      expect.objectContaining({
        'x-goog-api-key': 'CLAVE-VIVA-NO-DEBE-APARECER-EN-LA-URL',
      }),
    );
  });

  it('no incluye la clave ni un parámetro key en la URL', async () => {
    await service.generate(request);

    const [, url] = mockedPostJson.mock.calls[0];
    // Es la propiedad que importa: una URL acaba en los logs de acceso de
    // cualquier intermediario y en el campo http.url de las trazas.
    expect(url).not.toContain('CLAVE-VIVA-NO-DEBE-APARECER-EN-LA-URL');
    expect(url).not.toContain('key=');
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    );
  });

  it('sigue devolviendo texto y uso de tokens', async () => {
    const result = await service.generate(request);

    expect(result.text).toBe('respuesta');
    expect(result.usage).toEqual(
      expect.objectContaining({ inputTokens: 10, outputTokens: 5 }),
    );
  });

  it('AIP-012: un token count negativo o fraccionario del proveedor se trata como desconocido (null), no como el valor recibido', async () => {
    mockedPostJson.mockResolvedValue({
      candidates: [{ content: { parts: [{ text: 'respuesta' }] } }],
      usageMetadata: { promptTokenCount: -5, candidatesTokenCount: 2.7 },
    });

    const result = await service.generate(request);

    expect(result.usage).toEqual(
      expect.objectContaining({ inputTokens: null, outputTokens: null }),
    );
  });
});
