# Componentes del Flujo del Estudiante (student/components)

> **Resumen rápido:** Componentes de los pasos del asistente de entrega de prácticas, previsualizadores de código y pantallas de estado.

---

## Propósito y Responsabilidades
Construir los elementos interactivos del flujo paso a paso de entregas del alumno.
- **Pasos del Stepper:** `SubmissionStep1`, `SubmissionStep2`, `SubmissionStep3` y `SubmissionSuccess`.
- **Previsualización:** Árbol de ficheros (`FileTreePreview.tsx`) y tarjeta de progreso de evaluación (`EvaluationProgressCard.tsx`).

---

## Estructura Interna

```text
.
├── EvaluationProgressCard.tsx  # Tarjeta de progreso de la evaluación en vivo
├── FileTreePreview.tsx         # Previsualizador en árbol de los archivos del ZIP subido
├── StudentWorkspaceSurface.tsx # Superficie del área de trabajo del estudiante
├── SubmissionEmptyState.tsx    # Estado vacío cuando no hay entregas
├── SubmissionSidebar.tsx       # Barra lateral informativa de la entrega
├── SubmissionStep1.tsx         # Paso 1: Selección de proyecto y verificación de requisitos
├── SubmissionStep2.tsx         # Paso 2: Carga y previsualización de ficheros
├── SubmissionStep3.tsx         # Paso 3: Confirmación y envío final
├── SubmissionStepIndicator.tsx# Indicador gráfico de pasos del asistente
└── SubmissionSuccess.tsx       # Pantalla de confirmación de entrega exitosa
```

---

## Flujo de Trabajo / Arquitectura

```text
[ StudentSubmissionFlow ]
         ├──> [ SubmissionStepIndicator ]
         ├──> [ SubmissionStep1 ──> Step2 ──> Step3 ──> Success ]
         └──> [ SubmissionSidebar ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de componentes de estudiante:
```bash
npm run test -- src/student/components
```
