# Almacenamiento de Artefactos (Storage Management)

Este módulo implementa la interfaz de gestión de almacenamiento de DockUS, permitiendo a los usuarios subir, buscar, previsualizar, descargar y eliminar artefactos binarios asociados a entregas y ejecuciones de compilación. Toda la lógica de estado y comunicación con las APIs se encapsula en un custom hook dedicado, manteniendo el componente de presentación enfocado exclusivamente en el renderizado de la UI.

## Estructura de Directorios

```
storage/
├── hooks/
│   └── useStorageManagement.ts
├── StoragePanel.tsx
└── README.md
```

## Archivos y Responsabilidades

### Componente Principal

- **`StoragePanel.tsx`**: Componente de presentación que renderiza la "Bóveda de Artefactos" de DockUS con el nuevo sistema visual sobrio e institucional (B2B dashboard). La interfaz se organiza en tres pestañas gestionadas por el componente `Tabs` del UI kit compartido:
  - **Cargar Objeto**: formulario de subida con selector de archivo, campos de ID de entrega y nombre lógico, presentado dentro de una tarjeta `card` con encabezado `panel-header`.
  - **Búsqueda Global**: filtros en cascada por proyecto → entrega → ejecución, controles de paginación y rango de fechas, agrupados en una tarjeta `card`.
  - **Explorador**: tabla de objetos persistidos con acciones de vista previa, descarga y eliminación. Los tipos de artefacto se distinguen con `StatusBadge`, y el estado vacío se representa con el componente `EmptyState`.

  Incluye un modal de vista previa simplificado que soporta contenido textual plano y exploración interactiva de archivos ZIP con secciones colapsables. Toda la interacción con el estado se delega al hook `useStorageManagement`, y los mensajes de operación se canalizan al sistema de notificaciones `ToastContext`.

  Utiliza componentes compartidos del UI kit: `PageHeader`, `StatsOverview`, `MetricCard`, `Button`, `Tabs`, `StatusBadge`, `EmptyState` y `DangerConfirmModal`. El diseño emplea los tokens visuales institucionales (`bg-app-bg`, `bg-white`, `border-app-border`, `text-primary`, `bg-primary`, `text-slate-900`, `text-slate-500`) y evita estilos legacy (`academic-*`, `brand-*`, sombras fuertes, bordes redondeados extremos y animaciones de entrada).

### Hooks

- **`hooks/useStorageManagement.ts`**: Hook central que encapsula toda la lógica de negocio del módulo de almacenamiento. Gestiona múltiples dominios de estado: formulario de subida, parámetros de consulta con filtros en cascada (proyecto → entregas → ejecuciones), lista unificada de resultados (`UnifiedStorageItem` que combina `storage_object` y `run_artifact`), y estados de vista previa y descarga. Orquesta llamadas a cinco APIs diferentes (`storageApi`, `projectsApi`, `deliveriesApi`, `assignmentsApi`, `builderApi`) e implementa efectos reactivos que cargan automáticamente las listas de proyectos al inicializar y actualizan las entregas y ejecuciones cuando cambia la selección del filtro padre. Integra verificación de integridad SHA-256 en las subidas mediante `computeSha256Hex`, controla permisos de operación a través de `useManagementPermissions`, y expone operaciones peligrosas (eliminación lógica y purga) con confirmación modal. Devuelve un objeto extenso con todo el estado y las acciones necesarias para que `StoragePanel` funcione como componente puramente presentacional.
