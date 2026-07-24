# Recursos Estáticos Públicos (frontend/public)

> **Resumen rápido:** Recursos estáticos directos (favicons, imágenes, fuentes, manifiestos) servidos sin procesamiento en la raíz del frontend.

---

## Propósito y Responsabilidades
Almacenar ficheros que deben mantenerse con su nombre original en la raíz del servidor web.
- **Favicons e Iconos:** Logotipo de la aplicación en distintos tamaños.
- **Configuraciones:** Ficheros `robots.txt` o manifest.json.

---

## Estructura Interna

```text
.
└── ... # Imágenes estáticas e iconos
```

---

## Flujo de Trabajo / Arquitectura

```text
HTTP GET /favicon.ico ──> Serve direct file from frontend/public/favicon.ico
```

---

## Cómo Usar / Probar este Módulo

Añadir archivos estáticos directamente a esta carpeta para hacerlos accesibles en la raíz del dominio.
