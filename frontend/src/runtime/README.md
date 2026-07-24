# Módulo de Runtimes de Ejecución (src/runtime)

> **Resumen rápido:** Panel de configuración y monitoreo del catálogo de lenguajes y entornos Docker disponibles para la evaluación.

---

## Propósito y Responsabilidades
Permitir la supervisión de los entornos de ejecución (Node.js, Python, Java, etc.) soportados por la plataforma.
- **Catálogo de Runtimes:** Visualización de versiones y límites de cómputo.
- **Estado de Infraestructura:** Comprobación del estado del Daemon de Docker.

---

## Estructura Interna

```text
.
├── components/              # Subcomponentes visuales de tarjetas de runtimes
├── hooks/                   # Custom hooks para consultar el estado de runtimes (useRuntimeManagement)
└── TeacherRuntimePanel.tsx  # Panel principal del profesor para consultar los runtimes
```

---

## Flujo de Trabajo / Arquitectura

```text
[ TeacherRuntimePanel ] ──> [ useRuntimeManagement ] ──> [ API HTTP /runtimes ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del módulo de runtimes:
```bash
npm run test -- src/runtime
```
