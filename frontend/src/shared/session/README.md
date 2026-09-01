# Sesión (`shared/session/`)

> **Resumen rápido:** Tres piezas: el store de persistencia (`sessionStore.ts`), el contexto React que lo expone a la app (`SessionContext.tsx`, `useSession()`), y un hook de permisos derivados del rol (`useManagementPermissions.ts`). Nunca se lee `localStorage` directamente fuera de aquí.

---

## Las tres piezas y cómo se relacionan

```text
sessionStore.ts             → funciones puras: leer/escribir localStorage, sin React
        │
        ▼
SessionContext.tsx           → envuelve sessionStore en un Context de React, expone useSession()
        │
        ▼
useManagementPermissions.ts    → deriva "¿puede este usuario hacer X?" a partir de session.role,
                                   usando hasRole() de shared/utils/permissions.ts
```

`useSession()` es el único punto de acceso a la identidad activa desde un componente — nunca se lee `localStorage` a mano en otro sitio del código (regla explícita: "siempre pasar por `useSession()`").

## Multi-sesión: por qué esto no es un simple `{ token, user }`

`sessionStore.ts` soporta más de una cuenta activa a la vez (relevante para el `DebugSwitcher` de `auth/`, una herramienta de desarrollo para cambiar de sesión rápidamente sin cerrar y volver a entrar) — no asumas que solo existe una sesión guardada; el store gestiona una colección y cuál es la "activa".

## `useManagementPermissions.ts`: dónde vive la lógica de "quién puede qué"

Centraliza comprobaciones como "¿puede este usuario gestionar usuarios?" o "¿puede administrar este proyecto?" a partir del rol de la sesión — los componentes consultan este hook en vez de comparar `session.role === 'ADMIN'` repetidamente por toda la UI. Es la contraparte en el frontend de `RolesGuard`/`@Roles(...)` en el backend — pero **nunca sustituye la comprobación real del servidor**: es solo para adaptar qué se muestra en la UI, la autorización de verdad siempre la aplica el backend.

## Estructura interna

```text
session/
├── sessionStore.ts               # Persistencia multi-cuenta en localStorage, sin React
├── SessionContext.tsx               # Provider + useSession()
└── useManagementPermissions.ts        # Permisos derivados del rol activo
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/session
```

## Ver también

- [`../../auth/README.md`](../../auth/README.md) — quién produce la sesión (login/registro).
- [`../utils/README.md`](../utils/README.md) — `hasRole()`, usado por `useManagementPermissions.ts`.
