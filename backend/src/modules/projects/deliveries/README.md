## Responsabilidad del Módulo
Manejar las entregas (deliveries) que realizan los estudiantes en respuesta a un proyecto asignado. Coordina la carga de archivos, la invocación de la evaluación asíncrona y la exposición del estado final.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- No evalúa el código. Llama al Builder para que lo haga.
- No decide la calificación final del curso, solo la de esa entrega específica.
- No crea proyectos ni asignaciones.

## Conceptos Clave (Glosario)
- **Delivery**: Un intento de un estudiante para resolver un proyecto. Incluye un ID de almacenamiento temporal, metadatos, y vinculación al estudiante y proyecto.

## Dependencias Externas Clave
- `Builder Module`: Para iniciar ejecuciones (`BuildRun`) sobre el código entregado.
- `Storage Module`: Para guardar el ZIP o tarball subido por el estudiante.
- Entidad `Project` y `User`.

## Efectos Secundarios (Side Effects)
- Almacena archivos en S3/MinIO.
- Encola tareas de evaluación en Redis.
- Modifica la tabla de entregas (`deliveries`).

## Estado / BBDD
- Entidad `Delivery`.

## Puntos de Entrada (Entrypoints)
- `DeliveriesController` (Crear entrega, listar historial).
- `DeliveriesService` (Orquestación de la creación, almacenamiento y despacho al builder).
