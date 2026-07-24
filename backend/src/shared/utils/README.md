# Funciones Auxiliares y Utilidades (shared/utils)

> **Resumen rápido:** Funciones puras de utilidad: algoritmos de backoff, formateo de cadenas, manipulación de fechas y operaciones puras.

---

## Propósito y Responsabilidades
Proporcionar funciones auxiliares sin estado ni dependencias externas.
- **Estrategias de Reintento:** Implementación de backoff exponencial para reintentos.
- **Formateo:** Normalización de nombres de archivo y cadenas de texto.

---

## Estructura Interna

```text
.
├── backoff.ts  # Algoritmos de tiempo de espera y reintentos exponencial
└── ...
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Service ] ──> calculateBackoffDelay(attempt) ──> Retorna Milisegundos
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de utilidades:
```bash
npm run test -- src/shared/utils
```
