# Módulo de Usuarios (users)

> **Resumen rápido:** Administración de cuentas de usuario, perfiles, cambio de roles y consulta de información personal.

---

## Propósito y Responsabilidades
Mantener la información de los usuarios del sistema y gestionar sus preferencias y estado.
- **Gestión de Perfiles:** Consulta y edición de datos de usuario.
- **Administración:** Listado y filtrado de usuarios para administradores y profesores.

---

## Estructura Interna

```text
.
├── application/       # Servicios de aplicación y casos de uso (`users.service.ts`)
├── domain/            # Entidades y reglas puras del dominio de usuarios
├── dto/               # DTOs para la creación, actualización y filtrado de usuarios
├── entities/          # Entidades TypeORM del modelo User
├── infrastructure/    # Repositorios de base de datos e integración con TypeORM
├── presentation/      # Endpoints HTTP (`users.controller.ts`)
└── users.module.ts    # Registro del módulo de usuarios en NestJS
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Cliente HTTP ] ──> GET /users/me ──> [ UsersController ] ──> [ UsersService ] ──> [ User Repository ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de usuarios:
```bash
npm run test -- src/modules/users
```
