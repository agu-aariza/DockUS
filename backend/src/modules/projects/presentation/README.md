## Propósito de la carpeta
Capa de Presentación (REST API) del módulo de Proyectos. Aloja los controladores de NestJS responsables de recibir las solicitudes HTTP, aplicar Guards/Interceptors y derivar la ejecución a los servicios de negocio correspondientes.

## Límites y Reglas Estrictas
- NUNCA incluir lógica de negocio aquí.
- TODO endpoint debe tener sus respectivos decoradores de Swagger (`@ApiOperation`, `@ApiResponse`).
- Los roles y permisos (`@Roles`, `@RequirePermissions`) deben ser definidos explícitamente en cada endpoint.

## Anti-Patrones y Gotchas ⚠️
- Interacciones directas con la base de datos o Repositorios desde el controlador.
- Capturar errores de forma genérica o atrapar excepciones de dominio sin mapearlas a `HttpException` de NestJS. (Se prefiere usar Exception Filters globales).

## Dependencias de Contexto Asumidas
- El Request de Express es inyectado. La información del usuario autenticado proviene del `@CurrentUser()` decorador.

## Inputs / Outputs Esperados
- Inputs: DTOs, Path params, Query params.
- Outputs: Promesas que resuelven los objetos a serializar como JSON.

## Ejemplo de uso
```typescript
@Get()
@ApiOperation({ summary: 'Listar proyectos' })
async findAll(@Query() query: ListProjectsQueryDto, @CurrentUser() user: AuthenticatedUser) {
  return this.projectsService.findAll(query, user);
}
```

## Formato de Archivos
- `*.controller.ts` (ej. `projects.controller.ts`, `deliveries.controller.ts`).
