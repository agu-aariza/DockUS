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

## Dependencias Externas Clave
- **DockerHostService / DockerContainerService**: Crítico para aislar las ejecuciones (sandboxing).
- **BullMQ / Redis**: Para orquestar la cola de trabajos intensivos de evaluación en background sin bloquear la API.
- **Ollama / Bedrock**: Para revisiones avanzadas de código impulsadas por IA.
- **MinIO / Storage**: Para descargar el código del estudiante en el contenedor.

## Efectos Secundarios (Side Effects)
- Encola y procesa trabajos en Redis (Cola de Builds).
- Crea y destruye contenedores, volúmenes y redes temporales en Docker.
- Escribe logs masivos (Traces) en el almacenamiento y base de datos.
- Pide inferencia a LLMs.

## Estado / BBDD
- `BuildRun` (Progreso y resultados de la evaluación)
- Artefactos temporales en disco (Workspace extraction)

## Puntos de Entrada (Entrypoints)
- `BuilderController`
- `BuilderService` (Servicio fachada principal)
- `BuildRunProcessor` (Worker de BullMQ que procesa los trabajos de evaluación en background)
