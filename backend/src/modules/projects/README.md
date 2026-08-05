# Módulo de proyectos (`projects/`)

> **Resumen rápido:** El módulo de dominio más grande del backend. Modela un "proyecto" docente (enunciado, rúbrica, plazos), quién puede entregarlo (`assignments/`), lo que un alumno sube (`deliveries/` + `storage/`), y contiene el subsistema que realmente ejecuta y califica el código (`builder/`). Los servicios en la raíz de este directorio (sin subcarpeta) orquestan entre esas piezas.

---

## El concepto central: `Project`

Un `Project` (`entities/project.entity.ts`) es la definición de una práctica: título, `rubricInstructions` (las instrucciones que se le pasan al LLM evaluador), `expectedType` (p. ej. `PYTHON_FASTAPI`, una pista sobre la tecnología esperada), fechas de apertura/cierre y `maxDeliveriesPerStudent`. Lo crea un profesor. Por sí solo, un `Project` no tiene alumnos — necesita una `ProjectAssignment` (ver `assignments/`) que lo vincule a un alumno concreto (normalmente generada en bloque a partir de la matriculación de un grupo académico completo, vía el evento que escucha `assignments/`).

## Los servicios "sueltos" en la raíz de `projects/`

A diferencia de otros módulos, `projects/` tiene varios servicios de aplicación en su raíz (no dentro de `application/`) porque orquestan **entre** submódulos y no encajan limpiamente en uno solo:

| Servicio | Responsabilidad |
| --- | --- |
| `projects.service.ts` | Fachada CRUD básica sobre `Project`. |
| `project-lifecycle.service.ts` | Crear/actualizar un proyecto, incluida su rúbrica (`RubricCriterionDto[]`). |
| `project-access.service.ts` + `project-access.policy.ts` | La regla "¿puede este usuario administrar este proyecto?" (`ADMIN`, o `TEACHER` asignado a él) — centralizada aquí para no duplicarla entre el propio proyecto y su suite docente de tests. |
| `project-gradebook.service.ts` | Vista "de proyecto a alumnos": el libro de notas — para cada asignación, su última entrega y el resultado del Builder. |
| `student-profile.service.ts` | Vista "de alumno a proyectos" (el eje inverso al gradebook): cómo le va a un alumno concreto en todo el curso. Los runs de un alumno se resuelven siempre vía `BuildRun.deliveryId → Delivery.assignmentId → ProjectAssignment.studentId`, nunca por `triggeredById` (quien lanza el run es el profesor, no el alumno). |
| `project-operational-issues.service.ts` | Herramienta de diagnóstico para `ADMIN`: detecta entregas/asignaciones en estado inconsistente. Es la **única** excepción documentada dentro de `projects/` que hace SQL/`QueryBuilder` directo sobre tablas de varios submódulos en vez de pasar por los puertos de repositorio — está fuera del grafo de relaciones normal de TypeORM. |

## Estructura interna

```text
projects/
├── projects.module.ts                    # Composición: importa academic/, registra los sub-módulos de abajo
├── project-persistence.module.ts           # Registra los repositorios TypeORM de Project vía TypeOrmModule.forFeature
├── projects.types.ts                        # Tipos compartidos re-exportados desde @educodeai/contracts
├── projects.service.ts                        # (ver tabla arriba)
├── project-lifecycle.service.ts                 # (ver tabla arriba)
├── project-access.service.ts + .policy.ts          # (ver tabla arriba)
├── project-gradebook.service.ts                      # (ver tabla arriba)
├── student-profile.service.ts                          # (ver tabla arriba)
├── project-operational-issues.service.ts                 # (ver tabla arriba)
├── entities/            # SOLO project.entity.ts (tabla `projects`) — ver entities/README.md
├── domain/               # Interfaces de repositorio (puertos) de Project/Delivery/Assignment/Storage
├── dto/                    # DTOs de proyectos: crear, listar, progreso, reconciliar incidencias
├── infrastructure/database/  # Implementaciones TypeORM de los puertos de domain/
├── presentation/            # Los 8 controladores REST del módulo (proyectos, entregas, notas, runtime, tests...)
├── assignments/               # Vínculo Project ↔ alumno — ver assignments/README.md
├── deliveries/                  # Lo que un alumno entrega — ver deliveries/README.md
├── storage/                       # Subida/descarga de ficheros de entregas — ver storage/README.md
└── builder/                         # El motor de evaluación — ver builder/README.md (el subsistema más grande del repo)
```

## Cómo encaja todo: el recorrido de una entrega

```text
1. Profesor crea un Project (project-lifecycle.service.ts)
2. Profesor asigna el Project a un grupo → se crean ProjectAssignment por alumno (assignments/)
3. Alumno sube su código → storage/ lo valida y persiste en MinIO, deliveries/ crea la Delivery
4. Profesor (o el alumno, según configuración) lanza la evaluación → builder/ toma el relevo
5. builder/ ejecuta el código en Docker, evalúa con LLM, persiste un BuildRun
6. project-gradebook.service.ts / student-profile.service.ts leen ese resultado para mostrar notas
```

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects              # todo el módulo, incluido builder/
npm run test -- src/modules/projects --testPathIgnorePatterns=builder  # todo menos el motor de evaluación
```

## Ver también

- [`builder/README.md`](builder/README.md) — el motor de evaluación, léelo aparte por su tamaño.
- [`assignments/README.md`](assignments/README.md), [`deliveries/README.md`](deliveries/README.md), [`storage/README.md`](storage/README.md)
- [`domain/README.md`](domain/README.md), [`entities/README.md`](entities/README.md), [`infrastructure/README.md`](infrastructure/README.md), [`presentation/README.md`](presentation/README.md), [`dto/README.md`](dto/README.md)
