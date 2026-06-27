# Aplicación del Constructor de Proyectos (Builder Application Layer)

Este directorio contiene la capa de Aplicación para el submódulo `Builder` (Constructor de Proyectos con IA).
La función principal de esta capa es orquestar los Casos de Uso (Use Cases). Actúa como un coordinador: recibe las peticiones de la capa de Presentación, utiliza los servicios del Dominio (como la IA) para aplicar las reglas de negocio, y coordina con la Infraestructura (repositorios) para guardar los resultados. No contiene lógica de negocio pura, sino el "flujo de trabajo".

## Estructura de Directorios

La capa de aplicación está altamente estructurada dentro del directorio `services/`, dividiendo la lógica de coordinación en varias sub-áreas:

- `services/orchestration/`: Servicios encargados del flujo principal y la coordinación de alto nivel de las peticiones del constructor.
- `services/stages/`: Lógica de coordinación para las diferentes etapas o fases de la construcción de un proyecto guiado por IA (ej. fase de diseño, fase de implementación, revisión).
- `services/evaluation/`: Coordinación de los flujos de evaluación automatizada utilizando IA para validar el progreso.
- `services/compilation/`: Orquestación de procesos de compilación o empaquetado del proyecto una vez construido.
- `services/artifacts/`: Gestión de la generación de artefactos finales (archivos ZIP, repositorios) resultantes del proceso de construcción.
- `services/workspace/`: Orquestación del espacio de trabajo temporal donde ocurre la generación de código.
- `services/support/`: Servicios de aplicación auxiliares (ej. notificaciones, limpieza).

## Archivos y Responsabilidades

Dentro del directorio `services/` a nivel raíz de la aplicación se encuentran los tipos y definiciones compartidas:

- **`services/builder-application.types.ts`**: Define los tipos, interfaces de Data Transfer Objects (DTOs) internos, y firmas utilizadas explícitamente para la comunicación entre los servicios de esta capa de aplicación y la capa de presentación. Asegura un fuerte tipado en los flujos orquestados.
- **`services/README.md`**: (Opcional, si existe históricamente) Documentación específica de los servicios internos de orquestación.

*Nota:* Esta capa depende del Dominio del Builder (como los Parsers de IA) para ejecutar la inteligencia, y de los Repositorios de Infraestructura para persistir el estado de la construcción interactiva.
