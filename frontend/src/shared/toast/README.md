# Sistema de Notificaciones Toast (shared/toast)

> **Resumen rápido:** Proveedor de contexto y gestor de avisos Toast temporales (éxito, error, advertencias) para el usuario.

---

## Propósito y Responsabilidades
Mostrar notificaciones no bloqueantes en respuesta a acciones del usuario o respuestas de la API.
- **Feedback Inmediato:** Avisos emergentes con auto-cierre programado.

---

## Estructura Interna

```text
.
└── ToastContext.tsx # Proveedor de contexto React y hook useToast
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Feature Component ] ──> showToast('Operación exitosa', 'success') ──> Overlay Render
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de notificaciones Toast:
```bash
npm run test -- src/shared/toast
```
