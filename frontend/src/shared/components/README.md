# Componentes Reutilizables de Interfaz (shared/components)

> **Resumen rápido:** Catálogo de componentes visuales compartidos en todo el frontend (botones, layouts, previsualización de archivos y reportes).

---

## Propósito y Responsabilidades
Mantener la coherencia estética y de accesibilidad en toda la plataforma.
- **Sistema de Componentes:** Botones con estados de carga, insignias de severidad y barras de navegación.
- **Visualización de Resultados:** Tarjetas de reportes, paneles de calificación y vistas previas de archivos.

---

## Estructura Interna

```text
.
├── file-preview/     # Visualizadores de ficheros de código y paneles de notas
├── report/           # Badges y tarjetas para los reportes de evaluación
└── ui/               # Layouts base, AppShell, botones y selectores
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Página de Vista ] ──> [ AppShell ] ──> [ ReportCard / StatusBadge ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes UI:
```bash
npm run test -- src/shared/components
```
