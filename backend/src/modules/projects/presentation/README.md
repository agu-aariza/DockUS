# Capa de Presentación de Proyectos (Projects Presentation)

Este directorio conforma la Capa de Presentación (Presentation Layer) del módulo principal de proyectos. Su única responsabilidad es manejar las peticiones HTTP de entrada (Requests), enrutar estas peticiones a los servicios de aplicación o dominio correspondientes, y formatear las respuestas de salida (Responses) hacia el cliente web o móvil.

Es el punto de entrada de la API para todas las operaciones relacionadas con proyectos.

## Archivos de Controladores (Controllers)

Los archivos contenidos aquí son Controladores de NestJS (`*.controller.ts`). Cada uno agrupa endpoints (rutas) relacionados por su sub-dominio funcional:

- **`projects.controller.ts`**: Es el controlador principal y el más grande. Maneja las operaciones CRUD fundamentales de los proyectos (Crear un proyecto, listar proyectos, ver detalles de un proyecto específico, actualizar su metadata, archivar/borrar). También puede manejar metadatos de configuración a nivel raíz del proyecto.
- **`deliveries.controller.ts`**: Controlador dedicado exclusivamente a las entregas de los estudiantes. Expone endpoints para que un estudiante envíe (suba) su trabajo (archivos, enlaces a repositorios, imágenes docker), para listar las entregas de un proyecto, y para consultar el estado de una entrega en particular.
- **`project-gradebook.controller.ts`**: Controlador que expone la API para el "Libro de Calificaciones". Proporciona rutas para que los profesores consulten las notas agregadas de un proyecto, asignen o modifiquen calificaciones manuales, apliquen rúbricas a una entrega y publiquen las notas finales a los estudiantes.
- **`project-assignments.controller.ts`**: Maneja los endpoints relacionados con la asignación (quién debe hacer qué). Permite a los profesores asignar un proyecto a estudiantes individuales, a grupos enteros, a clases (aulas) completas, o gestionar fechas límite personalizadas por asignación.

*Nota:* Los controladores delegan toda la lógica de negocio compleja a la capa de Servicios (`projects.service.ts`, `project-gradebook.service.ts`, etc.) ubicados en la raíz del módulo, actuando solo como mediadores HTTP.
