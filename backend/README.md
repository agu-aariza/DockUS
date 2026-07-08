## Propósito (TL;DR)
API REST que gestiona el dominio académico (usuarios, grupos, entregas) y orquesta el pipeline de evaluación asíncrona mediante análisis estático, LLM (AWS Bedrock) y ejecución aislada en Docker.

## Arquitectura de alto nivel
Monolito modular construido con NestJS que expone controladores HTTP (REST) y procesa flujos pesados a través de colas de trabajos asíncronos (`BullMQ`) apoyadas por servicios de infraestructura dedicados (S3, Redis, Docker CLI).

## Límites Arquitectónicos (Boundaries) ⚠️
Los controladores HTTP NUNCA deben contener lógica de negocio ni orquestar operaciones directas con Docker, MinIO o LLM. Todo debe pasar por los servicios del dominio (ej. `BuilderRunCommandsService`).
La API de backend NUNCA debe ejecutar el código de estudiante en su propio espacio de memoria. Debe hacerlo estricta y delegadamente bajo el aislamiento de Docker (`--read-only`, `--cap-drop ALL`, `--network none`).
Los prompts y respuestas puras del LLM NUNCA deben exponerse directamente al rol `STUDENT`; solo el informe final consolidado.

## Flujo Principal de Datos
1. Las peticiones REST entran validadas y pasan por filtros de autenticación y RBAC (JWT).
2. Para operaciones síncronas, TypeORM lee/escribe en la base de datos PostgreSQL, mientras que MinIO almacena/entrega binarios de los estudiantes.
3. Para la evaluación, los controladores depositan un job en Redis (`BullMQ`).
4. El worker recoge el job, planifica la ejecución con el LLM, materializa una receta Docker y arranca los contenedores.
5. Se extrae evidencia, se genera un análisis pedagógico a través del LLM, y se consolida un informe final.
6. El pipeline actualiza el estado y persiste trazas generadas en MinIO, disponibles luego vía API.

## Stack Tecnológico Principal
NestJS 11, TypeScript 5, TypeORM, PostgreSQL, BullMQ, Redis, MinIO (S3 SDK), Docker CLI, AWS Bedrock Runtime.

## Mapa de Directorios (Tree)
- `src/modules/auth/`: Gestión de JWT, refresco y hashing.
- `src/modules/users/` y `src/modules/academic/`: Control de roles y asignación de cohortes.
- `src/modules/projects/`: Core de dominio (proyectos, asignaciones, entregas) y pipeline de orquestación (`builder/`).
- `src/shared/config/`: Esquemas de validación de variables de entorno y logger (`nestjs-pino`).
- `src/shared/infrastructure/`: Clientes y abstracciones (Base de datos, Cache, S3, cliente AI y orquestación Docker pura).

## Variables de Entorno Globales
`DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_HOST`, `MINIO_ENDPOINT`, `MINIO_BUCKET_NAME`, `JWT_SECRET`, configuración del LLM (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `BUILDER_BEDROCK_*_MODEL_ID`), configuración de seguridad del builder (`BUILDER_DOCKER_RUNTIME`, `BUILDER_BATCH_CPU_LIMIT`).

## Comandos clave
`npm run start:dev` (inicia el servidor en modo desarrollo / hot-reload)
`npm run build` (compila la aplicación a JavaScript)
`npm test -- --runInBand` (ejecuta tests unitarios forzando de manera secuencial)
`npm run typecheck` (verifica tipado estricto en el proyecto sin emitir bundle)
