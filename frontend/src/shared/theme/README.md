# Tema (`shared/theme/`)

> **Resumen rápido:** Un único contexto, `ThemeContext.tsx`, que alterna entre modo claro y oscuro, persiste la preferencia y aplica la clase correspondiente al elemento raíz del documento para que las variables CSS de `styles.css` cambien de valor.

---

## Cómo funciona

`ThemeContext` guarda la preferencia (`light`/`dark`) en `localStorage` y la aplica como clase en el `<html>`/`<body>` — todo el resto del sistema de color depende de variables CSS (`--color-primary`, tokens `app-bg`/`app-surface`/`app-text*`, etc.) definidas en `styles.css`, que cambian de valor según esa clase. Ningún componente decide su propio color "a mano" por tema; todos consumen los mismos tokens, que ya resuelven claro/oscuro automáticamente.

## Un ejemplo real de por qué esto importa

`shared/components/ui/LogoPlate.tsx` (ver [`../../landing/README.md`](../../landing/README.md) para el detalle completo) decide si aplicar un fondo blanco a un logo **según el tema activo**, leyendo este mismo contexto — porque algunos logos de terceros llevan tinta oscura sin canal alfa y desaparecerían sobre un fondo oscuro sin ese tratamiento condicional.

## Estructura interna

```text
theme/
└── ThemeContext.tsx   # Provider + hook de tema, persistencia en localStorage
```

## Cómo trabajar aquí

```bash
npm run test -- test/unit/shared/theme
```

Si añades un color nuevo a la UI, defínelo como variable CSS en `styles.css` con su par claro/oscuro — no hardcodees un valor hexadecimal condicionado por `useTheme()` dentro de un componente.

## Ver también

- [`../../landing/README.md`](../../landing/README.md) — el caso de uso más detallado documentado sobre tema y logos.
