# Configuración Compartida (Shared Config)

Este directorio centraliza la configuración transversal del backend de DockUS. Su objetivo es validar el entorno de ejecución antes de arrancar, construir opciones reutilizables para logging y Redis, y mantener un único punto de verdad para valores que consumen módulos muy distintos del sistema. Aquí vive la capa de configuración "fail-fast": si falta una variable crítica o llega con un formato inseguro, la aplicación debe fallar al inicio y no durante una operación de negocio.

## Archivos y Responsabilidades

### Validación de Entorno
- **`env.validation.ts`**: Define `envValidationSchema`, un esquema Joi amplio que valida las variables de entorno necesarias para backend, infraestructura y builder. Agrupa configuración de servidor (`NODE_ENV`, `PORT`, `FRONTEND_URL`), PostgreSQL, JWT y refresh tokens, seed inicial, Redis, MinIO/S3, AWS Bedrock y múltiples límites operativos del builder (timeouts, tamaño máximo de entrada, imágenes base, redes Docker, límites de CPU/memoria y ventanas de estabilidad). Además de exigir secretos JWT de al menos 32 caracteres, bloquea placeholders inseguros conocidos como `CHANGE_ME_JWT_SECRET`. También modela reglas condicionales, por ejemplo exigiendo `DOCKER_HOST` solo cuando `NODE_ENV` es `production`, y aporta defaults sensatos para desarrollo local y para la selección de modelos Bedrock.
- **`env.validation.spec.ts`**: Pruebas unitarias del esquema de entorno. Verifican que un entorno mínimo válido (`baseEnv`) se acepta correctamente, que se aplican defaults clave como `AWS_REGION`, los modelos Bedrock por defecto y límites del builder, y que los overrides explícitos de `AWS_REGION` y `BUILDER_BEDROCK_PLAN_MODEL_ID` se respetan sin romper la validación.

### Configuración de Servicios
- **`logger.config.ts`**: Expone `buildPinoHttpConfig(nodeEnv)`, una factoría mínima para la configuración del logger HTTP. En `production` devuelve nivel `info` sin transporte decorativo; en entornos no productivos activa nivel `debug` con `pino-pretty` y colores para facilitar la lectura en terminal durante desarrollo local.
- **`redis.config.ts`**: Reúne helpers reutilizables para Redis. `buildRedisConnectionOptions` extrae `REDIS_HOST`, `REDIS_PORT` y `REDIS_PASSWORD` desde `ConfigService` y devuelve un `RedisOptions` de `ioredis`. `buildBullConfig` reutiliza exactamente esa configuración y la empaqueta con la forma esperada por BullMQ, evitando duplicar la definición de conexión entre healthchecks, clientes transversales y colas de trabajo.
