# Frontend: Builder

## Descripción General
El módulo `builder` se encarga de la interfaz gráfica para visualizar, orquestar y auditar la construcción (builds) de entornos y proyectos en DockUS. Este módulo actúa como el cliente visual para el sistema de CI/CD interno o los pipelines de compilación que transforman el código fuente en contenedores listos para ejecutarse.

## Árbol de Directorios
```text
builder/
├── README.md
├── components/
│   ├── BuilderLiveRunPane.tsx
│   ├── BuilderRunsTable.tsx
│   └── QualityInsightsDashboard.tsx
├── hooks/
│   └── useBuilderRunStream.ts
└── utils.ts
```

## Detalle Exhaustivo de Ficheros

### 1. Componentes Visuales (`components/`)
- **`BuilderLiveRunPane.tsx`**
  - **Propósito:** Panel en tiempo real de una compilación activa.
  - **Responsabilidad:** Se suscribe a los eventos (usualmente WebSockets o SSE) generados por el backend (Docker / Builder). Muestra la salida del log (stdout/stderr) en una terminal de solo lectura de forma reactiva, indicando el progreso actual, los pasos de la construcción de la imagen y posibles errores en tiempo real.
- **`BuilderRunsTable.tsx`**
  - **Propósito:** Historial tabular de ejecuciones (builds).
  - **Responsabilidad:** Renderiza una tabla o listado de todas las compilaciones anteriores asociadas a un proyecto o usuario. Muestra metadatos como fecha, duración, rama/commit asociado, y el estado final (Éxito, Fallo, Interrumpido). Permite navegar al detalle de un build específico.
- **`QualityInsightsDashboard.tsx`**
  - **Propósito:** Tablero de métricas de calidad post-compilación.
  - **Responsabilidad:** Muestra resultados de análisis estático (linting), cobertura de código (coverage), detección de vulnerabilidades, u otras métricas generadas durante la fase de "build". Presenta esta información visualmente mediante gráficos o tarjetas de resumen.

### 2. Hooks Personalizados (`hooks/`)
- **`useBuilderRunStream.ts`**
  - **Propósito:** Encapsular la lógica de conexión asíncrona para streaming.
  - **Responsabilidad:** Maneja la conexión WebSockets/SSE con el backend. Gestiona la reconexión automática, la acumulación de logs en un buffer de estado de React, y expone los datos al `BuilderLiveRunPane.tsx`. Centraliza la lógica de desmontaje (cleanup) para evitar fugas de memoria (memory leaks).

### 3. Utilidades (`utils.ts`)
- **`utils.ts`**
  - **Propósito:** Funciones de formateo auxiliares.
  - **Responsabilidad:** Parsea timestamps, da formato a bytes (KB, MB), y colorea la salida de consola (parseando ANSI escape codes si es necesario para el visualizador de logs).

## Información para la IA
Este módulo es de **alta frecuencia de actualización**. Debido a la naturaleza reactiva de los logs de compilación (`useBuilderRunStream.ts`), el rendimiento es clave. Evitar renderizados completos e innecesarios de componentes padre cuando se añade una nueva línea al log. Usar siempre memoización (`React.memo`, `useMemo`, `useCallback`) al inyectar logs en el `BuilderLiveRunPane`.
