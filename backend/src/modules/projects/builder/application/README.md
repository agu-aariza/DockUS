## Propósito de la carpeta
Contiene los casos de uso (Application Layer) del motor Builder. Aquí reside la lógica de negocio que orquesta la preparación de workspaces, la ejecución de comandos en Docker, la recolección de métricas de calidad y la evaluación mediante IA.

## Límites y Reglas Estrictas
- Esta capa de aplicación NO debe tener dependencias de infraestructura directa (ej. importaciones de TypeORM u controladores NestJS REST).
- Debe orquestar las operaciones apoyándose en los servicios de dominio e infraestructura inyectados.
- Todas las operaciones intensivas deben estar encapsuladas en servicios discretos.

## Anti-Patrones y Gotchas ⚠️
- No acoplar esta lógica al ciclo HTTP request/response, ya que la mayor parte de estas tareas se ejecutan en background workers (BullMQ).
- Cuidado con dejar contenedores o recursos de Docker "huérfanos". Siempre debe haber manejo de errores que limpie los workspaces.

## Dependencias de Contexto Asumidas
- Se asume que Redis/BullMQ están activos para encolar los jobs.
- Docker daemon debe estar disponible.

## Inputs / Outputs Esperados
- Inputs: IDs de entrega, recetas de ejecución y metadatos del estudiante.
- Outputs: Objetos de estado del run (`BuildRunResponseDto`), reportes y trazas de ejecución.

## Ejemplo de uso
```typescript
await this.builderRunCommandsService.executeRecipe(runId, recipeConfig);
```

## Formato de Archivos
- Clases `*Service` que implementan un caso de uso específico o un paso en el pipeline de evaluación (ej. `BuilderWorkspaceService`, `BuilderCodeQualityService`).
