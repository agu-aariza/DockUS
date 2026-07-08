## Propósito de la carpeta
Contiene los sub-servicios de la capa de aplicación del Builder, categorizados por dominio (compilation, evaluation, orchestration, stages, support, workspace). 

## Límites y Reglas Estrictas
- Se permite inyectar servicios entre subcarpetas de `application/services` si no forman ciclos de dependencia, aunque lo ideal es que un orquestador principal (ej. `BuilderRunCommandsService`) ensamble los pasos.
- Nunca incluir lógica de TypeORM u otras infraestructuras directamente aquí.
- Solo pueden depender de interfaces del dominio y otros servicios de aplicación.

## Anti-Patrones y Gotchas ⚠️
- No acoplar lógicamente los diferentes "stages" entre sí; deben poder ejecutarse de forma aislada a partir del contexto del `BuildRun`.
- No capturar errores y fallar silenciosamente; todos los fallos deben propagarse para que el orquestador actualice el estado del BuildRun a `FAILED`.

## Dependencias de Contexto Asumidas
- La persistencia y el Docker daemon son inyectados y están listos.

## Inputs / Outputs Esperados
- Inputs: Contexto y DTOs de estado de la evaluación.
- Outputs: Operaciones asíncronas de efecto secundario, actualización de trazas.

## Ejemplo de uso
```typescript
await this.builderWorkspaceService.prepareWorkspace(run.id, sourceCodeBuffer);
```

## Formato de Archivos
- `*.service.ts` para servicios que ejecutan casos de uso.
- Estructurados en carpetas semánticas por responsabilidad.
