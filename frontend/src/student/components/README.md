# Componentes del asistente de entrega (`student/components/`)

> **Resumen rápido:** Los tres pasos del asistente de `StudentSubmissionFlow.tsx` (elegir proyecto → subir/previsualizar código → confirmar), más los estados de vacío/éxito y las piezas de la superficie del workspace.

---

## Los tres pasos, en orden

```text
SubmissionStep1.tsx   → Selección de proyecto/asignación + verificación de requisitos (plazo, reentregas disponibles)
SubmissionStep2.tsx   → Carga del ZIP y previsualización (usa FileTreePreview.tsx para mostrar el árbol de ficheros)
SubmissionStep3.tsx   → Confirmación final y envío
        │
        ▼
SubmissionSuccess.tsx → Pantalla de éxito, con enlace a seguir la evaluación en vivo
```

`SubmissionStepIndicator.tsx` es el indicador visual de en qué paso está el alumno — distinto de `PipelineStepper.tsx` (en el directorio padre), que indica el progreso de la *evaluación en Docker*, no del *asistente de subida*. No los confundas: uno es sobre el formulario, el otro sobre la ejecución del backend.

## El resto de componentes

| Fichero | Qué es |
| --- | --- |
| `FileTreePreview.tsx` | Árbol de ficheros del ZIP subido, para que el alumno verifique que subió lo correcto antes de confirmar. |
| `EvaluationProgressCard.tsx` | Tarjeta de progreso de la evaluación en vivo, embebida tras el envío. |
| `StudentWorkspaceSurface.tsx` | Contenedor visual compartido por las secciones del workspace (fuera del asistente). |
| `SubmissionEmptyState.tsx` | Estado vacío cuando no hay entregas todavía. |
| `SubmissionSidebar.tsx` | Barra lateral informativa durante el asistente (plazos, intentos restantes). |

## Cómo trabajar aquí

```bash
npm run test -- test/unit/student/components
```

## Ver también

- [`../README.md`](../README.md) — el flujo completo y los hooks que orquestan estos pasos.
