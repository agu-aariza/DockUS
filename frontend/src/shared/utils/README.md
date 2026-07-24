# Utilidades Compartidas Frontend (shared/utils)

> **Resumen rápido:** Funciones puras auxiliares de formateo, tratamiento de datos y cálculos de tiempo de espera (backoff).

---

## Propósito y Responsabilidades
Proporcionar lógica utilitaria común y testeable.
- **Backoff:** Algoritmo de retraso en reintentos de conexión.

---

## Estructura Interna

```text
.
├── backoff.ts       # Funciones de cálculo de retraso de reintento
└── backoff.spec.ts  # Pruebas unitarias de las utilidades de backoff
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Network Retry Logic ] ──> calculateBackoff(attempt) ──> Delay in ms
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de utilidades frontend:
```bash
npm run test -- src/shared/utils
```
