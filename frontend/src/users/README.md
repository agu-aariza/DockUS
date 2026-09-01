# Administración de usuarios (`src/users/`)

> **Resumen rápido:** Panel exclusivo de `ADMIN` para listar, crear, editar y cambiar el rol/estado de cualquier cuenta (`GET/POST/PATCH /users`). Un profesor puede consultar usuarios (rol compartido en el backend), pero solo un admin ve este panel completo con acciones de escritura.

---

## Estructura interna

```text
users/
├── UsersPanel.tsx                  # Página principal: tabla + búsqueda/filtro por rol o estado
├── components/EditUserModal.tsx      # Modal de creación/edición: rol, estado, datos personales
├── hooks/useUserManagement.ts          # Queries/mutaciones React Query sobre /users
└── userConstants.ts                      # Etiquetas e iconografía por rol/estado — fuente única de esos textos
```

## API del dominio

`api/usersApi.ts` es la fachada HTTP del CRUD de usuarios y sus cambios de estado. `useUserManagement.ts` la consume mediante React Query; el resto de la UI no importa `axios`.

## `userConstants.ts`: por qué existe

Centraliza cómo se muestra cada `UserRole` (`STUDENT`/`TEACHER`/`ADMIN`) y `UserStatus` (`ACTIVE`/`INACTIVE`/`SUSPENDED`/`PENDING_VERIFICATION`) — icono, etiqueta legible y el "tono" de color (`StatusTone`, de `shared/components/ui/StatusBadge.tsx`) para cada valor. `UsersPanel.tsx` y `EditUserModal.tsx` comparten esta misma fuente en vez de que cada uno decida su propio texto/color para el mismo rol — así un cambio de terminología (p. ej. renombrar cómo se muestra `SUSPENDED`) se hace en un solo sitio.

## Qué opera realmente cada acción

- Crear/editar (`EditUserModal.tsx`) → `POST`/`PATCH /users/:id` (solo `ADMIN`).
- Cambiar rol o estado → `PATCH /users/:id` / `PATCH /users/:id/status/:status`.
- Eliminar → borrado lógico (`DELETE /users/:id`), reversible desde el propio backend (`PATCH /users/:id/restore`), aunque este panel puede no exponer la restauración directamente — si necesitas esa acción y no está en la UI, revisa primero si conviene añadirla aquí antes de asumir que hay que hacerlo por otra vía.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/users
```

## Ver también

- [`../../../backend/src/modules/users/README.md`](../../../backend/src/modules/users/README.md) — los endpoints y reglas de rol/estado que este panel administra.
