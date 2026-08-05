# Módulo de usuarios (`users/`)

> **Resumen rápido:** Dueño único de la identidad: la entidad `User`, sus roles (`STUDENT`/`TEACHER`/`ADMIN`), el estado de la cuenta, el hash de contraseña y el borrado lógico. No emite tokens ni valida sesiones — eso es `auth/`.

---

## El modelo de usuario

Cada `User` tiene un **rol** (`UserRole`: `STUDENT`, `TEACHER`, `ADMIN` — determina qué puede hacer) y un **estado** (`UserStatus`: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION` — determina si la cuenta puede operar en absoluto ahora mismo). Son ejes independientes: un `TEACHER` puede estar `SUSPENDED`. `auth/` comprueba el estado (`assertAccountIsActive`) en cada login y en cada validación de JWT; comprueba el rol solo cuando una ruta lo exige vía `RolesGuard`.

La contraseña se guarda como `passwordHash` con `@Column({ select: false })` — TypeORM la excluye de cualquier `find()` por defecto, y solo se recupera explícitamente en el flujo de login (`findByEmailForAuth` → `findByEmailWithPasswordHash`) para minimizar el riesgo de que un hash acabe filtrado en una respuesta HTTP por error. El hashing usa `bcrypt` con `BCRYPT_SALT_ROUNDS = 10`.

El borrado es **lógico** (`@DeleteDateColumn() deletedAt`): `remove()` no borra la fila, la marca; `restore()` la revierte. Los repositorios excluyen por defecto las filas con `deletedAt` salvo que se pida explícitamente `includeDeleted = true` (necesario, por ejemplo, para que un admin pueda restaurar una cuenta).

## Estructura interna

```text
users/
├── users.module.ts                              # Registra controlador, servicio y el repositorio TypeORM
├── presentation/users.controller.ts               # Todos los endpoints REST de /users
├── application/users.service.ts                    # Lógica de negocio: hashing, paginación, validaciones
├── domain/repositories/user.repository.interface.ts  # Puerto IUserRepository (token USER_REPOSITORY)
├── infrastructure/database/user.repository.ts           # Implementación TypeORM del puerto
├── entities/user.entity.ts                                # Tabla `users`, UserRole y UserStatus
└── dto/
    ├── create-user.dto.ts                                    # CreateUserDto, UpdateUserDto
    ├── list-users-query.dto.ts                                 # Filtros + paginación de GET /users
    └── user-response.dto.ts                                      # Forma de la respuesta pública (sin passwordHash)
```

## Endpoints (`/users`, protegidos con `JwtAuthGuard` + `RolesGuard`)

| Método | Ruta | Rol requerido | Qué hace |
| --- | --- | --- | --- |
| `POST` | `/users` | `ADMIN` | Crea una identidad con rol/estado explícitos (alta administrativa). |
| `GET` | `/users` | `ADMIN`, `TEACHER` | Lista paginada, con filtros (`ListUsersQueryDto`). |
| `GET` | `/users/:id` | `ADMIN`, `TEACHER` | Consulta una identidad concreta (sanitizada, sin hash). |
| `PATCH` | `/users/:id` | `ADMIN` | Actualización parcial. |
| `DELETE` | `/users/:id` | `ADMIN` | Borrado lógico (`204`, sin cuerpo). |
| `PATCH` | `/users/:id/restore` | `ADMIN` | Revierte un borrado lógico. |
| `PATCH` | `/users/:id/status/:status` | `ADMIN` | Cambia el estado del ciclo de vida (activar/suspender/etc.). |

Nótese la diferencia de roles: crear, editar, borrar y cambiar estado son operaciones exclusivas de `ADMIN`; **listar y consultar** están también abiertas a `TEACHER` (por ejemplo, para que un profesor pueda ver el nombre de un alumno al revisar una entrega).

## Cómo trabajar aquí

```bash
npm run test -- src/modules/users
```

`UsersService` es también el punto que usa `auth/` para todo lo relacionado con contraseñas (`validatePassword`) y para resolver identidades desde el JWT (`findById`) — si cambias la forma de `User` o el flujo de creación, revisa el impacto en `auth.service.ts` y `jwt.strategy.ts` antes de continuar.

## Ver también

- [`../auth/README.md`](../auth/README.md) — cómo se usa este módulo para autenticar.
- [`../../shared/database/README.md`](../../shared/database/README.md) — `throwIfUniqueViolation`, usado aquí para el error 409 de email duplicado.
