# Integración de Inteligencia Artificial (ai)

> **Resumen rápido:** Adaptadores para proveedores de IA/LLM (Google Gemini, AWS Bedrock), manejo de peticiones estructuradas y patrones de resiliencia.

---

## Propósito y Responsabilidades
Proporcionar acceso unificado y resiliente a modelos de lenguaje para evaluación de código y generación asistida.
- **Circuit Breaker:** Protección ante fallos de API de terceros mediante `LlmCircuitBreakerService`.
- **Estructuración y Validación:** Tipado estricto de prompts y respuestas esperadas de los modelos.

---

## Estructura Interna

```text
.
├── providers/                      # Adaptadores concretos (Google Gemini, AWS Bedrock)
├── llm-circuit-breaker.service.ts  # Servicio de tolerancia a fallos para llamadas a LLM
├── llm-request.util.ts             # Formateo y utilidades de peticiones
└── prompt.types.ts                 # Tipos e interfaces de configuración de prompts
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Builder Service ] ──> [ LlmCircuitBreakerService ] ──> [ Gemini / Bedrock Provider ] ──> [ API Externa LLM ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests unitarios de LLM:
```bash
npm run test -- src/shared/infrastructure/ai
```
