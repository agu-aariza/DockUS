# Infraestructura de proyectos (`projects/infrastructure/`)

> **Resumen rápido:** Las implementaciones TypeORM de los cuatro puertos declarados en `domain/`, más los helpers de "actor scope" que aplican visibilidad por rol directamente en la query SQL.

---

## Qué hay dentro

```text
infrastructure/database/
├── project.repository.ts                  # Implementa IProjectRepository
├── project-assignment.repository.ts          # Implementa IProjectAssignmentRepository
├── delivery.repository.ts                       # Implementa IDeliveryRepository
├── storage-object.repository.ts                    # Implementa IStorageObjectRepository
├── project-actor-scope.util.ts                        # applyProjectActorScope() — ver abajo
├── project-assignment-actor-scope.util.ts               # Misma idea, para ProjectAssignment
├── delivery-actor-scope.util.ts                            # Misma idea, para Delivery
└── storage-actor-scope.util.ts                                # Misma idea, para StorageObject
```

Cada `*.repository.ts` es una clase `@Injectable()` que implementa la interfaz correspondiente de `domain/repositories/`, inyecta un `Repository<Entidad>` de TypeORM (`@InjectRepository`), y se registra en el contenedor de NestJS con el token `Symbol` del puerto (p. ej. `{ provide: PROJECT_REPOSITORY, useClass: ProjectRepository }`) — así el resto del código pide `@Inject(PROJECT_REPOSITORY)` y nunca importa esta clase concreta directamente.

## Qué es el "actor scope" y por qué está aquí y no en `application/`

`STUDENT`, `TEACHER` y `ADMIN` ven subconjuntos distintos de proyectos/entregas: un alumno solo ve lo suyo, un profesor lo de los proyectos que administra, un admin todo. En vez de traer *todas* las filas a memoria y filtrar en el servicio de aplicación (ineficiente, y fácil de olvidar en un método nuevo), el filtro de visibilidad se aplica **directamente sobre el `SelectQueryBuilder`** antes de ejecutar la consulta — de ahí que estos helpers vivan en `infrastructure/`, la única capa que tiene acceso al `QueryBuilder` de TypeORM (`domain/` tiene prohibido importarlo, ver `.dependency-cruiser.cjs`, regla `no-domain-infra`).

```text
ProjectAccessService.findAllForActor(actor)
        │
        ▼
ProjectRepository.findAllForActor(actor)     ← implementa el puerto
        │
        ▼
applyProjectActorScope(queryBuilder, actor)  ← añade los WHERE de visibilidad según actor.role
        │
        ▼
queryBuilder.getMany()
```

`ProjectAccessService` (en la raíz de `projects/`) sigue siendo el punto de entrada de más alto nivel para la mayoría de llamadores; estos repositorios delegan en los mismos helpers de scope para no duplicar la lógica de visibilidad entre la consulta directa y el resto de casos de uso que también la necesitan (storage, deliveries).

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/infrastructure
```

Si añades una consulta nueva que deba respetar visibilidad por rol, reutiliza el helper `apply*ActorScope` correspondiente en vez de escribir un `WHERE` de permisos a mano — mantiene la regla de negocio "quién ve qué" en un único sitio por entidad.

## Ver también

- [`../domain/README.md`](../domain/README.md) — las interfaces que esto implementa.
- [`../README.md`](../README.md) — `ProjectAccessService`/`ProjectAccessPolicy`, el punto de entrada de más alto nivel para el control de acceso.
