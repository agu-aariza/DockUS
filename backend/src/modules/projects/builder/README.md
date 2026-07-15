## Responsabilidad del Módulo
El motor principal de DockUS encargado de orquestar, aislar y evaluar el código fuente de los estudiantes. Ejecuta scripts, pruebas unitarias, compilación y genera reportes detallados y calificaciones basadas en las reglas definidas en cada proyecto.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- No administra los metadatos CRUD de los proyectos.
- No decide si un estudiante tiene permisos para entregar.
- No interactúa directamente con los usuarios finales; es un motor de backend invocado por eventos o controladores superiores.

## Conceptos Clave (Glosario)
- **Builder**: El sistema completo de compilación y evaluación.
- **Trace**: Registro cronológico estructurado de los eventos ocurridos durante una ejecución (stdout, errores, evaluaciones AI).
- **Run / BuildRun**: Una instancia única de evaluación de una entrega específica.
- **Recipe (Receta)**: El conjunto de instrucciones (comandos bash, imagen base, timeouts) que dictan cómo evaluar el proyecto.
- **Evaluation Contract**: El formato estandarizado que el Builder usa para puntuar la entrega y generar feedback.
- **Rol de IA**: `planner`, `eval`, `quality` o `chatbot`. Cada rol lo sirve un único proveedor, configurable desde la pestaña "Modelos de IA" (`LlmConfiguration`). Sin configuración, la etapa cae al modelo de Bedrock definido por variables de entorno.
- **Stage Token Usage**: Consumo (`inputTokens`/`outputTokens`) de una llamada al LLM junto al proveedor y modelo que la sirvieron. El coste de un run es la suma etapa a etapa con la tarifa de *su* proveedor: no se puede derivar de los tokens totales.

## Dependencias Externas Clave
- **DockerHostService / DockerContainerService**: Crítico para aislar las ejecuciones (sandboxing).
- **BullMQ / Redis**: Para orquestar la cola de trabajos intensivos de evaluación en background sin bloquear la API.
- **`LlmGenerationRouter` (shared/infrastructure/ai)**: Toda la inferencia pasa por él; el proveedor concreto (Bedrock, OpenAI, Azure, Anthropic, Gemini, Ollama) lo decide `BuilderLlmConfigService` según el rol de la etapa.
- **MinIO / Storage**: Para descargar el código del estudiante en el contenedor.

## Efectos Secundarios (Side Effects)
- Encola y procesa trabajos en Redis (Cola de Builds).
- Crea y destruye contenedores, volúmenes y redes temporales en Docker.
- Escribe logs masivos (Traces) en el almacenamiento y base de datos.
- Pide inferencia a LLMs.

## Estado / BBDD
- `BuildRun` (Progreso y resultados de la evaluación, incluidos `inputTokens`, `outputTokens` y `executionCostUsd`)
- `LlmConfiguration` (Proveedores de IA: modelo, tarifas, roles y API key **cifrada** con `SecretCipherService`; la clave nunca se devuelve al cliente)
- Artefactos temporales en disco (Workspace extraction)

## Puntos de Entrada (Entrypoints)
- `BuilderController` (incluye `GET/POST /builder/llm-configs` y `POST /builder/llm-configs/:providerId/test`, solo ADMIN)
- `BuilderLlmConfigService` (`infrastructure/config/`): resuelve perfil + credenciales de cada etapa y las tarifas; cachea la tabla en memoria e invalida al guardar
- `BuilderService` (Servicio fachada principal)
- `BuildRunProcessor` (Worker de BullMQ que procesa los trabajos de evaluación en background)
