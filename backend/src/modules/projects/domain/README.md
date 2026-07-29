# Dominio de Proyectos (modules/projects/domain)

> **Resumen rápido:** Lógica de negocio pura y reglas del dominio de proyectos, sin dependencias de infraestructura ni frameworks externos.

---

## Propósito y Responsabilidades
Definir las entidades puras, objetos de valor (Value Objects) y reglas del dominio de evaluación.
- **Pureza del Dominio:** Sin importaciones de TypeORM, Express o NestJS (salvo tipos decorativos).
- **Reglas de Calificación:** Cálculo de notas y evaluación de rúbricas.

---

## Estructura Interna

```text
.
└── ... # Entidades puras y reglas de dominio
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Application Service ] ──> [ Domain Rule / Entity ] ──> Calcula Calificación / Valida Estado
```

---

## Cómo Usar / Probar este Módulo

### Ejecutar tests del dominio de proyectos:
```bash
npm run test -- src/modules/projects/domain
```

---

## Convención: transacciones en el adaptador, no en la aplicación

Una operación que debe ser atómica se expresa como **un único método** de la interfaz de repositorio (`repositories/`); la transacción vive dentro del adaptador de `infrastructure/database/` que la implementa, nunca en la capa de aplicación. Ver [DESIGN_DECISIONS.md](../../../../../docs/DESIGN_DECISIONS.md) D-15, referencia: `IGroupEnrollmentRepository.bulkEnroll`.
