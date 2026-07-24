# Código Fuente Frontend (src)

> **Resumen rápido:** Directorio raíz del código fuente de React, organizado en características específicas (features) y servicios compartidos.

---

## Propósito y Responsabilidades
Contener los componentes, hooks, estados globales y páginas que conforman la interfaz de DockUS.
- **Modularización por dominio:** Separación en carpetas independientes (`auth`, `student`, `projects`, `builder`).
- **Reusabilidad:** Recursos transversales centralizados en `shared/`.

---

## Estructura Interna

```text
.
├── auth/             # Componentes y estado de autenticación
├── builder/          # Vistas de ejecución en vivo y consola de logs
├── groups/           # Paneles de gestión de grupos académicos
├── llm/              # Componentes de interacción con modelos LLM
├── projects/         # Creación de proyectos, edición de rúbricas y notas
├── runtime/          # Configuración e inspección de entornos Docker
├── shared/           # Design system, hooks generales, cliente HTTP y sesión
├── student/          # Experiencia completa de entregas y workspace de alumnos
├── student-profile/  # Timeline y expediente del estudiante
├── summary/          # Cuadros de mando y analíticas del cohorte
├── users/            # Administración de usuarios
├── App.tsx           # Componente raíz y enrutamiento principal
├── main.tsx          # Punto de entrada ReactDOM
└── styles.css        # Importación de TailwindCSS y estilos globales
```

---

## Flujo de Trabajo / Arquitectura

```text
main.tsx ──> App.tsx ──> [ AppShell / ContextProviders ] ──> [ Feature Section ]
```

---

## Cómo Usar / Probar este Módulo

### Compilar TypeScript y assets para producción:
```bash
npm run build
```
