# Módulo de autenticación (`auth/`)

> **Resumen rápido:** Registro, login, refresco de sesión y los guards/estrategia que protegen el resto de la API con JWT. No posee el modelo de usuario — eso es responsabilidad de `users/`, `auth/` solo demuestra y verifica identidad.

---

## ¿Por qué `auth/` y `users/` están separados?

Podría parecer natural fusionarlos, pero se mantienen como módulos distintos a propósito: `auth/` sabe *cómo demostrar* quién eres (contraseñas, tokens, estrategias Passport), `users/` sabe *quién eres* (perfil, rol, estado de la cuenta). Esto permite, por ejemplo, cambiar el mecanismo de autenticación (añadir OAuth, SSO) sin tocar el modelo de usuario, y es la razón por la que `auth/` no tiene carpetas `domain/`/`infrastructure/` propias: no posee ninguna tabla, delega toda la persistencia en `UsersService`.

## El par de tokens: access + refresh

`AuthService` no emite un solo JWT, emite dos, con propósitos y tiempos de vida distintos:

- **`accessToken`**: contiene `{ sub, email, role }`, se firma con `JWT_SECRET`, vida corta. Es el que se manda como `Authorization: Bearer <token>` en cada petición.
- **`refreshToken`**: contiene `{ sub, type: 'refresh' }`, se firma con `JWT_REFRESH_SECRET` (un secreto **distinto** — si no está configurado, cae de vuelta a `JWT_SECRET + '_refresh'`, ver `auth.service.ts:57`), vida larga (`JWT_REFRESH_EXPIRES_IN`, por defecto `7d`). Solo sirve para pedir un access token nuevo en `POST /auth/refresh`; no autentica peticiones directamente.

Que sean secretos distintos importa: si el `accessToken` de alguien se filtra (por ejemplo en un log), no sirve para forjar un `refreshToken` válido y viceversa.

## Cómo se valida cada petición autenticada

```text
Cliente ──> Authorization: Bearer <accessToken> ──> JwtAuthGuard
                                                          │
                                                          ▼
                                          JwtStrategy.validate(payload)
                                                          │
                              ¿en caché Redis (AuthIdentityCacheService)? ──sí──▶ usa el valor cacheado
                                                          │ no
                                                          ▼
                                    UsersService.findById(sub) + assertAccountIsActive()
                                                          │
                                                          ▼
                                    guarda en caché (TTL corto) y expone req.user
```

`JwtStrategy` (Passport) **no confía ciegamente en el payload del JWT** — siempre revalida contra la base de datos (con caché de corta duración en Redis vía `AuthIdentityCacheService` para no golpear Postgres en cada petición) que el usuario siga existiendo y activo. Así, si un admin desactiva una cuenta, sus tokens ya emitidos dejan de servir en cuanto expira la entrada de caché, sin esperar a que expire el JWT.

Nótese que **no hay una `LocalStrategy` de Passport**: `POST /auth/login` valida el email/contraseña directamente dentro de `AuthService.validateLoginIdentity()` contra el hash guardado por `users/`, sin pasar por el sistema de estrategias de Passport — solo `JwtStrategy` se usa como estrategia real.

## Autorización por rol: `RolesGuard`

Además de "¿estás autenticado?" (`JwtAuthGuard`), muchas rutas necesitan "¿tienes el rol correcto?". El decorador `@Roles(UserRole.ADMIN, ...)` adjunta metadata a la ruta, y `RolesGuard` la lee con `Reflector` y la compara contra `request.user.role` (puesto ahí por `JwtStrategy`). Si una ruta no lleva `@Roles(...)`, `RolesGuard` la deja pasar — el guard es "opt-in" por ruta, no restringe por defecto.

## Estructura interna

```text
auth/
├── auth.module.ts                       # Registro de PassportModule, JwtModule y el propio servicio/controlador
├── auth.controller.ts                    # POST /auth/register, /auth/login, /auth/refresh · GET /auth/profile
├── auth.service.ts                        # Lógica de emisión/verificación de tokens (ver arriba)
├── strategies/jwt.strategy.ts               # Única estrategia Passport activa; valida y cachea la identidad
├── guards/
│   ├── jwt-auth.guard.ts                       # Exige un accessToken válido (dispara JwtStrategy)
│   └── roles.guard.ts                            # Exige uno de los roles declarados con @Roles(...)
├── interfaces/authenticated-user.interface.ts       # Forma de req.user tras pasar los guards
└── dto/
    ├── auth.dto.ts                                    # RegisterDto, LoginDto
    ├── auth-response.dto.ts                             # Forma de la respuesta (user + ambos tokens)
    └── refresh-token.dto.ts                               # Payload de POST /auth/refresh
```

## Endpoints (`/auth`)

| Método | Ruta | Rate limit | Qué hace |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | `authThrottleOverrides` (más estricto que el global) | Crea la cuenta vía `UsersService.create` y devuelve sesión inicial. |
| `POST` | `/auth/login` | `authThrottleOverrides` | Valida credenciales, devuelve `{ user, accessToken, refreshToken }`. |
| `POST` | `/auth/refresh` | `authThrottleOverrides` | Cambia un `refreshToken` válido por un par de tokens nuevo. |
| `GET` | `/auth/profile` | — | Requiere `JwtAuthGuard`; devuelve `req.user` tal cual lo dejó `JwtStrategy`. |

Los tres endpoints de escritura tienen un límite de peticiones más estricto que el resto de la API (`shared/infrastructure/security/throttler.config.ts`) para dificultar ataques de fuerza bruta contra login/registro.

## Cómo trabajar aquí

```bash
npm run test -- src/modules/auth
```

Si necesitas proteger un endpoint nuevo: `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de controlador o método, y `@Roles(UserRole.TEACHER)` (o los roles que correspondan) en el handler concreto. Si solo necesitas "estar logueado, cualquier rol", usa solo `JwtAuthGuard`.

## Ver también

- [`../users/README.md`](../users/README.md) — el modelo de usuario que `auth/` consulta pero no posee.
- [`../../shared/infrastructure/cache/README.md`](../../shared/infrastructure/cache/README.md) — `AuthIdentityCacheService`.
- [`../../shared/infrastructure/security/README.md`](../../shared/infrastructure/security/README.md) — rate limiting.
