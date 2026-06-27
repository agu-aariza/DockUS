# backend/src/modules/

Módulos de dominio de negocio del backend. Cada carpeta representa un contexto acotado con sus controladores, servicios, entidades y DTOs.

## Módulos

| Módulo | Descripción | Archivos clave |
|--------|-------------|----------------|
| [`auth/`](./auth) | Autenticación JWT y autorización por roles. | `auth.controller.ts`, `auth.service.ts`, `guards/jwt-auth.guard.ts`, `strategies/jwt.strategy.ts` |
| [`users/`](./users) | CRUD de usuarios y RBAC. | `users.controller.ts`, `users.service.ts`, `entities/user.entity.ts` |
| [`academic/`](./academic) | Grupos de curso y matrículas masivas. | `groups.controller.ts`, `groups.service.ts`, `entities/course-group.entity.ts` |
| [`projects/`](./projects) | Dominio principal: proyectos, asignaciones, entregas, storage, runtime y builder. | `projects.controller.ts`, `projects.service.ts`, y submódulos internos |

## Autenticación y roles

- `JwtAuthGuard` protege las rutas que requieren sesión.
- `RolesGuard` verifica que el rol del usuario (`ADMIN`, `TEACHER`, `STUDENT`) coincida con el decorador `@Roles()`.
- Además, los servicios aplican comprobaciones de ownership (p. ej., un alumno solo ve sus propias entregas).

## Notas

- Los DTOs usan `class-validator` y `class-transformer` para validación y serialización.
- Las entidades TypeORM definen el esquema relacional; en desarrollo y test se sincronizan automáticamente.
- El módulo más complejo es [`projects/`](./projects/README.md), que a su vez se divide en submódulos especializados.
