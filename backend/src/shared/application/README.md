# Aplicación compartida (`shared/application/`)

> **Resumen rápido:** El puerto `GroupRosterReader` y el servicio de eventos de matriculación — la única vía por la que `projects/` conoce las matrículas de `academic/` sin importar sus clases internas. Es la aplicación práctica de la regla "los módulos se comunican por interfaces/eventos, nunca importando clases internas de otro módulo".

---

## El problema que resuelve

`projects/assignments/` necesita saber "¿qué alumnos están matriculados en este grupo?" para poder crear asignaciones automáticamente. La solución ingenua sería que `assignments/` importara `GroupsService` de `academic/` directamente — pero eso crearía una dependencia dura entre dos módulos de dominio que deberían poder evolucionar por separado. En su lugar:

```text
academic/ (GroupsService)
     │  implementa
     ▼
GroupRosterReader (puerto definido AQUÍ, en shared/application/)
     │  + eventos vía
     ▼
GroupEnrollmentEventsService (también AQUÍ)
     │  consumido por
     ▼
projects/assignments/ (ProjectAssignmentGroupEnrollmentListener)
```

Ninguno de los dos módulos de dominio importa clases internas del otro — ambos dependen de esta capa intermedia neutral.

## Qué hay dentro

```text
application/
├── shared-application.module.ts    # Registra y exporta GroupEnrollmentEventsService
├── group-roster-reader.port.ts       # Interfaz GroupRosterReader + token GROUP_ROSTER_READER
└── group-enrollment-events.service.ts  # Emisor/registro de handlers para "alumnos matriculados en un grupo"
```

`group-roster-reader.port.ts` declara tres métodos: `listEnrollments(groupId)`, `listGroups()`, y `listGroupsForStudent(studentId)` — este último es, según su propio comentario en el código, "la vía por la que `projects/` conoce la matrícula de un alumno sin importar de `academic/`".

## Por qué esto vive en `shared/` y no en `academic/` o `projects/`

Si el puerto viviera dentro de `academic/`, `projects/` tendría que importar de `academic/` para usar el tipo de la interfaz — reintroduciendo el acoplamiento que se quería evitar. Al vivir en `shared/application/` (infraestructura transversal, no propiedad de ningún módulo de dominio concreto), ambos módulos importan de un tercero neutral.

## Cómo trabajar aquí

```bash
npm run test -- src/shared/application
```

Si dos módulos de dominio necesitan comunicarse y no quieres que se importen directamente, este es el patrón a replicar: define el puerto/evento aquí, que el módulo dueño de los datos lo implemente, y que el módulo consumidor dependa solo de la interfaz.

## Ver también

- [`../../modules/academic/README.md`](../../modules/academic/README.md) — quién implementa `GroupRosterReader`.
- [`../../modules/projects/assignments/README.md`](../../modules/projects/assignments/README.md) — quién consume los eventos.
