# Salud del backend (`src/health/`)

> **Resumen rápido:** El dominio de salud consulta el estado de liveness/readiness del backend para que la UI pueda mostrar el estado de las dependencias operativas.

## Estructura interna

```text
health/
└── api/healthApi.ts                 # Fachada HTTP de los endpoints /health
```

La fachada usa el transporte genérico de [`../shared/api/README.md`](../shared/api/README.md). No contiene componentes ni hooks porque sus consumidores deciden cómo presentar las sondas.

## Cómo trabajar aquí

```bash
npm run test -- src/health
```
