/**
 * @fileoverview Configuración de logging estructurado con Pino.
 *
 * Contexto:
 * - Ajusta el nivel de logs según entorno de ejecución.
 * - Habilita formato legible en desarrollo y JSON limpio en producción.
 *
 * @module LoggerConfig
 */

export function buildPinoHttpConfig(nodeEnv: string | undefined) {
  const isProduction = nodeEnv === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  };
}
