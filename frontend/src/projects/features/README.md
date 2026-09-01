# Formularios de proyecto (`projects/features/`)

> **Resumen rápido:** Los dos formularios grandes del dominio de proyectos: creación (`ProjectCreateForm.tsx`) y configuración avanzada (`ProjectConfigForm.tsx`, incluida la rúbrica).

---

## Por qué son dos formularios y no uno

`ProjectCreateForm.tsx` es un asistente reducido para el alta rápida de un proyecto (título, plazos, tipo esperado). `ProjectConfigForm.tsx` es el formulario completo de edición, con la rúbrica y los parámetros avanzados que no tiene sentido pedir en el momento de crear algo desde cero. Un proyecto siempre pasa primero por `ProjectCreateForm.tsx`; `ProjectConfigForm.tsx` se usa después, desde el panel de detalle, para refinarlo.

## Estructura interna

```text
features/
├── ProjectCreateForm.tsx   # Alta rápida: título, contexto académico, plazos
└── ProjectConfigForm.tsx    # Edición completa: rúbrica, tipo esperado, límites de reentrega, visibilidad
```

Nota sobre el nombre de esta carpeta: es una excepción al patrón general de `features/<dominio>/` como capa de tipos puros (ver [`../../features/README.md`](../../features/README.md)) — aquí `features/` contiene componentes React con lógica de formulario, específicos de `projects/`, no tipos compartidos. No lo confundas con el directorio raíz `src/features/`.

## Cómo trabajar aquí

```bash
npm run test -- test/unit/projects/features
```

## Ver también

- [`../README.md`](../README.md) — visión general del panel de proyectos.
- [`../../features/README.md`](../../features/README.md) — el otro significado de "features" en este repositorio (tipos puros).
