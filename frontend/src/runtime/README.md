## Responsabilidad del Módulo
Interfaz para la configuración, monitorización y administración del entorno de ejecución (Runtime/Recetas) de los proyectos y contenedores utilizados por Builder.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No muestra la consola de ejecución al estudiante. No define el protocolo subyacente del Runtime.

## Conceptos Clave (Glosario)
- **TeacherRuntimePanel**: Panel para configurar qué entornos (ej. Node, Python, C) están disponibles y monitorizar recursos/ejecuciones activas.
- **Runtime Recipe**: Receta o plantilla de ejecución (imagen Docker + comandos).

## Dependencias Externas Clave
Interactúa con el estado y APIs de `features/runtime` y `features/builder` para leer el estado de ejecución y modificar configuraciones.

## Efectos Secundarios (Side Effects)
Envía configuraciones al backend que alterarán cómo se construyen o evalúan los proyectos futuros.

## Estado / BBDD
Maneja selecciones de entornos, configuraciones JSON visuales (si aplica) y actualización en vivo del estado de los runtimes.

## Puntos de Entrada (Entrypoints)
- `TeacherRuntimePanel.tsx`: Montado en `/runtime`.
