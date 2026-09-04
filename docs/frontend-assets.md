# Assets estáticos del frontend

Los ficheros de [frontend/public](../frontend/public) se sirven tal cual desde la raíz pública de Vite y no pasan por React ni por el pipeline de TypeScript.

## Assets actuales

- `frontend/public/logos/`: logos de proveedores LLM y lenguajes (`openai`, `anthropic`, `azure`, `gemini`, `ollama`, AWS, C/C++/Java/JavaScript/Python y otros).
- `frontend/public/uni_sev.jpeg`: imagen institucional usada por la landing.
- Variantes `Logo01*` y `Logo02*`: recursos gráficos de marca.

## Reglas

1. Referenciar un asset con una URL pública, por ejemplo `/logos/openai.svg`, no con una ruta de `src`.
2. Mantener nombres y extensiones estables: pueden estar consumidos por CSS o configuraciones fuera del componente que se cambia.
3. No guardar secretos, datos de alumnos ni archivos subidos en `public/`.
4. Optimizar imágenes nuevas y comprobar que la build de Vite las copia al output.
5. Si un asset se elimina o renombra, buscar referencias en `frontend/src`, CSS, documentación y tests.

Los assets públicos forman parte del bundle/despliegue del frontend; no deben confundirse con las entregas o evidencias almacenadas en MinIO.

