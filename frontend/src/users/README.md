## Responsabilidad del Módulo
Administra la gestión del ciclo de vida de los usuarios en la plataforma, permitiendo visualizarlos, crearlos y asignar roles y grupos.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona la sesión actual ni el proceso de autenticación o login (esto pertenece a `shared/session`).

## Conceptos Clave (Glosario)
- **UsersPanel**: Interfaz administrativa de la tabla de usuarios.

## Dependencias Externas Clave
Depende de `shared/api/usersApi.ts` para operaciones CRUD y de `shared/components/ui/DataTable.tsx` para la presentación.

## Efectos Secundarios (Side Effects)
Abre modales de creación o edición que envían mutaciones de datos de usuario al backend.

## Estado / BBDD
Mantiene listas de usuarios locales en cliente para la vista de tabla, con paginación y filtros.

## Puntos de Entrada (Entrypoints)
- `UsersPanel.tsx`
