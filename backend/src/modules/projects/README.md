## Responsabilidad del Módulo
Gestionar el ciclo de vida completo de los proyectos de programación, sirviendo como núcleo (hub) que orquesta la creación, evaluación (builder), asignación a estudiantes (assignments) y recepción de entregas (deliveries).

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- No ejecuta código directamente (eso lo delega al Builder y la infraestructura Docker).
- No realiza cálculos de calificaciones finales (eso depende de `ProjectGradebookService`).
- No maneja la persistencia binaria de los archivos de estudiantes (usa el módulo `Storage`).

## Conceptos Clave (Glosario)
- **Project**: Entidad raíz que representa una tarea académica o reto de programación.
- **Delivery**: Entrega específica realizada por un estudiante para un proyecto.
- **Assignment**: Vínculo entre un grupo de estudiantes y un proyecto.
- **Gradebook**: Resumen del progreso y calificaciones de los estudiantes en el proyecto.
- **Operational Issue**: Problema detectado en la configuración o ejecución de un proyecto (ej. receta inválida).

## Dependencias Externas Clave
- **Builder Module**: Para la validación, evaluación de código y generación de insights de calidad.
- **Auth Module**: Para control de acceso basado en roles.
- **Storage Module**: Para persistir artefactos y recuperar código fuente.
- **DockerHostService**: Para aislar la ejecución durante la evaluación.

## Efectos Secundarios (Side Effects)
- Altera la base de datos de proyectos, entregas y asignaciones.
- Invoca la ejecución asíncrona del Builder, encolando trabajos intensivos (BullMQ).
- Emite eventos de dominio cuando los proyectos cambian de estado.

## Estado / BBDD
- `Project`
- `Delivery`
- `AssignmentGroupEnrollment`

## Puntos de Entrada (Entrypoints)
- `ProjectsController` (REST API pública)
- `ProjectsService` (Fachada del dominio y lógica de negocio)
- Listeners de eventos de matriculación (`ProjectAssignmentGroupEnrollmentListener`)
