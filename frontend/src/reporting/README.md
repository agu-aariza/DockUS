# Reporting (`src/reporting/`)

> **Resumen rápido:** UI y utilidades de los informes generados por Builder, reutilizadas por las vistas de entregas y del alumno. Esta capa conoce los contratos de `features/builder` y puede consumir la API del Builder; `shared/` permanece agnóstico del dominio.

## Estructura

```text
reporting/
├── components/
│   ├── ReportView.tsx                 # Composición completa del informe
│   ├── AssessmentContextSummary.tsx   # Evidencia y límites de la evaluación
│   ├── CoachingSummary.tsx             # Feedback pedagógico y hallazgos
│   ├── PedagogicalReport.tsx           # Narrativa de aprendizaje
│   ├── ProfessionalVerdict.tsx         # Resultado ejecutivo
│   ├── TeacherHighlights.tsx           # Puntos clave para el docente
│   ├── GradeBreakdownChart.tsx         # Desglose de la nota
│   ├── CodeSnippet.tsx                 # Código asociado a un hallazgo
│   ├── report/                         # Tarjetas, badges y hallazgos técnicos
│   └── file-preview/GradingPanel.tsx   # Panel de calificación docente
└── utils/technicalFeedback.ts          # Normalización y agrupación de hallazgos
```

## Frontera de dependencias

Los componentes de esta carpeta pueden importar tipos de `features/builder` y `features/deliveries`, la fachada `builder/api/builderApi` y utilidades/componentes genéricos de `shared/`. Los consumidores de `student/` y `deliveries/` importan `ReportView` desde aquí; `shared/` no importa reporting ni ningún otro dominio. Reporting no publica tipos de vuelta a `features/` ni mueve clientes HTTP a `shared/api/`.

## Cómo trabajar aquí

```bash
npm run test -- src/reporting
```

No cambies rutas, contratos HTTP o comportamiento de evaluación al reorganizar esta capa: la responsabilidad del PR es mantener la UI y aislar sus dependencias.
