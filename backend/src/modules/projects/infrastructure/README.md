# Infraestructura de Proyectos (Projects Infrastructure Layer)

Este directorio representa la capa de Infraestructura en la arquitectura Hexagonal / DDD del módulo de proyectos. Su responsabilidad exclusiva es proporcionar implementaciones técnicas concretas para los "puertos" (interfaces) definidos en la capa de Dominio. 
Aquí es donde el código se acopla a las tecnologías específicas elegidas para el sistema, como ORMs (TypeORM, Prisma), clientes HTTP externos, sistemas de archivos o colas de mensajes.

## Estructura de Directorios

- `database/`: Contiene las implementaciones concretas de los repositorios de dominio que interactúan directamente con la base de datos (Data Access Layer).

## Archivos y Responsabilidades

### Directorio `database/` (Adaptadores de Persistencia)
Los archivos en este directorio son los "Adaptadores Secundarios" que conectan el dominio con el almacenamiento persistente.
- **`project.repository.ts`**: Implementa la interfaz `project.repository.interface.ts` definida en el Dominio. Contiene el código real que usa el ORM (por ejemplo, TypeORM o Prisma) para realizar consultas SQL/NoSQL, traducir modelos de dominio a entidades de base de datos y guardar proyectos físicos.
- **`build-run.repository.ts`**: Implementa la interfaz `build-run.repository.interface.ts`. Contiene la lógica específica de la base de datos para almacenar y recuperar registros sobre los intentos de construcción/ejecución (Build Runs) de los proyectos, gestionando el mapeo de datos.
