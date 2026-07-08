## Responsabilidad del Módulo
Proveer una abstracción robusta y tipada sobre el demonio de Docker. Permite orquestar contenedores, redes y recursos efímeros sin acoplar los módulos de negocio a la CLI del sistema operativo.

## Lo que este módulo NO hace (Anti-Goals) ⚠️
- NO contiene lógica sobre qué paquetes instalar en los contenedores ni qué comandos de compilación ejecutar.
- NO maneja la autenticación ni sesiones de usuarios.
- NO usa librerías como `dockerode`; interactúa de manera directa mediante `child_process.spawn` con el binario de Docker para mayor control de timeouts, runtimes, buffers y stdout.

## Conceptos Clave (Glosario)
- **Runtime Seguro**: El entorno de ejecución de un contenedor. Si es `runsc`, usa gVisor para asegurar el aislamiento estricto de recursos y kernel.
- **Red Aislada**: Redes de docker etiquetadas y generalmente con bandera `--internal` para evitar exfiltración de datos.

## Dependencias Externas Clave
- **Docker CLI**: Requiere que el ejecutable `docker` esté presente en el PATH de la máquina host.
- **Node.js Child Process**: Para generar y controlar los procesos locales.

## Efectos Secundarios (Side Effects)
- Consume CPU, Memoria, Disco y red en el host ejecutando procesos y bajando imágenes.
- Crea procesos hijos (zombies si no se limpian) y redes virtuales persistentes hasta que sean borradas.

## Estado / BBDD
- Estado externo: El estado de los contenedores reside en el demonio Docker. Las queries consultan la API de Docker, no PostgreSQL.

## Puntos de Entrada (Entrypoints)
- `DockerExecutionService`: Fachada principal que orquesta red + contenedor de manera unificada.
- `DockerContainerService`: API cruda de contenedores.
- `DockerNetworkService`: API cruda de redes.
