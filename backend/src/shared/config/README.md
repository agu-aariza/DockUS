## Propósito de la carpeta
Centraliza la configuración transversal del backend, la validación estricta de variables de entorno al arranque y la construcción de opciones de conexión para herramientas base (Redis, Logger).

## Límites y Reglas Estrictas
- La aplicación DEBE fallar ("fail-fast") en el arranque si falta una variable de entorno crítica.
- Las variables se validan y parsean en `env.validation.ts` usando Joi.
- Las contraseñas y secretos no deben tener valores por defecto de desarrollo en entornos de producción (e.g. validación contra placeholders como `CHANGE_ME`).
- No debe contener lógica de dominio ni consultas a bases de datos.

## Anti-Patrones y Gotchas ⚠️
- Usar `process.env.VARIABLE` a lo largo del código. Siempre se debe usar `ConfigService` de NestJS con el esquema validado aquí.
- Duplicar lógica de conexión de Redis. Usar `buildRedisConnectionOptions` o `buildBullConfig` provistos en `redis.config.ts`.
- Silenciar el logger en desarrollo sin revisar `logger.config.ts`.

## Dependencias de Contexto Asumidas
- Se asume que `ConfigModule` de NestJS cargará y validará esto antes de inicializar cualquier otro módulo (TypeORM, BullMQ, etc).

## Inputs / Outputs Esperados
- Valida entradas puras (`process.env`).
- Retorna esquemas Joi, objetos `RedisOptions` y `Options` (BullMQ).

## Ejemplo de uso
```typescript
import { buildBullConfig } from 'src/shared/config/redis.config';
import { ConfigService } from '@nestjs/config';

// En un módulo de NestJS:
BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => buildBullConfig(configService),
});
```

## Formato de Archivos
- `*.config.ts`: Exporta funciones fábricas `build*Config(...)` que reciben `ConfigService`.
- `env.validation.ts`: Exporta un esquema Joi global.
- Pruebas en `*.spec.ts`.
