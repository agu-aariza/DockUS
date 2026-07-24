# Tipos y Definiciones de Características (src/features)

> **Resumen rápido:** Tipos de TypeScript e interfaces centrales para las características de proyectos, builders y dominio del frontend.

---

## Propósito y Responsabilidades
Centralizar las definiciones de tipos e interfaces compartidas entre componentes de características.
- **Tipado Estricto:** Definiciones de interfaces para proyectos, tareas y ejecuciones del builder.

---

## Estructura Interna

```text
.
├── builder/  # Tipos de ejecuciones y estados del builder
└── projects/ # Tipos de proyectos, entregas y rúbricas
```

---

## Flujo de Trabajo / Arquitectura

```text
[ Feature Component ] ──> import type { Project } from 'src/features/projects/types'
```

---

## Cómo Usar / Probar este Módulo

Uso como repositorio de tipos TypeScript de importación directa.
