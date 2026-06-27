# Module: Auth

## Descripción General
El módulo `AuthModule` gestiona la autenticación de usuarios, emisión y validación de tokens JWT (Access y Refresh tokens), y proporciona la infraestructura necesaria para asegurar la API completa. Su diseño está orientado a la seguridad (protección contra manipulación de identidades) y funciona en conjunto con `UsersModule` y `@nestjs/passport`.

## Árbol de Directorios
```text
auth/
├── README.md
├── auth.controller.ts
├── auth.module.ts
├── auth.service.spec.ts
├── auth.service.ts
├── dto/
│   ├── auth-response.dto.ts
│   ├── auth.dto.ts
│   └── refresh-token.dto.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   └── roles.guard.ts
├── interfaces/
│   └── authenticated-user.interface.ts
└── strategies/
    └── jwt.strategy.ts
```

## Detalle Exhaustivo de Ficheros

### 1. Servicios y Lógica de Negocio
- **`auth.service.ts`**
  - **Propósito:** Orquestar el flujo principal de autenticación (Login, Registro y Refresco de tokens).
  - **Responsabilidad:** 
    - Llama a `UsersService.findByEmailForAuth` para recuperar el hash de la contraseña, luego verifica si coincide usando `UsersService.validatePassword`.
    - Genera payloads JWT y usa el `JwtService` nativo de NestJS para emitir `accessToken` (corta duración, ej. 1 hora) y `refreshToken` (larga duración, ej. 7 días).
    - Para renovar sesión, valida el `refreshToken`, asegura que el usuario sigue activo, y expide un par nuevo de tokens.
  - **Conexiones:** Inyecta `UsersService` (del `UsersModule`) y `JwtService` (del `JwtModule`). 
- **`auth.service.spec.ts`**
  - **Propósito:** Batería de pruebas unitarias aislando el JWT y la base de datos.
  - **Responsabilidad:** Valida escenarios de credenciales incorrectas (lanza `UnauthorizedException`), tokens expirados y flujos correctos de emisión de tokens.

### 2. Controladores
- **`auth.controller.ts`**
  - **Propósito:** Exponer las rutas públicas y privadas de autenticación.
  - **Responsabilidad:** Provee las rutas `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, y un endpoint protegido para obtener la identidad de la sesión activa `GET /auth/me`. 
  - **Conexiones:** Todo payload HTTP se valida usando los DTOs de este módulo antes de pasarlo al `AuthService`.

### 3. Estrategias y Guards (Seguridad Passport)
- **`strategies/jwt.strategy.ts`**
  - **Propósito:** Implementar la estrategia `passport-jwt` para interceptar peticiones.
  - **Responsabilidad:** Extrae el token tipo "Bearer" de la cabecera `Authorization`, lo decodifica usando la clave secreta (`JWT_SECRET`) y lo valida. Si es válido, llama a `validate(payload)` el cual consulta si la cuenta sigue activa y devuelve un objeto `AuthenticatedUser`.
- **`guards/jwt-auth.guard.ts`**
  - **Propósito:** Enlace para proteger rutas.
  - **Responsabilidad:** Extiende de `AuthGuard('jwt')`. Se aplica a controladores o métodos (ej. `@UseGuards(JwtAuthGuard)`) para bloquear cualquier Request sin JWT válido.
- **`guards/roles.guard.ts`**
  - **Propósito:** Control de acceso por Roles (RBAC).
  - **Responsabilidad:** Define el decorador `@Roles()` y un Guard que inspecciona los metadatos de la ruta requerida comparándolos con el `user.role` inyectado por el JwtStrategy.

### 4. DTOs e Interfaces
- **`dto/auth.dto.ts`:** DTOs para `RegisterDto` y `LoginDto`, exigiendo correos válidos y passwords robustos mediante regex.
- **`dto/auth-response.dto.ts`:** Define el formato de la respuesta a swagger (tokens + data del user).
- **`dto/refresh-token.dto.ts`:** DTO para requerir explícitamente el token de renovación.
- **`interfaces/authenticated-user.interface.ts`:** Tipado estricto `AuthenticatedUser` y `AuthenticatedRequest` para ser utilizado mediante autocompletado en los Controladores.

## Información para la IA
Este módulo se caracteriza por su aislamiento estricto: es el único que puede leer contraseñas. Siempre que se deba interactuar con el JWT activo en un endpoint, se debe utilizar el objeto inyectado en `req.user` tipado como `AuthenticatedUser`. Si se necesitan nuevos flujos (por ejemplo OAuth2 de Google/GitHub), se deben crear nuevos archivos `strategies/xxx.strategy.ts` y extender el controlador de este módulo.
