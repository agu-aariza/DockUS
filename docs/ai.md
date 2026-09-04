# Arquitectura de IA

## Qué papel tiene la IA

La IA interpreta el contexto de una asignación y ayuda a producir una evaluación explicable. No sustituye los hechos observables de la ejecución ni la decisión académica del docente. El pipeline combina contratos estructurados, ejecución real, validaciones deterministas y texto generado.

```text
PromptRegistry + contexto acotado
              │
              ▼
       LLM evaluator / quality
              │ JSON estructurado
              ▼
     parser + contrato + guardrails
              │
              ├── evaluación y rúbrica
              ├── hallazgos de calidad
              └── narrativa del informe v3
```

## Etapas y roles lógicos

| Rol lógico | Etapas | Propósito |
| --- | --- | --- |
| `planner` | `plan` | proponer runtime, receta, comandos y estrategia de tests |
| `eval` | `facts`, `evaluation`, `reporting` | extraer hechos, evaluar contra la rúbrica y redactar narrativa |
| `quality` | `quality` | detectar problemas de mantenibilidad, diseño o claridad |
| `chatbot` | `chat` | responder preguntas pedagógicas sobre el resultado |

`BuilderLlmEvaluatorService` usa un `PromptRegistry`, limita el tamaño de cada entrada por etapa y exige respuestas JSON. Si el JSON no se puede parsear, reintenta el contrato una vez; cada intento queda trazado con snapshot del prompt, respuesta cruda, contrato parseado, error y uso de tokens. La calidad tiene su propio contrato y, si falla, degrada la etapa con un warning visible sin destruir una evaluación válida.

## Proveedores y adaptadores

El router soporta los identificadores `bedrock`, `azure`, `openai`, `anthropic`, `gemini` y `ollama`:

| Ruta | Adaptador |
| --- | --- |
| Bedrock | AWS Converse API |
| OpenAI, Azure, Ollama | API compatible con OpenAI; Azure añade deployment y API version |
| Anthropic | `/v1/messages` |
| Gemini | `generateContent` con MIME JSON |

La configuración persistida en PostgreSQL es la fuente de verdad por rol. Si no hay un proveedor configurado, Bedrock puede actuar como fallback mediante variables de entorno. Cada candidato conserva su propio modelo, endpoint, temperatura y límites.

## Dispatcher, failover y circuit breaker

El dispatcher ordena los candidatos con el primario primero. Salta un circuito abierto cuando existe una alternativa y hace failover solo ante indisponibilidad: throttling, errores de conectividad o HTTP 5xx. Un contrato inválido, credenciales ausentes o un modelo no encontrado no se ocultan con un failover silencioso: requieren corregir configuración o datos.

El circuit breaker usa Redis para contar fallos por proveedor dentro de una ventana y abrir el circuito durante un cooldown. Si Redis no está disponible, el comportamiento es fail-open para no convertir la caída del mecanismo de protección en una caída total de la evaluación.

## Contratos y guardrails

- Plan, facts, evaluación, quality y reporting se validan como contratos JSON, no como texto libre.
- El guard de alucinaciones compara afirmaciones con stdout/stderr, logs de build, salida esperada y valores numéricos reales.
- La nota y el outcome se resuelven desde la evaluación y la rúbrica; reporting solo aporta narrativa.
- La proyección para alumno filtra artefactos internos, prompts, respuestas crudas, tests docentes y mensajes de staff.
- La vista docente puede incluir propuesta provisional de IA, evidencias, hallazgos, flags de revisión y la vista exacta que verá el alumno.

## Contexto que recibe el modelo

El evaluador recibe, según la etapa, una combinación acotada de:

- instrucciones de la asignación y criterios de la rúbrica;
- código fuente seleccionado por whitelist;
- plan y receta de runtime;
- hechos extraídos de la ejecución;
- stdout, stderr, exit code, timeouts y evidencias;
- hallazgos de calidad para construir feedback.

Los límites de entrada, tokens, timeout, temperatura, modelos y reintentos se configuran por variables `BUILDER_LLM_*`, perfiles de modelo y configuración de proveedor. El valor efectivo debe comprobarse en [`.env.example`](../.env.example).

## Credenciales y endpoints

- Las claves configuradas por el administrador se cifran con AES-256-GCM; la clave maestra procede de `LLM_CREDENTIALS_SECRET` mediante scrypt.
- Las respuestas de configuración exponen solo `hasApiKey` y los últimos cuatro caracteres, no la clave.
- Los endpoints configurables deben cumplir la política HTTPS y no apuntar a loopback, redes privadas, link-local o metadata, salvo el caso explícito de Ollama.
- Esta validación ocurre al guardar la configuración; no elimina por sí sola el riesgo de DNS rebinding posterior ni convierte un endpoint externo en confiable.

## Añadir o cambiar una integración

1. Actualizar los tipos de [llm.types.ts](../backend/src/shared/infrastructure/ai/llm.types.ts) y el router.
2. Implementar el adaptador con formato JSON, timeout, uso de tokens y clasificación de errores.
3. Declarar el proveedor en configuración y, si procede, en el panel admin del frontend.
4. Añadir pruebas de éxito, timeout, throttling, credenciales, parseo inválido y failover.
5. Revisar que las trazas internas no aparezcan en la proyección estudiantil.

## Referencias de implementación

- Evaluador y contratos: [builder-llm-evaluator.service.ts](../backend/src/modules/projects/builder/application/services/ai/builder-llm-evaluator.service.ts).
- Dispatch por rol y proveedor: [builder-llm-dispatcher.service.ts](../backend/src/modules/projects/builder/application/services/ai/builder-llm-dispatcher.service.ts) y [llm-generation.router.ts](../backend/src/shared/infrastructure/ai/llm-generation.router.ts).
- Guard de alucinaciones: [builder-hallucination-guard.service.ts](../backend/src/modules/projects/builder/application/services/evaluation/builder-hallucination-guard.service.ts).
- Calidad: [builder-code-quality.service.ts](../backend/src/modules/projects/builder/application/services/ai/builder-code-quality.service.ts).
- Seguridad transversal: [llm-circuit-breaker.service.ts](../backend/src/shared/infrastructure/ai/llm-circuit-breaker.service.ts), [llm-endpoint-policy.util.ts](../backend/src/shared/infrastructure/ai/llm-endpoint-policy.util.ts) y [secret-cipher.service.ts](../backend/src/shared/infrastructure/security/secret-cipher.service.ts).
