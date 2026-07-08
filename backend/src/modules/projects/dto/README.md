## Propósito de la carpeta
Contiene los Data Transfer Objects (DTOs) utilizados en el módulo de Projects para validar y tipar las peticiones de entrada y salida de los endpoints REST.

## Límites y Reglas Estrictas
- Todos los DTOs deben usar decoradores de `class-validator` y `class-transformer`.
- Ningún DTO debe contener lógica de negocio; son puros sacos de datos.
- Las respuestas (Response DTOs) también se definen aquí si son complejas.

## Anti-Patrones y Gotchas ⚠️
- Olvidar poner `@Type(() => Number)` o similar cuando se usa `@IsNumber()` en Query parameters (que vienen como string).
- Importar entidades de base de datos dentro de los DTOs.

## Dependencias de Contexto Asumidas
- Se asume el uso del `ValidationPipe` global de NestJS para parsear estas clases en tiempo de ejecución.

## Inputs / Outputs Esperados
- Inputs: Objetos planos procedentes de JSON o query strings.
- Outputs: Instancias de clases validadas.

## Ejemplo de uso
```typescript
@Post()
create(@Body() createProjectDto: CreateProjectDto) {
  return this.projectsService.create(createProjectDto);
}
```

## Formato de Archivos
- `*.dto.ts` (ej. `create-project.dto.ts`, `list-projects-query.dto.ts`).
