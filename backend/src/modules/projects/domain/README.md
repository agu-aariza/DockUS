# Dominio de proyectos (`projects/domain/`)

> **Resumen rápido:** Solo interfaces — los cuatro puertos de repositorio de este módulo (`IProjectRepository`, `IDeliveryRepository`, `IProjectAssignmentRepository`, `IStorageObjectRepository`). Ninguna lógica de negocio vive aquí; eso está en los servicios de `application/`/raíz del módulo. Sin dependencias de TypeORM, Express o NestJS.

---

## Qué es (y qué no es) un "puerto" aquí

Cada fichero de `repositories/` declara: una interfaz (`I<Entidad>Repository`) con los métodos de persistencia que el resto del módulo necesita, un `Symbol` exportado (p. ej. `PROJECT_REPOSITORY`) usado como token de inyección de dependencias, y tipos auxiliares de entrada/salida (`New<Entidad>Data`, `<Entidad>ListQuery`, `<Entidad>ListPage`) que evitan que la interfaz exponga tipos de TypeORM (`FindOneOptions`, `SelectQueryBuilder`) — así el resto del código depende de una forma de datos propia del dominio, no de los detalles de la librería ORM.

La implementación real de cada interfaz vive en [`../infrastructure/README.md`](../infrastructure/README.md), no aquí. `domain/` **no sabe que Postgres existe**.

## Los cuatro puertos

```text
domain/repositories/
├── project.repository.interface.ts             # IProjectRepository — CRUD + findAllForActor/findByIdForActor (con scoping)
├── delivery.repository.interface.ts               # IDeliveryRepository — CRUD + listado paginado
├── project-assignment.repository.interface.ts       # IProjectAssignmentRepository — asignar, revocar, sync desde grupos
└── storage-object.repository.interface.ts              # IStorageObjectRepository — metadatos de ficheros subidos
```

Nota importante para quien llega de otros lenguajes/arquitecturas: **esto no es "domain-driven design" con entidades ricas y value objects** — las entidades reales (`Project`, `Delivery`...) son objetos TypeORM planos que viven en `entities/`, no aquí. `domain/` en este módulo es, específicamente, la capa de puertos de persistencia — sigue la convención descrita en la raíz del backend, pero su contenido concreto en `projects/` está limitado a esto.

## Convención: las transacciones viven en el adaptador, no en la aplicación

Una operación que debe ser atómica (p. ej. matricular 30 alumnos a la vez) se expresa como **un único método** en la interfaz del puerto — la transacción concreta (`queryRunner`, `manager.transaction(...)`) vive dentro del adaptador de `infrastructure/database/` que implementa ese método, nunca en la capa de aplicación que lo llama. Ver `docs/DESIGN_DECISIONS.md` (decisión D-15); el caso de referencia es `IGroupEnrollmentRepository.bulkEnroll` en `academic/`.

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/domain
npm run boundaries   # falla si domain/ importa TypeORM directamente
```

Si añades un método nuevo a un puerto, recuerda: (1) añádelo a la interfaz aquí, (2) impleméntalo en el adaptador de `infrastructure/database/`, (3) si necesita "scoping" por actor (ver `project-actor-scope.util.ts`), reutiliza ese helper en vez de reescribir el filtro de visibilidad a mano.

## Ver también

- [`../infrastructure/README.md`](../infrastructure/README.md) — las implementaciones concretas.
- [`../entities/README.md`](../entities/README.md) — las entidades TypeORM reales.
