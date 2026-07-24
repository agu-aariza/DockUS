# Dominio IA del Builder (builder/domain/ai)

> **Resumen rápido:** Parsers y utilidades para procesar las respuestas de los modelos de IA y evaluar resultados de ejecución.

---

## Propósito y Responsabilidades
Convertir la salida en texto plano de los LLM en objetos estructurados con validez de negocio.
- **Formateo de Resultados:** `builder-execution-result.util.ts` para mapear los logs y feedbacks generados.

---

## Estructura Interna

```text
.
└── builder-execution-result.util.ts # Mapeo de respuestas de IA a resultados de ejecución
```

---

## Flujo de Trabajo / Arquitectura

```text
Texto Raw de IA ──> [ builder-execution-result.util ] ──> Objeto Result Estructurado
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del dominio IA del builder:
```bash
npm run test -- src/modules/projects/builder/domain/ai
```
