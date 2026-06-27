# frontend/src/users/

Panel de administración de usuarios para el rol administrador.

## Archivos principales

| Archivo | Función |
|---------|---------|
| [`UsersPanel.tsx`](./UsersPanel.tsx) | Panel principal: directorio de usuarios, filtros, alta y gestión de estado. |
| [`hooks/useUserManagement.ts`](./hooks/useUserManagement.ts) | Estado y acciones del panel de usuarios. |

## Diseño visual

`UsersPanel.tsx` sigue el sistema visual sobrio e institucional del dashboard B2B de DockUS:

- Fondo `bg-app-bg`, superficies `bg-white` y bordes `border-app-border`.
- Colores institucionales: primario `primary` (#2563EB) y acento vino `accent` (#5b040d) solo como acento puntual.
- Tipografía sobria con Inter / system-ui; títulos en `text-sm font-semibold` / `text-base font-semibold`.
- Bordes redondeados `rounded-md`, `rounded-lg`, `rounded-xl`; sin sombras decorativas ni gradientes.

## Componentes del UI Kit utilizados

| Componente | Archivo | Uso en el panel |
|------------|---------|-----------------|
| `PageHeader` | `shared/components/ui/PageHeader.tsx` | Cabecera del panel con título, subtítulo, icono y badge. |
| `Tabs` | `shared/components/ui/Tabs.tsx` | Navegación entre "Directorio" y "Nuevo Usuario". |
| `Card` | `shared/components/ui/Layout.tsx` | Contenedor del panel de filtros. |
| `SectionCard` | `shared/components/ui/Layout.tsx` | Contenedor del formulario de alta de usuario. |
| `Button` / `IconButton` | `shared/components/ui/Button.tsx` | Acciones: sincronizar directorio, eliminar usuario y crear usuario. |
| `SearchInput` | `shared/components/ui/SearchInput.tsx` | Campo de búsqueda por nombre o email. |
| `StatusBadge` | `shared/components/ui/StatusBadge.tsx` | Indicador visual del estado de cuenta (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION`). |
| `Badge` | `shared/components/ui/Layout.tsx` | Etiqueta del rol de usuario. |
| `DataTable` | `shared/components/ui/DataTable.tsx` | Tabla de resultados del directorio. |
| `EmptyState` | `shared/components/EmptyState.tsx` | Estados vacíos antes de sincronizar o sin resultados. |

## Notas

- Solo los usuarios con rol `ADMIN` acceden a este panel.
- Permite crear usuarios con rol `TEACHER` o `STUDENT`, y cambiar su estado (activo/inactivo/suspendido).
- La lógica de negocio y las llamadas a API permanecen en `hooks/useUserManagement.ts`; este componente solo define la presentación.
