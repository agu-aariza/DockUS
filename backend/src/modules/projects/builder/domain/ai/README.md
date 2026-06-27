# Dominio de Inteligencia Artificial del Builder (Builder AI Domain)

Este directorio contiene la lógica de dominio central para integrar capacidades de Inteligencia Artificial (LLMs - Large Language Models) dentro del proceso de creación de proyectos. Define cómo el sistema se comunica, evalúa y estructura las respuestas de la IA sin atarse a ningún proveedor específico.

## Estructura de Directorios

- `parsers/`: Subdirectorio que contiene utilidades o clases especializadas en analizar y transformar (parsear) las respuestas en bruto o semi-estructuradas de los modelos de lenguaje hacia objetos de dominio fuertemente tipados.

## Archivos y Responsabilidades

Esta carpeta contiene servicios de dominio, parsers de contratos y configuraciones para orquestar la IA:

### Servicios Centrales de IA
- **`builder-llm-chat.service.ts`**: Servicio de dominio que maneja la interacción conversacional (chat) con el modelo de lenguaje. Mantiene el contexto, maneja los historiales de mensajes y orquesta la comunicación de ida y vuelta para asistir al usuario en la creación.
- **`builder-llm-chat.service.spec.ts`**: Pruebas unitarias para el servicio de chat, asegurando el manejo correcto del estado de la conversación.
- **`builder-llm-evaluator.service.ts`**: Servicio encargado de evaluar el contenido generado o propuesto. Puede usar la IA para auto-evaluar (reflection) planes de proyectos o código, aplicando heurísticas de validación antes de presentarlo al usuario.
- **`builder-llm-evaluator.service.spec.ts`**: Pruebas para la lógica de evaluación de la IA.
- **`builder-code-quality.service.ts`**: Servicio dedicado a analizar la calidad del código, infraestructura o configuraciones propuestas durante la construcción del proyecto, apoyándose en las capacidades analíticas de la IA.
- **`builder-code-quality.service.spec.ts`**: Pruebas unitarias para el análisis de calidad.

### Parsers y Contratos (Estructuración de Salidas)
Los "Contracts" (Contratos) aseguran que el LLM devuelva la información en un formato JSON específico que el sistema puede entender. Los "Parsers" validan e instancian estas respuestas.
- **`builder-plan-contract.parser.ts`**: Se encarga de analizar y validar la respuesta de la IA cuando se le pide que genere un "Plan de Proyecto" estructurado (hitos, tareas, objetivos).
- **`builder-plan-contract.parser.spec.ts`**: Pruebas exhaustivas (notar el tamaño de archivo mayor) para asegurar que el parser maneje correctamente salidas de IA malformadas, parciales o correctas del plan.
- **`builder-evaluation-contract.parser.ts`**: Analiza las salidas de la IA relacionadas con rúbricas de evaluación o criterios de corrección, asegurando que cumplan el esquema esperado.
- **`builder-evaluation-contract.parser.spec.ts`**: Pruebas unitarias para el parser de contratos de evaluación.
- **`builder-code-quality-contract.parser.ts`**: Valida y extrae métricas o reportes de calidad de código estructurados a partir de la respuesta en texto del LLM.
- **`builder-code-quality-contract.parser.spec.ts`**: Pruebas unitarias del parser de calidad de código.

### Utilidades y Perfiles
- **`builder-prompt-composer.ts`**: Clase vital responsable de construir (ensamblar) los "Prompts" (instrucciones) complejos que se enviarán al LLM. Inyecta contexto dinámico, reglas del sistema y restricciones para garantizar la mejor respuesta posible.
- **`builder-prompt-composer.spec.ts`**: Pruebas unitarias para asegurar que los prompts se ensamblen correctamente bajo diferentes condiciones.
- **`builder-llm-model-profile.ts`**: Define los perfiles o configuraciones de los diferentes modelos LLM soportados (ej. temperatura, max tokens, system prompts base, capacidades específicas del modelo). Sirve como abstracción sobre las características del modelo.
- **`builder-llm-trace.util.ts`**: Utilidad para trazabilidad (tracing) y observabilidad. Ayuda a registrar (loggear) los tiempos de respuesta, uso de tokens y latencias de las peticiones a la IA para monitoreo y depuración.
