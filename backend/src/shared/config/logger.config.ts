export function buildPinoHttpConfig(nodeEnv: string | undefined) {
  const isProduction = nodeEnv === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    transport: isProduction
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true } },
  };
}
