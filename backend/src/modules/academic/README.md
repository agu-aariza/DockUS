# Módulo Académico (academic)

> **Resumen rápido:** Gestión de la estructura académica: grupos de alumnos, asignaturas, cursos lectivos y adscripción de estudiantes a grupos.

---

## Propósito y Responsabilidades
Permitir a los profesores organizar la docencia en grupos y asignar estudiantes.
- **Gestión de Grupos:** Creación, modificación y cierre de grupos académicos.
- **Asignación de Estudiantes:** Matrícula e inscripción de estudiantes a sus respectivos grupos.

---

## Estructura Interna

```text
.
├── academic.module.ts # Módulo NestJS que registra la infraestructura académica
├── application/      # Casos de uso de la gestión académica
├── controllers/      # Controladores HTTP para grupos y estudiantes
├── domain/           # Entidades y reglas puras del dominio académico
├── dto/              # DTOs para creación y edición de grupos y matrículas
├── entities/         # Entidades TypeORM de Grupo, Asignatura y Matrícula
├── infrastructure/   # Repositorios concretos de base de datos
└── services/         # Servicios de aplicación (GroupsService, etc.)
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Profesor UI ] ──> HTTP API ──> [ AcademicControllers ] ──> [ GroupsService ] ──> [ PostgreSQL ]
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del módulo académico:
```bash
npm run test -- src/modules/academic
```
