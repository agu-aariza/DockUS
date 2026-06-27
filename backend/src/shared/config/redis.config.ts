import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

export function buildRedisConnectionOptions(
  configService: ConfigService,
): RedisOptions {
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD'),
  };
}

export function buildBullConfig(configService: ConfigService) {
  return {
    connection: buildRedisConnectionOptions(configService),
  };
}
