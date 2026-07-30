# Módulo de Autenticación y Autorización (auth)

> **Resumen rápido:** Registro, inicio de sesión, generación de Json Web Tokens (JWT), encriptación de contraseñas y validación de roles de usuario.

---

## Propósito y Responsabilidades
Garantizar la identidad segura de los usuarios en la plataforma.
- **Autenticación:** Validación de credenciales y expedición de tokens JWT.
- **Control de Acceso:** Estrategias y guards para restringir rutas según el rol (estudiante, profesor, admin).

---

## Estructura Interna

```text
.
├── auth.controller.ts # Endpoints /auth/login, /auth/register, /auth/refresh, etc.
├── auth.module.ts     # Registro de NestJS, Passport y Passport-JWT
├── auth.service.ts    # Lógica de verificación de hash de contraseñas y firma JWT
├── dto/               # Data Transfer Objects para credenciales y tokens
├── guards/            # Guards JwtAuthGuard y RolesGuard
├── interfaces/        # Interfaces y tipos de payload JWT
└── strategies/        # Estrategias Passport (JwtStrategy, LocalStrategy)
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Cliente HTTP ] ──> POST /auth/login ──> [ AuthController ] ──> [ AuthService ] ──> (Retorna Access Token JWT)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de autenticación:
```bash
npm run test -- src/modules/auth
```
