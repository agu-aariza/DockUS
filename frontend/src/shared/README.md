# Capa transversal (`src/shared/`)

> **Resumen rápido:** Todo lo que no pertenece a un dominio concreto: el cliente HTTP (único sitio donde se usa `axios`), la configuración de React Query, sesión, tema, notificaciones, el sistema de diseño, y utilidades puras. `shared/` no importa de ningún dominio (`projects/`, `student/`, etc.) — es la misma regla unidireccional que en el backend, aplicada al frontend.

---

## Estructura interna

```text
shared/
├── api/            # Único lugar donde se usa axios — un fichero por dominio backend — ver api/README.md
├── query/            # queryClient.ts, queryKeys.ts, QueryDevtools.tsx — ver query/README.md
├── components/         # UI compartida — ver components/README.md
│   ├── ui/               # Design system puro: sin imports de api/ ni lógica de negocio
│   ├── report/             # Badges/tarjetas específicas de informes de evaluación
│   └── file-preview/         # Visor de código + explorador de ficheros
├── session/              # Sesión activa, multi-cuenta, permisos por rol — ver session/README.md
├── workspace/              # Contexto de proyecto/entrega en curso — ver workspace/README.md
├── theme/                    # Claro/oscuro — ver theme/README.md
├── toast/                      # Notificaciones no bloqueantes — ver toast/README.md
├── data/                          # Diccionarios estáticos (taxonomía del builder, glosario) — ver data/README.md
├── hooks/                            # Hooks genéricos sin dominio — ver hooks/README.md
└── utils/                              # Funciones puras — ver utils/README.md
```

## Las dos reglas que no se rompen aquí

1. **`axios` solo se usa dentro de `api/`.** Cualquier componente o hook de un dominio que necesite datos del backend pasa por una de las fachadas de `api/` (`projectsApi`, `deliveriesApi`, etc.), nunca importa `axios` directamente.
2. **El estado global usa React Context, no una librería externa.** `session/`, `workspace/`, `theme/`, `toast/` son los cuatro contextos globales de la aplicación — no se introduce Redux/Zustand/Jotai para ningún flujo, por simple que parezca justificarlo.

## Cómo encaja con `features/`

`shared/` es transversal a *toda* la aplicación (no conoce ningún dominio); [`../features/README.md`](../features/README.md) son los tipos puros *de cada dominio* (sí conoce, por ejemplo, la forma de un `Project`). Un componente de `projects/` importa de ambos: de `shared/` para UI/sesión/API genérica, de `features/projects/` para los tipos concretos de ese dominio.

## Cómo trabajar aquí

```bash
npm run test -- src/shared
```

## Ver también

- [`api/README.md`](api/README.md), [`query/README.md`](query/README.md), [`components/README.md`](components/README.md), [`session/README.md`](session/README.md), [`workspace/README.md`](workspace/README.md), [`theme/README.md`](theme/README.md), [`toast/README.md`](toast/README.md), [`data/README.md`](data/README.md), [`hooks/README.md`](hooks/README.md), [`utils/README.md`](utils/README.md)
- [`../features/README.md`](../features/README.md) — tipos por dominio, la otra mitad de la capa transversal.
- [`../README.md`](../README.md) — el código fuente del frontend en conjunto.
