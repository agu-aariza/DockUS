## Propósito de la carpeta
Contiene la lógica de dominio del Builder relacionada con Inteligencia Artificial (LLMs). Incluye constructores de prompts, parsers de los contratos (JSON devueltos por el LLM) y el mapeo de perfiles de modelo para diferentes tareas (ej. code quality, evaluation, planning).

## Límites y Reglas Estrictas
- Los parsers deben ser extremadamente robustos y tolerantes a fallos (usar Zod o similar), ya que las respuestas del LLM pueden no ser JSON perfectamente formateado o faltar campos.
- No inyectar infraestructura (como el cliente HTTP de Bedrock/Ollama). Eso se delega a `BuilderLlmChatService` o a capas de infraestructura.
- Las constantes de temperatura y perfiles de modelos deben residir aquí.

## Anti-Patrones y Gotchas ⚠️
- Confiar en que el LLM siempre devolverá un JSON válido de una forma específica. Siempre incluir lógica de "safe parsing" o "fallback".
- Hardcodear strings de prompts dentro de los controladores o servicios de aplicación. Todo el texto de los prompts debe ensamblarse en `builder-prompt-composer.ts` o clases similares en este directorio.

## Dependencias de Contexto Asumidas
- Los clientes externos LLM (Ollama, Bedrock) están configurados y accesibles a través de sus respectivos módulos.

## Inputs / Outputs Esperados
- Inputs: Trazas de ejecución, código del estudiante, recetas y specs.
- Outputs: Prompts formateados, o DTOs tipados (Contratos) extraídos de las respuestas de la IA.

## Ejemplo de uso
```typescript
const contract = parseBuilderEvaluationContractV2(llmResponseString);
```

## Formato de Archivos
- `*.parser.ts` para la extracción y sanitización de JSON de respuestas AI.
- `*.service.ts` para orquestar la comunicación con los LLMs (ej. `builder-llm-evaluator.service.ts`).
