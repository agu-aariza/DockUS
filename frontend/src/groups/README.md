## Responsabilidad del Módulo
Interfaz administrativa para la creación, visualización y gestión de grupos (Groups) y la matriculación/asignación de usuarios (estudiantes y profesores) a ellos.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona el perfil individual del usuario fuera del contexto de su pertenencia a un grupo. 

## Conceptos Clave (Glosario)
- **TeacherGroupsPanel**: Tabla/Dashboard para que el profesor administre la jerarquía y pertenencia de grupos.
- **Group**: Colección de usuarios unidos bajo una misma cohorte o clase.

## Dependencias Externas Clave
Integra llamadas de API y hooks específicos del dominio `groups` para realizar operaciones de CRUD sobre la pertenencia y estructura de los grupos.

## Efectos Secundarios (Side Effects)
Dispara re-renders en las tablas de usuarios y modales al mutar (crear/eliminar) un grupo o al añadir/quitar un estudiante.

## Estado / BBDD
Maneja el estado de paginación, filtros de la vista de tabla y estado transaccional de modales de creación.

## Puntos de Entrada (Entrypoints)
- `pages/TeacherGroupsPanel.tsx`: Vista principal montada en la ruta `/groups`.
