## Responsabilidad del Módulo
Maneja la autenticación de usuarios, emisión/renovación de tokens JWT y la infraestructura de guardias (guards) para proteger rutas y verificar roles (RBAC).

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona el CRUD de usuarios ni el estado detallado de sus perfiles; delega la obtención y validación de usuarios al `UsersModule`.

## Conceptos Clave (Glosario)
- **AccessToken**: Token JWT de corta duración para autenticar peticiones HTTP.
- **RefreshToken**: Token JWT de larga duración usado para obtener un nuevo AccessToken sin reloguearse.
- **JwtAuthGuard**: Protección de endpoints para asegurar que la petición posee un JWT válido.
- **RolesGuard**: Verifica que el rol del usuario autenticado cumpla con los requisitos de la ruta.

## Dependencias Externas Clave
- `UsersService` (del `UsersModule`) para validar credenciales y comprobar el estado del usuario.
- `@nestjs/passport` y `@nestjs/jwt` para la criptografía y estrategias de autenticación.

## Efectos Secundarios (Side Effects)
No altera estado global directamente, más allá de emitir tokens que los clientes deben almacenar.

## Estado / BBDD
No posee tablas propias (usa la tabla `users` mediante `UsersModule` para validar contraseñas).

## Puntos de Entrada (Entrypoints)
- `auth.controller.ts`: Endpoints `/auth/login`, `/auth/register`, `/auth/refresh` y `/auth/me`.
