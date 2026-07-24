# Utilidades de Soporte para Pruebas (test-support)

> **Resumen rápido:** Mocks, fábricas de entidades de prueba y helpers reutilizables para los tests unitarios e integración del backend.

---

## Propósito y Responsabilidades
Facilitar la escritura de pruebas unitarias limpias sin duplicar código de configuración.
- **Fábricas de objetos (Mocks):** Creación de objetos ficticios de proyectos, entregas y usuarios.
- **Helpers de prueba:** Utilidades para simular repositorios de TypeORM y clientes de Redis.

---

## Estructura Interna

```text
.
└── ... # Mocks y utilidades auxiliares para pruebas
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Test Unitario (.spec.ts) ] ──> [ Mock Factory ] ──> (Retorna Objeto Simulado)
```

---

## Cómo Usar / Probar este Módulo

### Importar helpers en un test:
```typescript
import { createMockUser } from '../test-support';
```
