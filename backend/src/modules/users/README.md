## Responsabilidad del Módulo
Gestión de la identidad de los usuarios (CRUD), persistencia de credenciales de forma segura y administración de roles y estados de cuenta.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No emite tokens JWT, no procesa logins HTTP directamente, ni maneja sesiones. La autenticación es responsabilidad exclusiva del módulo `auth`.

## Conceptos Clave (Glosario)
- **UserRole**: Nivel de privilegio del usuario (STUDENT, TEACHER, ADMIN).
- **UserStatus**: Ciclo de vida de la cuenta (ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION).
- **Soft Delete**: Eliminación lógica de un usuario (marcado como borrado pero retenido en BD).

## Dependencias Externas Clave
- Módulo `TypeOrm` para la persistencia en PostgreSQL.
- Sistema de encriptación `bcrypt` para cifrado de contraseñas.

## Efectos Secundarios (Side Effects)
Modifica el estado persistente de identidades en la base de datos. Ningún otro módulo debe modificar usuarios directamente.

## Estado / BBDD
- Tabla `users` (entidad `User`).

## Puntos de Entrada (Entrypoints)
- `users.controller.ts`: Rutas administrativas REST para gestión de usuarios.
- `users.service.ts`: Métodos internos consumidos por otros módulos (especialmente `findByEmailForAuth` para el módulo `auth`).
