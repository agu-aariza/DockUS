# frontend/src/shared/components/

Componentes React reutilizables por todos los paneles de la aplicación.

## Estructura

```
components/
├── ui/                    # Primitivas de UI reutilizables
│   ├── Button.tsx
│   ├── Layout.tsx
│   ├── PageHeader.tsx
│   ├── Tabs.tsx
│   └── ...
├── AssessmentContextSummary.tsx
├── CodePreviewModal.tsx
├── CommandPalette.tsx
├── ErrorBoundary.tsx
├── GradeBreakdownChart.tsx
├── MarkdownContent.tsx
├── ReportView.tsx
├── Sidebar.tsx
├── TeacherGradingStudio.tsx
├── TerminalViewer.tsx
├── TutorChatBlock.tsx
└── ...
```

## Notas

- `ui/` contiene primitivas básicas (botones, tabs, layout, etc.).
- El resto de componentes son bloques de negocio reutilizables (visor de informes, chat tutor, previsualización de código, etc.).
- Todos los componentes deben mantenerse libres de lógica de rutas específicas.
