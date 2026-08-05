# DTOs de proyectos (`projects/dto/`)

> **Resumen rápido:** Las cuatro formas de payload/query que entran por los endpoints de `presentation/projects.controller.ts` y `project-gradebook.controller.ts`. Validadas con `class-validator`, transformadas con `class-transformer`, aplicadas automáticamente por el `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true` — cualquier campo no declarado en el DTO se rechaza, no se ignora).

---

## Los cuatro DTOs

```text
dto/
├── create-project.dto.ts              # CreateProjectDto, UpdateProjectDto, RubricCriterionDto[]
├── list-projects-query.dto.ts           # Filtros + paginación de GET /projects
├── project-progress-query.dto.ts          # Filtros de GET /projects/:id/progress-summary (incluye BuilderOutcome)
└── reconcile-operational-issues.dto.ts      # Payload de POST /projects/operational-issues/reconcile
```

`create-project.dto.ts` es el más grande: además del título y las fechas, `RubricCriterionDto[]` modela cada criterio de la rúbrica que luego se le pasa tal cual al prompt del evaluador LLM (ver `builder/domain/ai/`) — si cambias su forma aquí, revisa que el prompt de evaluación siga interpretándolo igual.

## Por qué esto importa más de lo que parece

Como el `ValidationPipe` global tiene `forbidNonWhitelisted: true`, un DTO mal declarado no es solo "menos type-safety" — es un **rechazo real en runtime** (`400 Bad Request`) de cualquier campo que el frontend mande y el DTO no declare. Si añades un campo nuevo a un formulario del frontend y el backend responde con `400` sin motivo aparente, el DTO de esta carpeta suele ser el primer sitio a revisar.

## Cómo trabajar aquí

```bash
npm run test -- src/modules/projects/dto
```

Al añadir un campo: decláralo con el decorador de `class-validator` que corresponda (`@IsString()`, `@IsOptional()`, `@IsUUID()`...) y, si se muestra en Swagger, añade `@ApiProperty()`/`@ApiPropertyOptional()` de `@nestjs/swagger` con un `example` — la documentación de `/api/docs` se genera a partir de estos decoradores, no se escribe a mano en otro sitio.

## Ver también

- [`../presentation/README.md`](../presentation/README.md) — los controladores que consumen estos DTOs.
- [`../../../shared/dto/README.md`](../../../shared/dto/README.md) — DTOs genéricos (paginación) reutilizados desde aquí.
