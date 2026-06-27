# Frontend: Shared Workspace

## Descripción General
El módulo `shared/workspace` contiene los componentes y contextos React transversales utilizados para renderizar el Entorno de Trabajo (Workspace) principal de DockUS. Esta es la vista donde los usuarios interactúan con sus proyectos, ven archivos, interactúan con terminales y gestionan el ciclo de vida de la ejecución de sus entornos (Docker/Runners).

## Árbol de Directorios
```text
workspace/
├── README.md
├── WorkspaceBar.tsx
└── WorkspaceContext.tsx
```

## Detalle Exhaustivo de Ficheros

- **`WorkspaceContext.tsx`**
  - **Propósito:** Proveedor de estado global (React Context) para la sesión del Workspace.
  - **Responsabilidad:** Mantiene y distribuye el estado efímero del IDE/Workspace en el navegador del usuario. Maneja información como el archivo actualmente abierto, el estado de la conexión WebSocket con el backend, el estado de los paneles (abiertos/cerrados) y la información del entorno aprovisionado. Permite que cualquier componente hijo consuma este estado sin necesidad de *prop-drilling*.
  - **Conexiones:** Envuelve a nivel superior las vistas de edición (como el editor de código, la terminal y la barra de herramientas).

- **`WorkspaceBar.tsx`**
  - **Propósito:** Componente visual (Toolbar / Header) del entorno de trabajo.
  - **Responsabilidad:** 
    - Renderiza la barra superior de acciones dentro de un proyecto.
    - Contiene los botones de control de ciclo de vida del contenedor: "Run" (Iniciar runtime), "Stop" (Detener), "Build", etc.
    - Muestra métricas rápidas de uso (ej. estado de la conexión, latencia o consumo).
    - Permite alternar la visibilidad de los distintos paneles (explorador de archivos, terminal, panel de previsualización web).
  - **Conexiones:** Consume el `WorkspaceContext` para reflejar el estado real (por ejemplo, deshabilitar el botón "Play" si el contenedor ya está corriendo) y llama a hooks de mutación (ej. `useRuntimeManagement` o peticiones a la API del Workspace) para ejecutar comandos en el backend.

## Información para la IA
Cuando se realicen modificaciones en la interfaz del Workspace, el flujo de datos siempre debe ser unidireccional a través del `WorkspaceContext.tsx`. Evitar almacenar estado local crítico en el `WorkspaceBar.tsx` si este estado debe ser reaccionado por la Terminal o el Editor de Código. El diseño debe mantener componentes funcionales puros (React Hooks) y usar TailwindCSS (u hojas de estilo definidas) respetando el sistema de diseño "Glassmorphism/Academic" (basado en colores *brand-maroon*, *brand-cream*, etc.).
