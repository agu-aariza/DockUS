# Módulo de Proyectos (Projects Module)

Este directorio es el núcleo (core module) para la gestión de proyectos dentro de la plataforma. Su responsabilidad es orquestar todo el ciclo de vida de un proyecto, desde su creación, pasando por la gestión de accesos, operativas, hasta la calificación y gestión de entregas. Utiliza una arquitectura basada en Domain-Driven Design (DDD) y Arquitectura Hexagonal.

## Estructura de Directorios

El módulo está estructurado en varios subdirectorios, cada uno con una responsabilidad clara dentro de la arquitectura:

- `assignments/`: Contiene la lógica y casos de uso relacionados con las asignaciones de proyectos a estudiantes o grupos.
- `builder/`: Submódulo altamente complejo dedicado a la construcción asistida por IA de proyectos (Project Builder), separado por su propio ciclo de vida.
- `deliveries/`: Gestión de entregas (submissions) realizadas por los estudiantes para los proyectos.
- `domain/`: Contiene la lógica de negocio pura, entidades de dominio, interfaces de repositorios y modelos que no dependen de frameworks externos.
- `dto/`: Data Transfer Objects. Define las estructuras de datos utilizadas para la comunicación (entrada/salida) en los controladores de la capa de presentación.
- `entities/`: Entidades de base de datos (normalmente para TypeORM o Prisma) que mapean el dominio a la persistencia.
- `infrastructure/`: Implementaciones concretas de interfaces de dominio (repositorios, adaptadores externos, conexión a base de datos).
- `presentation/`: Controladores REST o GraphQL (API endpoints) que exponen la funcionalidad del módulo hacia el exterior.
- `storage/`: Gestión de almacenamiento de archivos relacionados con proyectos (archivos adjuntos, entregables, recursos).

## Archivos del Directorio Raíz del Módulo

A continuación, se detalla exhaustivamente cada fichero contenido directamente en esta carpeta y su función:

- **`projects.module.ts`**: Es el archivo de configuración de NestJS para este módulo. Define los controladores, proveedores (servicios, repositorios), importaciones (otros módulos necesarios) y exportaciones. Es el pegamento que une todas las piezas del módulo de proyectos.
- **`projects.service.ts`**: Servicio principal o fachada del módulo. Orquesta casos de uso básicos de creación, lectura, actualización y eliminación (CRUD ampliado) de proyectos, coordinando con repositorios y otros servicios.
- **`projects.service.spec.ts`**: Archivo de pruebas unitarias para `projects.service.ts`. Asegura que la lógica de orquestación principal funcione correctamente.
- **`project-access.service.ts`**: Servicio dedicado exclusivamente a gestionar la lógica de control de acceso a los proyectos (quién puede ver, editar o unirse a un proyecto, gestión de roles dentro del contexto del proyecto).
- **`project-access.service.spec.ts`**: Pruebas unitarias para verificar las reglas de negocio de control de acceso.
- **`project-gradebook.service.ts`**: Servicio que maneja la lógica compleja de calificaciones del proyecto. Calcula notas, gestiona rúbricas y consolida las evaluaciones de los estudiantes/entregas.
- **`project-lifecycle.service.ts`**: Máquina de estados o gestor del ciclo de vida de un proyecto (ej. Borrador -> Activo -> Archivado -> Completado). Aplica reglas de negocio sobre qué transiciones de estado son válidas.
- **`project-lifecycle.service.spec.ts`**: Pruebas unitarias para asegurar que las transiciones de estado del proyecto cumplan con las reglas de negocio establecidas.
- **`project-operational-issues.service.ts`**: Servicio encargado de detectar, gestionar y resolver problemas operativos o bloqueos que puedan surgir durante la ejecución de un proyecto (por ejemplo, dependencias faltantes, errores en contenedores de evaluación).
- **`projects.types.ts`**: Definición de tipos de TypeScript, interfaces auxiliares y enums globales utilizados a través de todo el módulo para mantener la seguridad de tipos (Type Safety).
