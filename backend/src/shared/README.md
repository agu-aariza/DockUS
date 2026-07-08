## Propósito (TL;DR)
Módulo raíz que agrupa infraestructura compartida, configuración transversal, utilidades genéricas y ayudantes para toda la aplicación backend.

## Arquitectura de alto nivel
Módulo transversal (Shared Kernel). Actúa como capa base de la cual dependen los módulos de dominio.

## Límites Arquitectónicos (Boundaries) ⚠️
- Los módulos de dominio NUNCA deben depender directamente de librerías de infraestructura externa (AWS, Docker, MinIO, TypeORM). Siempre deben usar los wrappers e interfaces expuestos aquí.
- NINGÚN archivo dentro de `shared/` puede importar código de módulos de dominio (ej. `src/modules/...`).
- Solo exporta utilidades puras y de bajo nivel (Logger, Config, HTTP, Database).

## Flujo Principal de Datos
Los módulos de negocio inyectan las interfaces y servicios definidos aquí (como `ILlmGenerationService` o clientes HTTP/Docker) para ejecutar efectos colaterales sin acoplarse a su implementación específica.

## Stack Tecnológico Principal
- NestJS (Módulos globales)
- TypeORM (Configuración)
- Joi (Validación de entorno)
- ioredis / BullMQ (Caché y Colas)

## Mapa de Directorios (Tree)
- `config/`: Validación estricta de variables de entorno (`env.validation.ts`) y configuración base.
- `database/`: Utilidades genéricas de BBDD.
- `http/`: Constantes y códigos de estado HTTP comunes.
- `infrastructure/`: Wrappers e implementaciones de dependencias externas (AWS Bedrock, TypeORM, Redis, Docker, S3).
- `utils/`: Utilidades genéricas e independientes del dominio.
- `test-support/`: Helpers e infraestructura compartida para pruebas automatizadas.

## Variables de Entorno Globales
Consultar el esquema en `config/env.validation.ts`.

## Comandos clave
No tiene comandos propios de ejecución o construcción, se inicializa como parte de `AppModule`.
