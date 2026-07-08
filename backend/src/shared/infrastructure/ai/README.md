## Responsabilidad del Módulo
Abstraer la generación de texto con modelos de lenguaje (LLM), proporcionando una interfaz común para interactuar con AWS Bedrock Runtime. También gestiona la carga y parseo de todos los prompts usados en el sistema.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- NO contiene prompts hardcodeados en el código TypeScript (todo va en `prompts.json`).
- NO incluye lógica de negocio ni flujos de evaluación (eso pertenece al módulo Builder o similares).
- NO se comunica con Ollama u otros proveedores de LLM descartados.

## Conceptos Clave (Glosario)
- **Prompt Bundle**: Conjunto de instrucciones estructuradas (`role`, `task`, `hard_rules`, `schema_contract`) que definen cómo el LLM debe comportarse.
- **Model Profile**: La configuración de parámetros como temperatura, id del modelo y versión.

## Dependencias Externas Clave
- **AWS Bedrock Runtime SDK**: Para la inferencia y consumo de modelos Claude u otros configurados en AWS.

## Efectos Secundarios (Side Effects)
- Consume cuotas y presupuesto de AWS Bedrock.
- Efectúa llamadas HTTP de red que pueden sufrir timeouts.

## Estado / BBDD
- No maneja persistencia en base de datos.
- Mantiene el registro de prompts cargados en memoria desde `prompts.json`.

## Puntos de Entrada (Entrypoints)
- `BedrockGenerationService`: Implementación concreta del cliente LLM.
- `PromptRegistryService`: Para obtener y procesar prompts.
- Interfaz `ILlmGenerationService` importada por `llm-generation.token.ts`.
