## Responsabilidad del Módulo
Interfaz visual (UI) y componentes para interactuar con el ecosistema Builder, incluyendo evaluación de código, calidad y feedback asistido por IA dentro de DockUS.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
No gestiona llamadas a API ni tipos de datos del dominio builder (responsabilidad de `features/builder/`). Tampoco define la interfaz principal del runtime de ejecución.

## Conceptos Clave (Glosario)
- **Builder**: Módulo o motor encargado de la evaluación, calidad (lint/test) y asistencia en la ejecución de código.
- **Evaluation/Quality**: Componentes que exponen los hallazgos y correcciones al usuario.
- **RunStatusStrip**: Lectura del run (ejecución, infraestructura, evaluación) en una sola superficie.
- **TimelinePanel**: La traza como raíl cronológico. Es el elemento característico del builder: aquí se gasta la atención visual y el resto de paneles se callan.
- **LiveConsolePanel**: Terminal real. El fondo oscuro es el medio de los logs, no decoración: no le añadas degradados ni glow.

## Convención visual
La voz de la máquina (estados, notas, ids, horas, comandos) va en mono con cifras tabulares vía
`.data-figure` / `.data-meta`; la voz humana (títulos y prosa) en Inter. El vino (`accent`) marca
identidad, el azul (`primary`) interacción, y verde/ámbar/rojo son semáforo de estado, nunca adorno.
La copia va en castellano: nada de "LLM Assessment" ni "Payload Data". Las etiquetas de dominio se
traducen en un único sitio (`confidenceLabel`, `PREFLIGHT_COMPATIBILITY_LABEL` en `liveRunUtils`),
no en cada componente.

## Dependencias Externas Clave
Depende de las interfaces y utilidades de `features/builder/` y hooks personalizados que abstraen las peticiones API del ecosistema builder.

## Efectos Secundarios (Side Effects)
Muestra paneles interactivos de evaluación que pueden reflejar cambios asíncronos originados por webhooks/streams o recargas (polling).

## Estado / BBDD
Estado local centrado en la visualización (tabs, paneles expandidos) y delegación del estado asíncrono a hooks específicos de `components/` o `hooks/`.

## Puntos de Entrada (Entrypoints)
- Componentes exportados desde `components/` e integrados en vistas como `TeacherRuntimePanel` o `StudentWorkspacePanel`.
