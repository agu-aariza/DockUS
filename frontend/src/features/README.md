## Responsabilidad del Módulo
Actuar como la capa de abstracción de negocio del frontend. Contiene los tipos, interfaces, DTOs compartidos y utilidades puras mapeadas directamente a los dominios del backend.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
NO renderiza componentes UI (botones, paneles, layouts). NO incluye llamadas directas a Axios o hooks de estado de React, limitándose a definiciones estáticas y utilidades puras.

## Conceptos Clave (Glosario)
- **Feature Slice**: Dominio de negocio (ej. `auth`, `projects`, `groups`) organizado con sus respectivos tipos, constantes y reglas de validación.

## Dependencias Externas Clave
Dependencias mínimas. Representa los "contratos" (Types/Interfaces) entre la API y la UI de React.

## Efectos Secundarios (Side Effects)
Ninguno. Este módulo contiene lógica pura (types, mappers simples, constantes).

## Estado / BBDD
No guarda estado. Define la forma estructural de los objetos (entidades) que los Contexts o hooks consumirán.

## Puntos de Entrada (Entrypoints)
- Cada subcarpeta (`auth/`, `builder/`, `projects/`, etc.) exporta sus `types.ts` o constantes para ser importadas libremente en los componentes UI (`src/auth`, `src/projects`).
