# Frontend: Groups

## Descripción General

El módulo `groups` del frontend está alineado con el módulo `academic` del backend. Permite al personal docente crear, editar y eliminar grupos de clase (`CourseGroups`), así como gestionar la matriculación individual y masiva de estudiantes.

El diseño sigue el **sistema visual sobrio e institucional (B2B dashboard)** del proyecto: fondo `app-bg`, superficies `white`, bordes `app-border`, color principal `primary` y acento institucional vino `accent` como detalle puntual. No se utilizan gradientes, marcos decorativos, sombras fuertes ni bordes redondeados extremos.

## Estructura de Directorios

```text
groups/
├── README.md
├── hooks/
│   └── useGroupManagement.ts
└── pages/
    └── TeacherGroupsPanel.tsx
```

## Detalle de Ficheros

### `pages/TeacherGroupsPanel.tsx`

Panel principal de administración de grupos para docentes.

**Responsabilidades:**

- Renderizar un layout de dos columnas:
  - **Sidebar (izquierda):** listado de grupos, búsqueda y formulario inline de creación.
  - **Canvas (derecha):** detalle del grupo seleccionado con directorio de alumnos, filtros de matriculación e ingesta masiva.
- Soportar *deep linking* mediante el parámetro `focusedGroupId` de la URL.
- Permitir crear, editar y eliminar grupos.
- Permitir buscar alumnos y filtrar por estado de matriculación (`all`, `enrolled`, `not_enrolled`).
- Permitir matricular/desmatricular alumnos mediante un toggle individual.
- Permitir matrícula masiva a partir de texto libre pegado en un `textarea`.
- Mostrar estados vacíos descriptivos cuando no hay grupos o alumnos.

**Componentes del UI Kit utilizados:**

- `PageHeader`: cabecera del panel con título, badge y acciones.
- `Button`: acciones principales y secundarias.
- `Tabs`: filtro de matriculación (`Todos`, `Matriculados`, `No matriculados`).
- `SearchInput`: búsquedas de grupos y alumnos.
- `Card` / `SectionCard`: contenedores de secciones.
- `StatusBadge` / `Badge`: contadores y estados.
- `EmptyState`: estados vacíos.

**Notas de diseño:**

- Tipografía sobria con `text-sm font-semibold` y `text-base font-semibold`.
- Bordes redondeados `rounded-md`, `rounded-lg`.
- Colores institucionales: `text-slate-900`, `text-slate-500`, `bg-primary`, `text-primary`, `bg-accent` solo como acento puntual.
- Transiciones simples; sin animaciones de entrada (`animate-in`, `zoom-in-95`, etc.).

### `hooks/useGroupManagement.ts`

Hook de estado y lógica de negocio. Abstrae las llamadas a los endpoints REST del backend (`GET /groups`, `POST /groups`, `POST /groups/:id/enroll`, `PATCH /groups/:id`, etc.) y expone métodos y estado que consume el panel. **No debe modificarse** como parte de cambios de diseño.

## Convenciones

- Mantener la lógica de negocio en `useGroupManagement`.
- Usar componentes del UI Kit en `frontend/src/shared/components/ui/` para nuevos paneles.
- No introducir clases legacy (`academic-*`, `brand-maroon`, `brand-blue`, `shadow-academic`) en este módulo.
