# Frontend: Características y Estado Global (Features)

El directorio `features/` es un pilar fundamental en la arquitectura del Frontend de la aplicación. Utiliza el patrón de "Feature Slices" o "Módulos de características", comúnmente usado con gestores de estado global como Redux Toolkit (Slices) o librerías de obtención de datos como React Query / RTK Query.

Su responsabilidad es alojar la **lógica de estado global, la integración con la API centralizada, y las acciones (thunks/mutations)** de los diferentes dominios de negocio, separándolos de los componentes visuales de React.

## Estructura de Directorios

El directorio está organizado por "Dominios de Negocio" (Business Domains), replicando a grandes rasgos la estructura modular del Backend:

- **`auth/`**: Maneja el estado global de la sesión del usuario. Contiene llamadas a la API para Iniciar Sesión (Login), Cerrar Sesión (Logout), validación de tokens JWT y almacenamiento de la información del perfil del usuario actualmente autenticado.
- **`projects/`**: Administra el estado global de la gestión de proyectos. Aquí se almacenan las peticiones en caché (React Query) o slices (Redux) para el CRUD de proyectos, permitiendo que cualquier componente de la app acceda a la lista de proyectos sin hacer peticiones redundantes.
- **`deliveries/`**: Contiene la lógica centralizada para obtener el histórico de entregas, enviar nuevas entregas (mutations) y gestionar el estado global asociado a las calificaciones.
- **`groups/`**: Estado global y llamadas a la API para la gestión de alumnos, grupos de trabajo y cohortes (relacionado con las asignaciones de proyectos).
- **`storage/`**: Lógica y peticiones HTTP encargadas de gestionar la subida (upload) y descarga (download) de archivos estáticos (adjuntos de proyectos, entregables de alumnos) hacia los buckets o servicios de almacenamiento (S3, Minio, sistema de archivos local).
- **`builder/`**: Centraliza el estado complejo del asistente de Inteligencia Artificial (Project Builder). Aquí se maneja el historial de mensajes del chat con la IA, el estado de la construcción en vivo (draft del proyecto), y la comunicación iterativa (posiblemente a través de WebSockets o peticiones HTTP largas) con la capa de aplicación del Builder en el Backend.
