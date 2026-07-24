# Módulo de Proyectos y Entregas (projects)

> **Resumen rápido:** Dominio central para la creación de proyectos prácticos, entregas de código por parte de alumnos, libro de calificaciones y el submódulo de construcción/evaluación (builder).

---

## Propósito y Responsabilidades
Gestionar el ciclo de vida completo de un proyecto docente.
- **Configuración de Proyectos:** Definición de enunciados, plazos y rúbricas.
- **Gestión de Entregas:** Recepción de código de alumnos y almacenamiento seguro.
- **Calificación y Feedback:** Cálculo de notas finales mediante `ProjectGradebookService`.

---

## Estructura Interna

```text
.
├── assignments/      # Asignación de proyectos a grupos académicos
├── builder/          # Submódulo complejo de compilación y evaluación aislada en Docker
├── deliveries/       # Estado y gestión de entregas individuales o grupales
├── domain/           # Entidades del dominio de proyectos y reglas pura
├── dto/              # DTOs de transferencia de datos
├── entities/         # Entidades de persistencia TypeORM
├── infrastructure/   # Repositorios concretos e integración con base de datos
├── presentation/     # Controladores HTTP expuestos
└── storage/          # Subida de ficheros de entregas mediante Multer/MinIO
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Estudiante UI ] ──> Subida Entrega ──> [ Deliveries Service ] ──> [ Storage Service ]
                                                      │
                                                      ▼
                                            [ Builder Submodule ]
                                                      │
                                                      ▼
                                          (Evaluación Docker + LLM)
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests de proyectos y entregas:
```bash
npm run test -- src/modules/projects
```
