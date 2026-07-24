# Proveedor de Tema y Diseño (shared/theme)

> **Resumen rápido:** Contexto de tema de interfaz (modo claro/oscuro) y gestión de clases globales de apariencia visual.

---

## Propósito y Responsabilidades
Gestionar las preferencias estéticas del usuario y alternar dinámicamente el tema de la aplicación.
- **Contexto de Tema:** `ThemeContext.tsx` para alternar entre tema oscuro (`dark`) y tema claro (`light`).

---

## Estructura Interna

```text
.
├── ThemeContext.spec.tsx # Pruebas unitarias del proveedor de tema
└── ThemeContext.tsx      # Proveedor de contexto React para la gestión del tema visual
```

---

## Flujo de Trabajo / Arquitectura

```text
[ User Action / Toggle ] ──> [ ThemeContext ] ──> Actualiza clase HTML y LocalStorage
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del proveedor de tema:
```bash
npm run test -- src/shared/theme
```
