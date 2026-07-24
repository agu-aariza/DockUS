# Módulo de Administración de Usuarios (src/users)

> **Resumen rápido:** Vista de administración para consultar, crear y modificar usuarios, roles y permisos de la plataforma.

---

## Propósito y Responsabilidades
Permitir a los administradores la gestión de las cuentas de usuario.
- **Gestión de Cuentas:** Alta de nuevos profesores y estudiantes.
- **Filtros y Búsqueda:** Búsqueda rápida por nombre, email o rol.

---

## Estructura Interna

```text
.
└── UsersPanel.tsx # Vista principal de gestión de usuarios
```

---

## Flujo de Trabajo / Arquitectura

```text
[ UsersPanel ] ──> [ API HTTP /users ] ──> [ PostgreSQL User Service ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del panel de usuarios:
```bash
npm run test -- src/users
```
