# Módulo Builder y Streaming de Ejecuciones (src/builder)

> **Resumen rápido:** Vistas de monitorización en directo del proceso de compilación, consolas de logs en streaming, tablas de ejecuciones y métricas de calidad.

---

## Propósito y Responsabilidades
Mostrar al usuario en tiempo real el progreso de evaluación de su entrega o proyecto.
- **Streaming de Logs:** Renderizado en directo de la consola (`LiveConsolePanel`) mediante Server-Sent Events o polling (`useBuilderRunStream`).
- **Visualización de Resultados:** `BuilderLiveRunPane.tsx`, tabla de ejecuciones `BuilderRunsTable.tsx` y panel de métricas de calidad `QualityInsightsDashboard.tsx`.

---

## Estructura Interna

```text
.
├── components/
│   ├── BuilderLiveRunPane.tsx        # Panel principal de inspección de ejecución activa
│   ├── BuilderRunsTable.tsx          # Tabla de ejecuciones recientes del builder
│   ├── QualityInsightsDashboard.tsx  # Cuadro de mando de insights de calidad
│   └── live-run/                     # Consola de streaming, barras de estado y meta-barras
├── hooks/                            # Custom hook useBuilderRunStream
└── utils.ts                          # Utilidades auxiliares del builder
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Backend Event Stream ] ──> [ useBuilderRunStream ] ──> [ BuilderLiveRunPane ] ──> [ LiveConsolePanel ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del flujo de streaming:
```bash
npm run test -- src/builder
```
