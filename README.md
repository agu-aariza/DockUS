## Propósito (TL;DR)
Plataforma académica de evaluación automática de proyectos de programación que combina análisis estático, ejecución aislada en contenedores Docker y evaluación automatizada asistida por modelos de lenguaje (LLM).

## Arquitectura de alto nivel
Arquitectura de aplicación cliente-servidor distribuida. Consiste en una Single Page Application (SPA) para la interfaz de usuario, una API monolítica modular para la gestión del dominio, y workers asíncronos orientados a tareas pesadas de inferencia LLM y ejecución de Docker.

## Límites Arquitectónicos (Boundaries) ⚠️
El frontend NUNCA debe comunicarse directamente con la base de datos, colas de mensajes, MinIO o servicios LLM; todo acceso debe cruzar exclusivamente a través de los endpoints REST expuestos por la API.
El código de estudiante (entregas) NUNCA debe ejecutarse en el mismo proceso ni host que el servidor; debe aislarse estrictamente en un runtime de Docker (`runc` o preferiblemente `runsc` / gVisor) sin privilegios y sin conectividad saliente.
Los agentes y orquestadores asíncronos no deben evadir el motor TypeORM para actualizar estados globales de la aplicación de manera imprevista.

## Flujo Principal de Datos
1. Los docentes configuran proyectos, directrices de evaluación y repositorios con tests.
2. El estudiante sube una entrega en formato comprimido al sistema, que es persistido inmediatamente en el bucket S3 (MinIO).
3. Se encola un trabajo asíncrono (`BuildRun`) en BullMQ gestionado por Redis.
4. El worker backend planifica la estrategia usando LLM (Bedrock), infiere una receta Docker y ejecuta el código en un contenedor aislado.
5. Los resultados de los tests y logs son evaluados nuevamente por el LLM para detectar alucinaciones y emitir feedback pedagógico estructurado.
6. El informe consolidado y todo el estado se guarda en la base de datos (PostgreSQL), quedando disponible para consumo vía REST.

## Stack Tecnológico Principal
- **Frontend**: React 18, Vite 5, Tailwind CSS
- **Backend**: NestJS 11, TypeScript, TypeORM
- **BBDD y Estado**: PostgreSQL, Redis (BullMQ)
- **Almacenamiento**: MinIO (S3)
- **Motor de Evaluación**: AWS Bedrock Runtime (Claude), Docker Engine

## Mapa de Directorios (Tree)
- `backend/`: API NestJS principal, cola de ejecución de trabajos y orquestación del Builder.
- `frontend/`: SPA React que provee paneles separados para estudiantes, profesores y administradores.
- `docs/`: Documentación de arquitectura adicional y diagramas.
- `academic_proyects/`: Proyectos de demostración y suites de prueba usados para desarrollo.
- `docker-compose.yml`: Archivo de orquestación local de todos los servicios.

## Variables de Entorno Globales
`NODE_ENV`, `PORT`, `FRONTEND_URL`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `REDIS_HOST`, `MINIO_ENDPOINT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `JWT_SECRET`, credenciales LLM (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) y configuración de runtime Docker.

## Comandos clave
`docker compose --profile dev up --build` (levanta toda la infraestructura para desarrollo local)
`npm run start:dev` (inicia API backend con hot-reload en `backend/`)
`npm run dev` (inicia UI frontend con Vite en `frontend/`)
`graphify update .` (actualiza el grafo semántico tras realizar cambios arquitectónicos)
