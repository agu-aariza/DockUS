# Componentes del Libro de Notas y Progreso (projects/components/progress)

> **Resumen rápido:** Componentes de la vista de seguimiento docente: libro de calificaciones, gráficos de distribución de notas y modales de historial.

---

## Propósito y Responsabilidades
Permitir a los profesores filtrar, analizar y calificar las entregas del grupo.
- **Libro de Notas:** `GradebookTable.tsx` con filtros por grupo/estado (`GradebookFilters.tsx`).
- **Gráficos y Estadísticas:** `DistributionCharts.tsx`, `ProgressStatsPanel.tsx` y `ParticipationProgress.tsx`.
- **Modales de Inspección:** `DeliveryHistoryModal.tsx` y `PreviewOrGradingModal.tsx`.

---

## Estructura Interna

```text
.
├── DeliveryHistoryModal.tsx   # Modal de historial de versiones de entrega de un alumno
├── DistributionCharts.tsx     # Gráficos visuales de distribución de calificaciones
├── GradebookFilters.tsx       # Filtros de búsqueda por estudiante, grupo o nota
├── GradebookTable.tsx         # Tabla interactiva del libro de calificaciones
├── ParticipationProgress.tsx  # Métricas visuales de porcentaje de participación
├── PreviewOrGradingModal.tsx  # Modal de previsualización de código o edición de nota
├── ProgressStatsPanel.tsx     # Panel de estadísticas agregadas de la práctica
└── ProjectSelector.tsx        # Selector contextual de proyecto docente
```

---

## Flujo de Trabajo / Arquitectura

```text
[ ProgressDashboard ] ──> [ ProjectSelector ] ──> [ GradebookFilters + GradebookTable ]
                                                        │
                                                        ▼
                                           [ DeliveryHistoryModal / PreviewModal ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de progreso:
```bash
npm run test -- src/projects/components/progress
```
