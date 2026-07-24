# Módulo de Configuración de LLM e IA (src/llm)

> **Resumen rápido:** Componentes, hooks y paneles de configuración para la gestión de proveedores de modelos de lenguaje (LLM) y sus parámetros de evaluación.

---

## Propósito y Responsabilidades
Permitir a los administradores y profesores ajustar la integración con servicios de IA.
- **Configuración de Proveedores:** Selección entre Google Gemini, AWS Bedrock o modelos locales.
- **Parámetros de Prompt:** Ajuste de constantes (`llmConfigConstants.ts`) y límites de tokens.

---

## Estructura Interna

```text
.
├── components/           # Formularios de selección de proveedor y parámetros
├── hooks/                # Custom hooks para la gestión de la configuración LLM
├── LlmConfigPanel.tsx    # Panel principal de administración de proveedores de IA
└── llmConfigConstants.ts # Constantes y valores por defecto de configuración LLM
```

---

## Flujo de Trabajo / Arquitectura

```text
[ LlmConfigPanel ] ──> [ Custom Hooks ] ──> [ API HTTP /llm/config ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del módulo LLM frontend:
```bash
npm run test -- src/llm
```
