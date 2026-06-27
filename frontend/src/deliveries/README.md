# Frontend: Panel de Entregas (Deliveries)

Este directorio alberga la interfaz de usuario específica para que los **profesores (o administradores)** gestionen, revisen y califiquen las entregas (submissions) realizadas por los estudiantes a los distintos proyectos.

## Sistema visual

El módulo sigue el nuevo diseño institucional B2B del dashboard:

- Fondo: `bg-app-bg` (#f8fafc).
- Superficies: `bg-white` con bordes `border-app-border` (#e2e8f0).
- Primario: `bg-primary` / `text-primary` (#2563EB).
- Acento institucional vino: `bg-accent` / `text-accent` (#5b040d), usado solo como acento puntual.
- Tipografía sobria con Inter / system-ui; títulos en `text-sm font-semibold` / `text-base font-semibold`.
- Bordes redondeados: `rounded-md`, `rounded-lg`, `rounded-xl`.
- Sombras mínimas o ninguna; sin gradientes, marcos decorativos ni animaciones de entrada.
- No se usan tokens legacy (`academic-*`, `brand-maroon`, `brand-blue`, `shadow-academic`).

## Componentes del UI Kit usados

- `PageHeader` para la cabecera del panel (`TeacherDeliveriesPanel`).
- `Button` para acciones principales y secundarias.
- `Tabs` para la navegación entre resumen, calificación e informe (`DeliveryDetailHeader`).
- `StatusBadge` para los pills de estado de entrega (`DeliveryDetailHeader`, `DeliveryStatusPill`, `DeliveryListItem`).
- `SearchInput` para la búsqueda de entregas (`DeliveriesSidebar`).
- `MetricCard` para métricas operativas (`DeliveriesSidebar`, `DeliveryOverview`).
- `EmptyState` para estados vacíos (`TeacherDeliveriesPanel`, `DeliveryGrading`, `DeliveryReport`).
- `DataTable` no se utiliza en este módulo porque la cola de entregas se renderiza como tarjetas navegables.

## Estructura de Directorios

- `components/`: Componentes visuales y de presentación específicos para la revisión de entregas.
- `hooks/`: Lógica de estado y llamadas a la API relacionadas con la gestión de entregas desde la perspectiva del profesor.

## Archivos del Directorio Raíz

- **`TeacherDeliveriesPanel.tsx`**: Es el componente principal (Vista) que actúa como un panel de control para las entregas. Los profesores utilizan esta pantalla para listar todas las entregas de un proyecto, filtrarlas (por estado, grupo, etc.) y seleccionar una para revisarla en detalle.
- **`README.md`**: Este archivo de documentación explicativa.
- **`teacherReviewNavigation.ts`**: Utilidad/lógica para manejar la navegación compleja entre diferentes entregas (por ejemplo, pasar a la "Siguiente entrega sin calificar" rápidamente).
- **`utils.ts`**: Funciones de ayuda general para el formateo de datos de entregas.
- **`imports.txt`**: Archivo de texto auxiliar (probablemente un registro temporal de dependencias o rutas relativas usadas en refactorizaciones).

## Archivos en `components/`

- **`DeliveriesSidebar.tsx`**: Barra lateral que muestra una lista navegable de todas las entregas para un proyecto seleccionado. Incluye filtros rápidos, búsqueda y métricas de la cola.
- **`DeliveryDetailHeader.tsx`**: Encabezado del área de revisión, mostrando información del estudiante/grupo, estado de la entrega y fecha de envío.
- **`DeliveryOverview.tsx`**: Componente de resumen general de una entrega seleccionada, mostrando los archivos adjuntos y los metadatos principales.
- **`DeliveryReport.tsx`**: Vista que renderiza el reporte de evaluación automática (si la hubo, como resultados de tests o análisis de código).
- **`DeliveryGrading.tsx`**: El formulario o interfaz donde el profesor introduce la calificación (nota final) y comentarios (feedback) manuales para el estudiante.
- **`DeliveryListItem.tsx`**: Representación individual (tarjeta) de una entrega dentro de la cola lateral.
- **`DeliveryStatusPill.tsx`**: Micro-componente (badge) que muestra el estado actual de la entrega. Ahora delega en el `StatusBadge` del UI Kit con los tonos institucionales.
- **`AssignmentLabel.tsx`**: Etiqueta visual para indicar si la entrega pertenece a un individuo o a un grupo.
- **`TeacherReviewSummary.tsx`**: Panel resumen que el profesor ve tras finalizar de evaluar todas las entregas de una tanda, y que también aparece en las vistas de calificación e informe.

## Archivos en `hooks/`

- **`useDeliveriesPanel.ts`**: Hook que maneja el estado local del panel del profesor (filtros, entrega actualmente seleccionada, ordenación).
- **`useDeliveryManagement.ts`**: Hook que interactúa con la API backend para obtener las entregas, descargar archivos adjuntos, y enviar las calificaciones o feedback al servidor.
