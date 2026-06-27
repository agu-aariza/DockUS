# Dominio de Proyectos (Projects Domain Layer)

Este directorio constituye el núcleo (Core) de la arquitectura del módulo de proyectos, siguiendo las premisas del Domain-Driven Design (DDD). Aquí residen las entidades de negocio puras, las reglas de dominio, las excepciones específicas y los "puertos" (interfaces) que definen cómo el dominio espera interactuar con el mundo exterior (como las bases de datos).
Esta capa no debe tener ninguna dependencia de frameworks externos (como NestJS) ni de detalles de infraestructura (como TypeORM, Redis o HTTP).

## Estructura de Directorios

- `repositories/`: Contiene las interfaces (puertos secundarios) que definen los contratos para la persistencia de datos. El dominio dicta *qué* operaciones de almacenamiento se necesitan, no *cómo* se implementan.

## Archivos y Responsabilidades

### Directorio `repositories/` (Puertos de Infraestructura)
- **`project.repository.interface.ts`**: Define el contrato (interfaz) para persistir y recuperar entidades de proyectos. Establece los métodos requeridos como `findById`, `save`, `findAll`, abstracciones puras sin importar si detrás hay un PostgreSQL, MongoDB o memoria.
- **`build-run.repository.interface.ts`**: Define el contrato para persistir las ejecuciones de construcción o compilación asociadas a un proyecto. Permite al dominio solicitar la persistencia del estado de un entorno de ejecución sin acoplarse a la base de datos subyacente.
