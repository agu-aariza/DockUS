# Pruebas End-to-End e Integración (backend/test)

> **Resumen rápido:** Suite de pruebas e2e para validar los endpoints HTTP, flujos completos de autenticación y comportamiento del servidor NestJS.

---

## Propósito y Responsabilidades
Garantizar la estabilidad de la API mediante pruebas automatizadas de integración contra una instancia de base de datos de test.
- **Pruebas e2e:** Verificación de controladores, pipes, guards y respuestas HTTP.
- **Fixtures de prueba:** Configuración de datos iniciales para la suite de integración.

---

## Estructura Interna

```text
.
├── app.e2e-spec.ts  # Pruebas end-to-end de los endpoints principales
└── jest-e2e.json    # Configuración de Jest para pruebas e2e
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Jest Test Runner ] ──> [ Supertest ] ──> [ NestJS App In-Memory / Test DB ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar pruebas e2e:
```bash
npm run test:e2e
```
