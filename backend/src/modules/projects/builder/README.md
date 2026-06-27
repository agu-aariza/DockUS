# Módulo del Constructor de Proyectos (Project Builder Module)

Este subdirectorio alberga el submódulo `Builder`, una pieza fundamental y compleja dentro del sistema de proyectos. Su propósito es proporcionar las herramientas, asistentes de Inteligencia Artificial y flujos de trabajo necesarios para ayudar a los profesores o creadores de contenido a diseñar, estructurar y construir proyectos educativos completos de forma iterativa y guiada.

Al ser un dominio con mucha complejidad, sigue estrictamente los principios de Domain-Driven Design (DDD).

## Estructura de Directorios (DDD)

El constructor está dividido en capas arquitectónicas bien definidas:

- `application/`: Capa de aplicación. Contiene los Casos de Uso (Use Cases) o Command/Query Handlers. Coordina el flujo de información desde la interfaz de usuario (presentation) hacia el dominio, sin contener reglas de negocio.
- `domain/`: Capa de dominio. El corazón del Builder. Contiene las reglas de negocio, modelos (como los perfiles de IA, planes de construcción, contratos), interfaces (puertos) y excepciones específicas de la construcción de proyectos. Es independiente de frameworks y tecnologías externas.
- `infrastructure/`: Capa de infraestructura. Implementa los puertos definidos en el dominio (ej. adaptadores para conectar con las APIs de LLMs como OpenAI, Anthropic, repositorios de bases de datos para guardar el progreso de construcción).
- `presentation/`: Capa de presentación. Controladores REST, WebSockets o GraphQL específicos para el proceso de construcción de proyectos, manejando las interacciones iterativas del usuario con el asistente.

## Archivos del Directorio Raíz

- **`builder.module.ts`**: Archivo de configuración del submódulo en NestJS. Registra todos los controladores de la capa de presentación, orquesta las dependencias inyectando las implementaciones de la capa de infraestructura en los casos de uso de la capa de aplicación. Encapsula toda la funcionalidad del Builder para ser consumida por el módulo padre (`projects.module.ts`).
