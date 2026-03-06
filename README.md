<p align="center">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS"/>
  <img src="https://img.shields.io/badge/GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" alt="GitHub Actions"/>
</p>

<h1 align="center">🐳 DockUS</h1>

<p align="center">
  <strong>Plataforma de Entornos Reproducibles para Desarrollo Containerizado</strong>
</p>

<p align="center">
  <a href="#-descripción">Descripción</a> •
  <a href="#️-guía-de-desarrollo---dockus">Guía de Desarrollo</a> •
  <a href="#️-roadmap-de-fases">Roadmap</a>
</p>

---

## Descripción

**DockUS** es un ecosistema profesional diseñado para la gestión de entornos de desarrollo reproducibles y la evaluación automatizada de proyectos académicos. 

---

## Guía de Desarrollo - DockUS

Bienvenido al equipo de desarrollo de **DockUS**. Este documento contiene la información técnica necesaria para configurar el entorno y empezar a contribuir siguiendo nuestros estándares de calidad.

### Requisitos Previos

Asegúrate de tener instaladas las siguientes herramientas antes de comenzar:

- **Node.js**: >= 20.11.x (LTS)
- **NPM**: >= 9.x
- **Docker & Docker Compose**: 
  - Necesitas tener el motor de Docker corriendo (ya sea Docker Desktop o Docker Engine nativo en Linux/WSL).
  - Debes tener el plugin moderno **Docker Compose V2** (el que se ejecuta con `docker compose`, sin guion).
- **NestJS CLI** *(Opcional)*: Recomendado para generar código rápidamente. Instálalo globalmente con `npm install -g @nestjs/cli`.

### Configuración del Entorno

Sigue estos pasos estrictamente en orden para levantar tu entorno local:

1. **Instalar dependencias del proyecto:**
   Esto descargará todos los paquetes necesarios.
   ```bash
   cd backend/
   npm install
   ```
   *Nota: Esto incluye dependencias core como TypeORM, Swagger, Passport, JWT y bcrypt.*

2. **Configurar variables de entorno:**
   Copia el archivo de plantilla y ajusta los valores (credenciales de BD, puertos, secretos) si es necesario:
   ```bash
   cp ../.env.example ../.env
   ```

3. **Levantar infraestructura de apoyo (Contenedores):**
   Inicia las bases de datos y servicios auxiliares (PostgreSQL, Redis, MinIO) en segundo plano:
   ```bash
   # En la raíz del proyecto
   docker compose up -d
   ```
   *Nota: Puedes verificar que los tres servicios están corriendo correctamente (y que pasaron su healthcheck) ejecutando `docker ps`.*

### Scripts Disponibles (Backend)

| Comando | Descripción |
| --- | --- |
| `npm run start:dev` | Arranca la API en modo watch (hot reload) para desarrollo |
| `npm run build` | Compila el proyecto en la carpeta `/dist` listo para producción |
| `npm run lint` | Ejecuta el linter (ESLint) para verificar y corregir el estilo del código |
| `npm run test` | Ejecuta los tests unitarios (Jest) |
| `npm run test:e2e` | Ejecuta los tests de integración y end-to-end |

### Estándares del Proyecto

**1. Mensajes de Commit (Conventional Commits)**
Usamos el estándar de Conventional Commits. La estructura obligatoria es: `tipo(ámbito): descripción`
- `feat`: Nueva funcionalidad.
- `fix`: Corrección de un error o bug.
- `docs`: Cambios en la documentación.
- `chore`: Tareas de mantenimiento, actualización de dependencias o configuración.
- `ci`: Cambios en los pipelines o flujos de integración continua.

**2. Estrategia de Ramas (Git Flow Simplificado)**
- `main`: Código estable y listo para producción.
- `develop`: Rama de integración para el desarrollo actual.
- `feature/*`: Para nuevas funcionalidades (ej: `feature/auth-jwt`).
- `hotfix/*`: Para correcciones urgentes en producción.
- `fix/*`: Para correcciones urgentes en la rama de desarrollo.

### Arquitectura Modular
El proyecto sigue una arquitectura monolítica modular impulsada por NestJS. Los módulos principales son:
- `src/auth`: Gestión de seguridad, estrategias Passport y tokens JWT.
- `src/users`: Gestión de usuarios, roles y perfiles en la base de datos PostgreSQL.

---

### Seguridad
- Todas las variables críticas (claves de API, credenciales de BD, secretos JWT) deben ir obligatoriamente en el `.env` local y nunca subirse al repositorio.
- El archivo `.env` está explícitamente ignorado en nuestro archivo `.gitignore`.

---

## Roadmap de Fases

1.  **Fase 1-2:** Estructura base, usuarios y salud del sistema. 
2.  **Fase 3:** Motor de construcción de imágenes y gestión de proyectos.
3.  **Fase 4-5:** Frontend React/Vite y despliegue dinámico en Kubernetes.
4.  **Fase 6:** Panel de administración y gestión docente.
5.  **Fase 7:** Integración completa de IA Local mediante MCP (Opcional).

---

<p align="center">
  TFG Agustín Ariza Aragón - Universidad de Sevilla
</p>
