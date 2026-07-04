# Infrastructure: Docker

## Descripción General
El módulo `DockerInfrastructureModule` es un pilar crítico en el backend de DockUS. Se encarga de proveer una abstracción sobre el demonio (daemon) de Docker para orquestar la ejecución, red y ciclo de vida de los contenedores que utiliza la plataforma.
Este módulo permite que la plataforma administre "Workspaces" y entornos de ejecución aislados, sin que los módulos de negocio necesiten conocer comandos nativos de Docker o interactuar directamente con la API del SO.

## Árbol de Directorios
```text
docker/
├── README.md
├── command-runner.util.ts
├── docker-container.service.spec.ts
├── docker-container.service.ts
├── docker-execution.service.spec.ts
├── docker-execution.service.ts
├── docker-host.service.spec.ts
├── docker-host.service.ts
├── docker-infrastructure.module.ts
├── docker-network.service.spec.ts
├── docker-network.service.ts
├── docker.types.ts
└── docker.utils.ts
```

## Detalle Exhaustivo de Ficheros

### 1. Utilidades y Tipos
- **`docker.types.ts`**
  - **Propósito:** Definir las interfaces TypeScript estrictas.
  - **Responsabilidad:** Define tipos como `DockerCreateNetworkOptions`, `DockerListOptions`, `DockerRunOptions`, etc. 
  - **Conexiones:** Es el contrato de tipos que usan todos los servicios de este módulo, permitiendo type-safety absoluto en los parámetros.

- **`docker.utils.ts`**
  - **Propósito:** Contiene funciones puras y utilidades genéricas para formatear argumentos o errores de Docker.
  - **Responsabilidad:** Funciones como `buildDockerLabelArgs`, `parseDockerJsonArray`, `parseDockerJsonLines`, y `normalizeDockerCommandError` para parsear las salidas de consola (stdout/stderr) a objetos TypeScript.
  - **Conexiones:** Usado por los servicios de network y containers para transformar los argumentos a la línea de comandos y parsear el JSON que devuelve Docker.

- **`command-runner.util.ts`**
  - **Propósito:** Abstracción sobre la ejecución de comandos del SO.
  - **Responsabilidad:** Envolver `child_process.spawn` o similar para ejecutar subprocesos de forma segura, manejando timeouts (`timeoutMs`), límites de buffer de salida (`maxBufferedChars`), y capturando stdout/stderr y exitCodes.
  - **Conexiones:** Es el motor subyacente que utilizan **todos** los servicios (Container, Network, Host) para invocar el binario `docker`.

### 2. Servicios de Capa Base (Docker API)
- **`docker-host.service.ts`**
  - **Propósito:** Interacción a nivel de host de Docker.
  - **Responsabilidad:** Verifica si el demonio Docker está activo, recursos globales, uso de disco o logs del sistema.
  - **Conexiones:** Permite al sistema realizar checks de salud o de capacidad del sistema anfitrión antes de provisionar contenedores.

- **`docker-network.service.ts`**
  - **Propósito:** Gestión de redes Docker (Network isolation).
  - **Responsabilidad:** Implementa `createNetwork`, `removeNetwork`, `inspectNetwork`, y `listNetworks`. Permite que DockUS cree redes virtuales etiquetadas (`dockus.managed=true`, `dockus.scope=run`) para mantener los entornos de los usuarios herméticamente cerrados y seguros.
  - **Conexiones:** Fundamental para aislar los entornos, se llama antes de instanciar un contenedor para asegurarse de que su red dedicada está preparada.

- **`docker-container.service.ts`**
  - **Propósito:** Gestión directa del ciclo de vida de los contenedores.
  - **Responsabilidad:** Contiene la lógica para ejecutar comandos `docker run`, `docker stop`, `docker rm`, `docker inspect`, y leer logs (`getContainerLogs`). Configura restricciones de CPU/Memoria y usa runtimes específicos (como `runsc` para gVisor).
  - **Conexiones:** Es el actuador principal. Traduce las intenciones del usuario en Workspaces tangibles.

### 3. Servicios de Capa de Orquestación
- **`docker-execution.service.ts`**
  - **Propósito:** Fachada (Facade) que combina redes y contenedores.
  - **Responsabilidad:** Expone flujos completos para la aplicación. Por ejemplo, `runDaemonContainer` orquesta internamente llamar al `DockerNetworkService` para preparar la red y luego a `DockerContainerService` para arrancar el servicio. También maneja lógica de seguridad avanzada como inyectar runtimes seguros (`BUILDER_DOCKER_RUNTIME=runsc`).
  - **Conexiones:** Este es el punto de entrada principal que los módulos de negocio (ej. módulo Workspace o Builder) inyectan para interactuar con Docker de forma abstracta.

### 4. Tests Unitarios (`*.spec.ts`)
- **`docker-container.service.spec.ts`**, **`docker-execution.service.spec.ts`**, **`docker-host.service.spec.ts`**, **`docker-network.service.spec.ts`**
  - **Propósito:** Garantizar la correctitud lógica aislando la dependencia del comando OS real.
  - **Responsabilidad:** Usan Jest para hacer mocking exhaustivo de las utilidades (`command-runner.util`) y verifican que la transformación de parámetros y el flujo (red -> contenedor) ocurre en el orden y con las banderas correctas.

### 5. Módulo NestJS
- **`docker-infrastructure.module.ts`**
  - **Propósito:** Definición del módulo para NestJS.
  - **Responsabilidad:** Registra los servicios anteriores (`DockerContainerService`, `DockerNetworkService`, `DockerExecutionService`, etc.) y exporta la fachada principal (`DockerExecutionService`) para que esté disponible en toda la aplicación.
  - **Conexiones:** Se integra en el pipeline de Inyección de Dependencias del backend de DockUS.

## Notas
Cuando se deba crear un nuevo tipo de entorno efímero o persistente, se debe **invariablemente** modificar/consumir el `DockerExecutionService`. La seguridad es primordial: las redes deben tener la bandera `--internal` para evitar salidas externas no deseadas (ver `docker-execution.service.ts`), y los runtimes se deben inyectar leyendo del entorno (`BUILDER_DOCKER_RUNTIME`). Todo comando docker invocado usa formato JSON estricto (`--format '{{json .}}'`) parseado en los Utils, para una integración robusta.
