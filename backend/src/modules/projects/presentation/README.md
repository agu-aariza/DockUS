# Presentación de proyectos (`projects/presentation/`)

> **Resumen rápido:** Los ocho controladores REST del módulo `projects/`. Cada uno cubre un sub-recurso distinto; ninguno contiene lógica de negocio — todos delegan en un servicio de `application/`/raíz del módulo tras validar el DTO de entrada.

---

## Los ocho controladores

| Controlador | Ruta base | Cubre |
| --- | --- | --- |
| `projects.controller.ts` | `/projects` | CRUD de proyectos, incidencias operativas (`operational-issues`). |
| `project-assignments.controller.ts` | `/projects/:id/assignments`, `/assignments/*` | Asignación de un proyecto a alumnos. |
| `project-teachers.controller.ts` | `/projects/:id/teachers` | Añadir/quitar profesores con permiso de administración sobre el proyecto. |
| `project-gradebook.controller.ts` | `/projects/:id/gradebook`, `.../progress-summary`, `.../quality-insights` | Notas, resumen de progreso e insights de calidad de código agregados. |
| `project-runtime.controller.ts` | `/projects/:id/runtime` | Estado de ejecución en vivo y reconciliación de incidencias de runtime. |
| `project-test-suite.controller.ts` | `/projects/:id/test-suite` | Subida de la suite de tests del profesor (usada por el Builder para validar entregas). |
| `student-profile.controller.ts` | `/students` | El expediente de un alumno a través de todos sus proyectos (`StudentProfileService`). |
| `deliveries.controller.ts` | `/deliveries` | CRUD de entregas — ver [`../deliveries/README.md`](../deliveries/README.md). |

## Por qué hay ocho controladores y no uno

Un único `ProjectsController` gigante mezclaría permisos y casos de uso muy distintos (un alumno consultando su propio expediente no tiene nada que ver con un profesor exportando el libro de notas en CSV). Separarlos por sub-recurso mantiene cada controlador corto, con un único nivel de `@Roles(...)` claro, y permite que Swagger los agrupe visualmente por `@ApiTags(...)`.

## El patrón que siguen todos

```typescript
@Controller('recurso')
@UseGuards(JwtAuthGuard, RolesGuard)
export class XController {
  constructor(private readonly xService: XService) {}

  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateXDto, @Req() request: AuthenticatedRequest) {
    return this.xService.create(dto, request.user);
  }
}
```

El controlador: aplica los guards de autenticación/rol, valida el DTO (automático vía `ValidationPipe` global), y pasa `request.user` (la identidad ya resuelta por `JwtStrategy`) al servicio para que **el servicio**, no el controlador, decida los detalles finos de autorización (p. ej. "solo el profesor asignado a *este* proyecto concreto").

## Qué NO vive aquí

- **Ninguna llamada a Docker, MinIO o al LLM directamente.** Un controlador que necesite algo de `builder/` pasa por sus servicios de aplicación, nunca por `shared/infrastructure/` directamente — es una de las reglas verificadas por `npm run boundaries` (`no-presentation-infra`).
- **Ninguna consulta SQL/`QueryBuilder`.** Eso vive en `infrastructure/database/`.

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/presentation
```

Al añadir un endpoint: decide primero a qué controlador pertenece por sub-recurso (no lo metas en `projects.controller.ts` "porque ya existe"), documenta con `@ApiOperation`/`@ApiResponse` (alimenta `/api/docs`), y usa los DTOs de [`../dto/README.md`](../dto/README.md) para la validación de entrada.

## Ver también

- [`../README.md`](../README.md) — visión general del módulo `projects/`.
- [`../../auth/README.md`](../../auth/README.md) — `JwtAuthGuard`/`RolesGuard`/`@Roles(...)` usados por todos estos controladores.
