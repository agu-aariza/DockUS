# Automatización y Workflows de GitHub Actions (.github)

> **Resumen rápido:** Definición de la integración continua (CI), pruebas automatizadas y reglas de comprobación de calidad en GitHub Actions.

---

## Propósito y Responsabilidades
Garantizar que todo Pull Request y commit en las ramas principales cumpla con las pruebas y normas de calidad.
- **Workflow de Backend CI:** `.github/workflows/backend-ci.yml` para ejecutar comprobaciones de linteo, linter de arquitectura `boundaries`, typecheck y tests unitarios.

---

## Estructura Interna

```text
.
└── workflows/
    └── backend-ci.yml # Pipeline de integración continua para validación de backend
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Git Push / Pull Request ] ──> GitHub Actions Trigger ──> [ backend-ci.yml ] ──> Pass/Fail Status
```

---

## Cómo Usar / Probar este Módulo

Probar los comandos localmente antes de hacer push:
```bash
cd backend && npm run lint && npm run boundaries && npm run test
```
