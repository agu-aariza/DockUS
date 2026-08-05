# Aplicación del Builder (`builder/application/`)

> **Resumen rápido:** Un único hijo, `services/`, que contiene absolutamente toda la lógica de negocio del motor de evaluación — no hay `application/*.ts` sueltos aquí como en `projects/`, todo está clasificado por sub-responsabilidad dentro de `services/`.

---

## Por qué solo hay una carpeta aquí

A diferencia de `projects/` (que tiene servicios sueltos en su raíz porque orquestan entre pocos submódulos), el Builder tiene tantos casos de uso distintos — orquestación, IA, workspace, compilación, evaluación, artefactos — que agruparlos todos sueltos en la raíz de `application/` sería inmanejable. En su lugar, cada responsabilidad tiene su propia subcarpeta dentro de `services/`, y esta carpeta (`application/`) es solo el nivel de convención que exige la arquitectura hexagonal del backend (`presentation/ application/ domain/ infrastructure/`).

## Ver también

- [`services/README.md`](services/README.md) — el desglose real por subcarpeta.
- [`../README.md`](../README.md) — visión general del motor Builder.
