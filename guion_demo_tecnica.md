# Guion completo para la presentación y demo de EduCodeAI

**Duración objetivo:** 34–36 minutos, más preguntas.

**Orden de la exposición:** mercado → estado del arte → posicionamiento → implementación → limitaciones → demo final.

**Idea central:** EduCodeAI no delega una nota en un modelo de lenguaje. Construye una cadena controlada en la que se ejecuta el software, se conserva evidencia, la IA interpreta esa evidencia, el sistema contrasta determinadas afirmaciones y el docente toma la decisión académica.

**Frase guía:** La evidencia observa; la IA interpreta; el sistema comprueba; el docente decide.

---

## Cómo utilizar este documento

- **Diapositiva** indica qué contenido debe aparecer en la presentación.
- **En pantalla** indica qué vista debe mostrarse durante la demo.
- Los párrafos en cita son el discurso propuesto.
- **Mensaje que debe quedar** ayuda a decidir qué recortar sin perder el argumento.
- **Transición** enlaza una sección con la siguiente y evita cambios bruscos.
- Los apartados de contingencia, preguntas y notas privadas no forman parte del tiempo principal.

No es necesario memorizar el texto literalmente. Conviene memorizar el comienzo, la frase guía, las transiciones y el cierre; el resto puede explicarse con naturalidad.

---

## Preparación previa

### Presentación

- Preparar trece diapositivas sencillas, con poco texto y una única idea por pantalla.
- Incluir una tabla comparativa legible del mercado, sin convertirla en una tabla de veinte características.
- Representar la arquitectura con un diagrama: navegador → API → PostgreSQL/MinIO y API → Redis/BullMQ → Worker → Docker/LLM.
- Representar el pipeline como seis etapas, resaltando la separación entre hechos y juicio.
- Reservar una diapositiva específica para limitaciones. Reconocerlas aumenta la credibilidad del trabajo.
- Añadir en pequeño las referencias académicas principales en las diapositivas de estado del arte.

### Demo

- Dejar abiertas dos sesiones independientes: docente y estudiante.
- Opcionalmente, preparar una tercera sesión de administración si se quiere enseñar la configuración de proveedores en la ruta /llm.
- Utilizar un único proyecto durante toda la historia. Debe tener:
  - contexto académico;
  - rúbrica con varios criterios;
  - resultado esperado;
  - plazo y límite de entregas;
  - suite de pruebas docente;
  - al menos un estudiante asignado.
- Preparar un ZIP pequeño que compile, pero que produzca un resultado incorrecto o falle alguna prueba. Así la evaluación genera evidencia interesante.
- Tener una entrega ya evaluada con:
  - propuesta de puntuación;
  - desglose por rúbrica;
  - una fortaleza;
  - una mejora concreta;
  - un hallazgo de calidad con archivo y línea;
  - logs, eventos y artefactos;
  - una advertencia o limitación visible, preferiblemente producida por el guardarraíl.
- Tener otra entrega lista para lanzar en directo.
- Ejecutar una evaluación de prueba antes de la defensa para verificar API, Worker, PostgreSQL, Redis, MinIO, Docker y proveedor LLM.
- Mantener abierta en otra pestaña la evaluación ya completada. Se utilizará si la ejecución en vivo tarda.
- Dejar el panel docente poblado con varias entregas para que el libro de calificaciones, el progreso y los indicadores de calidad tengan contenido.
- Ajustar el zoom y el tamaño de letra para que estados, resultados y logs puedan leerse desde lejos.
- Cerrar pestañas y terminales que puedan mostrar secretos, tokens o datos ajenos a la defensa.

---

## Mapa temporal

| Tiempo | Bloque | Idea principal |
| --- | --- | --- |
| 0:00–1:30 | Apertura | El problema no es solo corregir, sino hacerlo con rapidez, coherencia y trazabilidad |
| 1:30–5:00 | Qué existe en el mercado | Las funciones individuales ya tienen precedentes |
| 5:00–9:00 | Estado del arte | Los tests son fiables pero limitados; los LLM son flexibles pero probabilísticos |
| 9:00–11:00 | Posicionamiento | La aportación está en la arquitectura de confianza |
| 11:00–14:00 | Arquitectura | API y Worker separados, persistencia especializada y ejecución asíncrona |
| 14:00–16:30 | Dominio y consistencia | Entrega, ejecución y nota son entidades diferentes |
| 16:30–20:00 | Pipeline Builder | Planificar, ejecutar, observar, valorar, analizar y comunicar |
| 20:00–22:00 | Sandbox y seguridad | Defensa en profundidad, no seguridad absoluta |
| 22:00–23:30 | IA, trazabilidad y frontend | Multiproveedor, contratos, coste, SSE y vistas por rol |
| 23:30–25:00 | Limitaciones | Viabilidad técnica demostrada; eficacia a gran escala todavía pendiente |
| 25:00–35:00 | Demo final | Recorrido completo desde la configuración hasta la decisión docente |
| 35:00–36:00 | Cierre | Evidencia, interpretación, comprobación y decisión |

---

# Guion hablado

## 0:00–1:30 — Apertura: problema y objetivo

**Diapositiva 1 — EduCodeAI: evaluación de software asistida por IA**

Mostrar únicamente:

- el título;
- una captura limpia del producto;
- la frase “Evaluación asíncrona, trazable y supervisada”.

> Buenos días. Mi Trabajo Fin de Grado presenta EduCodeAI, una plataforma académica para gestionar y evaluar prácticas de programación mediante ejecución real del software e inteligencia artificial.
>
> El problema de partida es conocido: cuando crece el número de estudiantes, entregas e intentos, el profesorado debe recibir archivos, preparar entornos, ejecutar código que no es confiable, revisar pruebas, interpretar errores y convertir todo eso en feedback útil. Automatizar únicamente la comprobación de tests reduce parte de la carga, pero no siempre explica al estudiante qué concepto ha entendido mal. Utilizar únicamente un modelo de lenguaje produce explicaciones más flexibles, pero introduce variabilidad y afirmaciones que pueden no estar respaldadas por la ejecución.
>
> Por tanto, la pregunta no es simplemente cómo automatizar una nota. La pregunta es cómo combinar evidencia reproducible, interpretación generativa y supervisión docente sin confundir sus responsabilidades.
>
> Voy a presentar primero qué soluciones existen en el mercado y qué dice la literatura. Después explicaré la aportación y la implementación de EduCodeAI. Finalmente realizaré una demo completa de la plataforma.

**Mensaje que debe quedar:** el proyecto responde a una tensión real entre escala, riqueza del feedback y confianza.

**Transición:**

> Antes de explicar la solución, conviene comprobar si el problema ya está resuelto y en qué medida.

---

## 1:30–5:00 — Qué existe actualmente en el mercado

### 1:30–3:20 — Familias de soluciones

**Diapositiva 2 — Un mercado maduro, no un espacio vacío**

Mostrar tres columnas:

1. Autograders e integración con LMS.
2. Plataformas integrales de evaluación.
3. Entornos híbridos con IA.

> El mercado de evaluación de programación ya es maduro. No sería riguroso presentar EduCodeAI como la primera plataforma que recibe código, lo ejecuta o genera feedback.
>
> En un primer grupo aparecen herramientas centradas en autograding e integración educativa. Virtual Programming Lab, o VPL, se integra con Moodle, permite editar y ejecutar código, aplicar pruebas y separar el servidor académico de los servidores de ejecución mediante VPL-Jail-System. Es un referente especialmente cercano para el problema del aislamiento.
>
> En un segundo grupo encontramos plataformas de evaluación más completas. Gradescope admite actividades de programación con autograder y revisión manual. CodeGrade combina entregas, pruebas, rúbricas, feedback sobre líneas concretas e integración con distintos LMS.
>
> En un tercer grupo aparecen plataformas híbridas. Codio combina un entorno de desarrollo educativo, tests, rúbricas, revisión docente y funciones basadas en modelos de lenguaje. Vocareum proporciona laboratorios aislados, evaluación configurable, integración con LMS y una pasarela para gobernar proveedores, modelos y presupuestos de IA.
>
> Por tanto, el mercado ya cubre entrega de código, ejecución aislada, tests automáticos, rúbricas, feedback, revisión humana, tutoría con IA e incluso gestión multiproveedor. La contribución de EduCodeAI no puede consistir solamente en reunir esas palabras en una lista.

### 3:20–5:00 — Comparación y lectura correcta

**Diapositiva 3 — Comparación resumida**

| Capacidad | VPL / Gradescope | CodeGrade | Codio / Vocareum | EduCodeAI |
| --- | --- | --- | --- | --- |
| Entregas, ejecución y tests | Sí | Sí | Sí | Sí |
| Rúbrica y revisión docente | Sí | Sí | Sí | Sí |
| Asistencia generativa | No consta en las fuentes analizadas | Sí | Sí | Sí |
| LLM en la evaluación | No consta en las fuentes analizadas | No consta de forma explícita | Sí | Sí |
| Configuración de modelos o proveedores | No aplicable o no consta | Configurable | Sí | Sí |
| Control presupuestario de inferencia | No aplicable o no consta | No consta | Sí | Sí |
| Separación explícita hechos–juicio–verificación | No aplicable o no consta | No consta | No consta | Sí |
| Traza por cada reevaluación | Parcial | Parcial | Dependiente de la función / sí | Sí |

> Esta tabla no pretende declarar que una plataforma carece de una capacidad interna. “No consta” significa únicamente que no se ha encontrado documentada de forma explícita en las fuentes consultadas.
>
> La lectura importante es otra: casi todas las capacidades de EduCodeAI tienen precedentes individuales. VPL y Gradescope muestran que ejecución automática y aislamiento están consolidados. Gradescope y CodeGrade muestran que automatización y revisión manual pueden convivir. CodeGrade, Codio y Vocareum muestran que la IA generativa ya forma parte del producto educativo.
>
> Esto obliga a formular la aportación con más precisión. No se trata de afirmar que los competidores “solo ejecutan tests” ni de basar la defensa en una función aislada. La comparación relevante es cómo se construye y se puede reconstruir una decisión de evaluación.

**Mensaje que debe quedar:** EduCodeAI conoce sus precedentes y no exagera su novedad.

**Transición:**

> El mercado muestra qué se puede construir. La literatura ayuda a entender qué funciona, qué sigue siendo problemático y por qué la combinación necesita controles.

---

## 5:00–9:00 — Estado del arte

### 5:00–6:20 — Evaluación determinista

**Diapositiva 4 — Del autograder funcional al feedback cualitativo**

Mostrar:

- compilación;
- pruebas unitarias;
- comparación de salidas;
- análisis estático;
- una flecha hacia mantenibilidad, legibilidad y explicación pedagógica.

> La evaluación automática de programación es una línea de investigación consolidada. Tradicionalmente se apoya en compilación, ejecución de casos de prueba, comparación entre salidas y análisis estático.
>
> La revisión sistemática de Messer, Brown y Kölling, publicada en 2024, analizó 121 trabajos entre 2017 y 2021. La mayor parte se centraba en corrección funcional y utilizaba técnicas dinámicas, especialmente pruebas unitarias. El feedback típico informa qué prueba ha fallado o qué resultado era esperado.
>
> Esa evidencia es reproducible y valiosa, pero tiene un límite pedagógico. Saber que un test falla no explica necesariamente por qué falla, qué concepto está detrás o cómo mejorar la estructura de una solución. La revisión encontró mucha menos atención a aspectos como mantenibilidad, legibilidad o documentación.

### 6:20–7:30 — LLM como generadores de feedback

**Diapositiva 5 — Qué aportan los modelos de lenguaje**

Mostrar dos lados:

- Capacidad: contexto, explicación y adaptación.
- Riesgo: variabilidad, dependencia y falta de fundamentación.

> Los modelos de lenguaje amplían el espacio de automatización porque pueden procesar conjuntamente código, enunciado y rúbrica. Esto permite generar explicaciones contextualizadas y valorar propiedades que no se expresan fácilmente como aprobado o fallido.
>
> Pankiewicz y Baker estudiaron GPT-3.5 para producir indicaciones personalizadas. Los estudiantes valoraron positivamente su utilidad y aparecieron mejoras bajo determinadas condiciones, aunque también indicios de dependencia del feedback automático.
>
> Koutcheme y sus colaboradores compararon modelos abiertos y propietarios para generar y juzgar feedback. Algunos modelos abiertos pudieron aproximarse al rendimiento de alternativas propietarias. La consecuencia arquitectónica es clara: el proveedor no debería convertirse en una decisión irreversible; coste, disponibilidad, privacidad y calidad pueden aconsejar modelos diferentes.

### 7:30–9:00 — LLM como evaluadores y necesidad de verificación

**Diapositiva 6 — Consistencia no equivale a corrección**

Mostrar:

- más de 6.000 entregas;
- 18 modelos;
- 4 proveedores;
- concordancia docente moderada;
- cadena “generar → comprobar”.

> El problema se vuelve más exigente cuando el modelo deja de aconsejar y participa en la evaluación.
>
> Jukiewicz comparó dieciocho modelos de cuatro proveedores sobre más de seis mil entregas. Encontró diferencias sistemáticas: algunos modelos eran más permisivos, otros más restrictivos, y la concordancia con las calificaciones docentes se mantenía en niveles moderados. Esto significa que cambiar el modelo puede cambiar la distribución de puntuaciones aunque la entrega y la rúbrica sean las mismas.
>
> También hay que distinguir consistencia de corrección. Un modelo puede repetir de forma estable una valoración equivocada.
>
> La literatura sobre alucinaciones propone separar generación y verificación. Chain-of-Verification, de Dhuliawala y colaboradores, muestra precisamente el valor de revisar de manera explícita una respuesta generada. Aplicado a software, el principio es especialmente útil: leer un programa permite inferir lo que parece hacer, pero solo la ejecución permite observar qué ha ocurrido realmente.
>
> De aquí surge la decisión fundamental del proyecto: los logs, el código de salida y los resultados de pruebas son evidencia; la explicación y la valoración son un juicio. No deben representarse como si fueran la misma cosa.

**Mensaje que debe quedar:** los tests y los LLM resuelven problemas distintos y también fallan de maneras distintas.

**Transición:**

> Esta separación entre evidencia y juicio define el hueco concreto en el que se posiciona EduCodeAI.

---

## 9:00–11:00 — Posicionamiento y aportación de EduCodeAI

**Diapositiva 7 — Arquitectura de confianza**

Mostrar cuatro bloques:

1. Observar.
2. Interpretar.
3. Comprobar.
4. Decidir.

Debajo, una única frase: “Una evaluación debe poder reconstruirse”.

> EduCodeAI no pretende diferenciarse por añadir un chatbot a un autograder. Su aportación está en organizar las capacidades dentro de una cadena de confianza explícita.
>
> Primero, el sistema obtiene evidencia mediante la ejecución real. Después, un modelo interpreta esa evidencia junto con el código y la rúbrica. A continuación, un mecanismo determinista contrasta aquellas afirmaciones para las que sí existe una comprobación objetiva. Finalmente, el docente acepta, modifica o rechaza la propuesta y fija la nota académica.
>
> Además, la plataforma distingue una entrega de cada intento de evaluarla. Una misma entrega puede tener varias ejecuciones históricas sin sobrescribir las anteriores. Cada ejecución conserva estados, eventos, artefactos, modelos utilizados, consumo de tokens, coste y resultados intermedios.
>
> La aportación no es una tecnología única, sino una propiedad del conjunto: poder explicar qué se observó, qué interpretó el modelo, qué comprobó el sistema y quién tomó la decisión final.
>
> Esta idea se resume en la frase que articula toda la presentación: la evidencia observa; la IA interpreta; el sistema comprueba; el docente decide.

**Mensaje que debe quedar:** el elemento diferencial es la distribución explícita de responsabilidades y su trazabilidad.

**Transición:**

> Para materializar esta idea no basta con un buen prompt. Es necesario que la arquitectura completa respete esas fronteras.

---

## 11:00–14:00 — Implementación: arquitectura general

**Diapositiva 8 — Arquitectura de EduCodeAI**

Diagrama sugerido:

    React SPA
        │ REST + SSE
    NestJS API ───── PostgreSQL
        │            MinIO
        ▼
    Redis / BullMQ
        │
    NestJS Worker ── Docker
        │
        └─────────── Proveedores LLM

> EduCodeAI se implementa como un monorepositorio TypeScript. El frontend es una SPA construida con React y Vite. El backend utiliza NestJS, pero se despliega con dos roles de proceso diferentes.
>
> La API atiende HTTP, autentica, autoriza y coordina los casos de uso académicos. El Worker consume trabajos de BullMQ y es el único proceso que accede al daemon de Docker. Esta separación reduce la superficie de riesgo: el proceso expuesto a peticiones web no necesita controlar contenedores.
>
> Elegí un monolito modular, no una colección de microservicios. API y Worker comparten dominio, contratos y adaptadores, pero pueden arrancarse y dimensionarse por separado. Para el alcance de un TFG, esta solución mantiene fronteras claras sin introducir el coste operativo de una arquitectura distribuida completa.
>
> La persistencia también se divide por responsabilidad. PostgreSQL almacena el dominio académico y la traza duradera. Redis soporta BullMQ, coordinación y cachés acotadas. MinIO almacena objetos binarios, como entregas, suites docentes y artefactos. Docker proporciona los entornos efímeros de ejecución.
>
> El frontend consume REST para el estado normal y Server-Sent Events para seguir una evaluación. SSE encaja porque la comunicación es principalmente unidireccional. El cliente utiliza fetch para poder enviar el token en la cabecera de autorización.
>
> Finalmente, los proveedores de IA quedan detrás de adaptadores. La lógica del pipeline no depende directamente de una API concreta.

**Mensaje que debe quedar:** cada componente tiene una responsabilidad y solo el Worker cruza la frontera de Docker.

**Transición:**

> Sobre esta arquitectura hay una decisión de dominio muy importante: no tratar entrega, evaluación y nota como si fueran el mismo registro.

---

## 14:00–16:30 — Dominio, persistencia y consistencia

**Diapositiva 9 — Proyecto → asignación → entrega → ejecución → traza**

Mostrar la cadena:

    Proyecto
      └─ Asignación a estudiante
           └─ Entrega v1, v2...
                └─ BuildRun 1, BuildRun 2...
                     ├─ Eventos
                     ├─ Artefactos
                     └─ Propuesta automática

    Entrega ── nota oficial fijada por el docente

> El proyecto contiene el contexto académico, la rúbrica, el resultado esperado, los plazos y la suite docente. Una asignación relaciona ese proyecto con un estudiante. Una entrega representa una versión concreta del código. Y un BuildRun representa un intento concreto de evaluar esa entrega.
>
> Separar Delivery y BuildRun permite reevaluar el mismo código, conservar los intentos fallidos y comparar resultados sin destruir el historial. La propuesta de IA pertenece al BuildRun; la nota oficial pertenece a la entrega y solo cambia mediante una acción docente.
>
> Cuando se solicita una evaluación, la API comprueba acceso y cuota, persiste primero un BuildRun en estado QUEUED y después publica el trabajo en BullMQ. Estos dos sistemas no comparten una transacción. Por eso, si el encolado falla mientras la API sigue viva, el run se marca como fallido; y un reconciliador cubre el caso en que el proceso muera entre la persistencia y la publicación.
>
> La cola ofrece entrega al menos una vez, no exactamente una vez. El Worker reclama de forma atómica la transición de QUEUED a RUNNING. Si el mismo trabajo se recibe de nuevo, no vuelve a iniciar el pipeline. Además, una restricción de base de datos evita que una entrega tenga dos ejecuciones activas simultáneamente.
>
> Esta combinación de estados, restricciones, reclamación atómica y reconciliación es más importante que prometer una atomicidad inexistente entre PostgreSQL y Redis.

**Mensaje que debe quedar:** el sistema hace explícitos los límites de consistencia y los compensa.

**Transición:**

> Una vez que el Worker reclama la ejecución, comienza el núcleo del proyecto: el pipeline Builder.

---

## 16:30–20:00 — Pipeline de evaluación Builder

**Diapositiva 10 — Seis etapas con contratos estructurados**

Mostrar:

    1 Planificación
          ↓
    2 Compilación de receta
          ↓
    3 Ejecución aislada
          ↓
    4 Hechos + evaluación + guardarraíl
          ↓
    5 Calidad de código
          ↓
    6 Informe

Resaltar visualmente la etapa 4.

> El Builder organiza la evaluación en seis etapas. Cada una tiene entradas y salidas definidas y produce información trazable.
>
> En la primera etapa, planificación, se construye una representación limitada del código y un modelo propone cómo analizar el proyecto. No se envía indiscriminadamente todo el repositorio: se filtran extensiones relevantes, se excluyen dependencias y directorios de compilación y se limita el tamaño por fichero.
>
> En la segunda etapa, la propuesta se convierte en una receta controlada. El texto bruto del modelo no se ejecuta. Los comandos deben atravesar listas de ejecutables permitidos, controles de rutas y rechazo de metacaracteres. El objetivo no es confiar en que el modelo genere un comando seguro, sino validar su propuesta antes de utilizarla.
>
> La tercera etapa prepara el entorno y ejecuta la práctica. La construcción de dependencias puede requerir red y recibe únicamente los manifiestos necesarios, aunque esos manifiestos siguen siendo entrada no confiable. La ejecución final del código se realiza sin red y con límites de recursos.
>
> La cuarta etapa es la más importante. Primero se obtiene un contrato de hechos a partir de la ejecución: si compiló, qué código de salida produjo, qué apareció en stdout y stderr y qué pruebas se observaron. Después, otro contrato contiene el juicio pedagógico: estado evaluativo, puntuación, justificación y valoración por criterio.
>
> A continuación actúa un guardarraíl determinista. En la implementación actual comprueba tres clases concretas de contradicción: afirmar éxito cuando solo existen mensajes de compilación, declarar coincidencia sin que aparezca la salida esperada y aceptar como equivalentes valores numéricos diferentes. Si detecta una contradicción, añade una limitación y degrada una valoración positiva a estado E3 con confianza baja.
>
> La quinta etapa analiza calidad de código y produce hallazgos estructurados con severidad, archivo, línea y explicación conceptual. La sexta compone las distintas vistas del informe.
>
> La política de fallos es asimétrica. No poder ejecutar el código es una evidencia académica relevante y el informe debe reflejarla. En cambio, si falla la propia infraestructura, no se debe presentar ese fallo como si fuera culpa del estudiante.

**Mensaje que debe quedar:** el modelo participa en el proceso, pero no controla directamente la ejecución ni sustituye los hechos.

**Transición:**

> Como el pipeline ejecuta entradas potencialmente hostiles, la seguridad no puede quedar implícita.

---

## 20:00–22:00 — Sandbox y fronteras de confianza

**Diapositiva 11 — Defensa en profundidad**

Mostrar tres fronteras:

1. Entrada del archivo.
2. Contenedor de ejecución.
3. Worker y host Docker.

> La primera frontera es la subida. Los archivos se reciben temporalmente en disco, se valida tamaño y tipo, se calcula un hash y se transfieren a MinIO. Al extraer un archivo se bloquean rutas que intenten escapar del workspace y se limitan el número de entradas y el volumen descomprimido.
>
> La segunda frontera es el contenedor. La ejecución final utiliza red desactivada, capacidades Linux eliminadas, no-new-privileges, raíz de solo lectura, usuario no privilegiado, límites de procesos, CPU, memoria y tiempo, y un tmpfs para los temporales. La suite docente se monta separada del workspace del estudiante y en modo de solo lectura. Si se supera el tiempo, el Worker fuerza la eliminación del contenedor.
>
> La tercera frontera es el propio Worker. Montar docker.sock le concede una capacidad crítica sobre el host. Por eso la API no lo monta y un despliegue serio debe aislar el Worker en un host dedicado o con controles equivalentes. runc reduce el riesgo mediante contenedores, pero no equivale al aislamiento fuerte de una máquina virtual. La plataforma permite utilizar runsc o gVisor como endurecimiento adicional.
>
> La formulación correcta no es que Docker haga segura cualquier ejecución. La formulación correcta es que se aplica defensa en profundidad, se reduce la superficie de ataque y se reconoce explícitamente el riesgo residual.

**Mensaje que debe quedar:** el proyecto modela el código del estudiante como hostil y también declara el límite del aislamiento.

**Transición:**

> Además del código no confiable, hay otra dependencia probabilística y externa: los modelos de lenguaje.

---

## 22:00–23:30 — Multiproveedor, trazabilidad y frontend

**Diapositiva 12 — Capacidades transversales**

Mostrar cuatro iconos:

- multiproveedor;
- contratos;
- coste y artefactos;
- vistas por rol.

> EduCodeAI implementa adaptadores para Bedrock, Azure OpenAI, OpenAI, Anthropic, Gemini y Ollama. La configuración asigna proveedor y modelo a funciones como planificación, evaluación, calidad y tutoría. Los errores recuperables pueden activar alternativas configuradas y un circuit breaker evita insistir sobre un proveedor degradado.
>
> Las respuestas no se incorporan como texto libre al dominio. Se interpretan mediante contratos versionados y parsers defensivos. Por cada etapa se registra el modelo, los tokens, el coste y, cuando corresponde, los artefactos de prompt, respuesta y contrato interpretado.
>
> La interfaz aplica proyecciones distintas por rol. El docente puede revisar la evidencia completa y la propuesta; el estudiante recibe una vista pedagógica que excluye razonamiento y artefactos reservados. El tutor no recibe primero un contexto amplio para después intentar ocultar la solución: su contexto se construye desde una proyección permitida al estudiante.
>
> En el seguimiento en directo, el cliente recupera primero el backlog desde la última secuencia y después abre el flujo SSE. Si se desconecta, reintenta y deduplica los eventos. La interfaz en tiempo real no es la fuente de verdad; la traza durable permanece en PostgreSQL.

**Mensaje que debe quedar:** proveedor, coste, eventos y artefactos forman parte de la trazabilidad.

**Transición:**

> Antes de enseñar el resultado, quiero separar con claridad lo demostrado de lo que todavía necesita validación.

---

## 23:30–25:00 — Limitaciones y trabajo futuro

**Diapositiva 13 — Qué demuestra y qué no demuestra el TFG**

Dos columnas:

| Demostrado | Pendiente |
| --- | --- |
| Flujo funcional completo | Validación con cohortes reales |
| Evaluación asíncrona y trazable | Concordancia sistemática con docentes |
| Ejecución limitada y sin red | Auditoría externa y pentesting |
| Separación hechos–juicio–nota | Medición del sesgo de anclaje |
| Configuración multiproveedor y coste | Rendimiento y coste a gran escala |

> El resultado demuestra viabilidad técnica: existe un flujo completo desde la entrega hasta el informe y la calificación revisada. Pero una demo funcional no demuestra por sí sola eficacia educativa a gran escala.
>
> El despliegue actual no ofrece alta disponibilidad: PostgreSQL, Redis y MinIO son instancias únicas. API y Worker pueden dimensionarse por separado, pero el escalado horizontal no se ha validado bajo una carga objetivo. Tampoco existe todavía una plataforma completa de métricas y trazado distribuido.
>
> El guardarraíl cubre tres patrones concretos, no todas las formas posibles de error del modelo. El sandbox reduce riesgo, pero runc y el acceso del Worker al daemon mantienen riesgo residual. No se ha realizado una auditoría independiente.
>
> También falta medir concordancia con docentes, coste real por asignatura, ahorro de tiempo y sesgo de anclaje. Que la nota automática necesite confirmación humana evita una decisión autónoma, pero ver una cifra antes de calificar todavía puede influir.
>
> Las líneas futuras incluyen gVisor, alta disponibilidad, observabilidad, LTI 1.3, SAML u OIDC, estudios con docentes y cohortes reales y un análisis jurídico formal del RGPD y del Reglamento europeo de Inteligencia Artificial.

**Mensaje que debe quedar:** la memoria distingue honestamente viabilidad técnica de eficacia empírica.

**Transición hacia la demo:**

> Con este contexto ya podemos interpretar correctamente la demo. No voy a enseñar solo pantallas: voy a recorrer la cadena que acabamos de describir y señalar en cada punto qué responsabilidad está actuando.

---

# Demo final

## 25:00–25:40 — Presentar el escenario

**En pantalla:** sesión docente, proyecto preparado.

> Para la demo utilizaré una práctica sencilla con un resultado esperado y una rúbrica que separa corrección funcional, calidad y claridad. Tenemos una sesión docente y otra de estudiante. El objetivo es seguir una entrega desde su configuración hasta la decisión académica final.
>
> No voy a crear todos los datos desde cero porque eso consumiría tiempo sin demostrar la parte diferencial. Enseñaré la configuración relevante y después recorreré el flujo completo de entrega y evaluación.

---

## 25:40–27:00 — Configuración docente

**En pantalla:** proyecto, rúbrica, fechas, límite de intentos y suite docente.

> En el proyecto se define primero el contexto académico. El sistema no debería evaluar código sin saber qué actividad intenta resolver.
>
> Aquí aparecen el tipo de práctica, el resultado esperado y la rúbrica. Los criterios se almacenan de forma estructurada, por lo que el informe puede devolver un desglose por criterio en lugar de una explicación genérica.
>
> También se configuran la ventana de entrega y el número máximo de versiones. Las entregas tardías pueden conservarse como tales en lugar de desaparecer, dejando la decisión académica al docente.
>
> Finalmente, la suite de pruebas se almacena separada del código del estudiante. Durante la ejecución se monta en modo de solo lectura, evitando que la entrega pueda modificar la prueba que la evalúa.

**Si se muestra la asignación:**

> El proyecto se puede asignar a grupos o estudiantes concretos. Sin una asignación vigente no existe autorización para entregar.

**Transición:**

> Con la actividad preparada, cambio al punto de vista del estudiante.

---

## 27:00–28:30 — Entrega del estudiante

**En pantalla:** /mi-espacio o flujo de nueva entrega.

Acciones:

1. Seleccionar el proyecto.
2. Elegir el ZIP preparado.
3. Enseñar la vista previa.
4. Confirmar la entrega.

> El estudiante ve únicamente sus proyectos asignados, los plazos y los intentos disponibles.
>
> Selecciono el archivo. El cliente comprueba el límite de tamaño y, para ZIP, muestra una vista previa que permite detectar antes de enviar una estructura equivocada. Esta comprobación mejora la experiencia, pero la validación de seguridad real permanece en el servidor.
>
> Al confirmar, primero se crea la entidad Delivery. Después se calcula el hash y se sube el binario. La API lo recibe en un fichero temporal para no mantener todo el cuerpo en memoria, vuelve a comprobar la entrada y lo transfiere a MinIO. Cuando los metadatos quedan persistidos, la entrega pasa de borrador a enviada.
>
> La operación cruza PostgreSQL y MinIO, que no comparten transacción. Por eso se utilizan estados y compensaciones: no conviene describirla como una única transacción atómica.

**Señalar:** versión de la entrega, estado y hash si es visible.

**Transición:**

> La entrega ya existe, pero todavía no se ha confundido con su evaluación. Ahora voy a crear un BuildRun independiente.

---

## 28:30–29:40 — Lanzamiento y cola

**En pantalla:** botón de evaluar y estado QUEUED.

> Al lanzar la evaluación, la API comprueba que el usuario puede hacerlo y que el proyecto mantiene cuota disponible. Después registra un BuildRun en estado QUEUED y publica el trabajo en BullMQ.
>
> La respuesta es inmediata porque ejecutar, analizar y llamar a proveedores externos no debe bloquear una petición HTTP.
>
> La cola puede entregar un trabajo más de una vez. La protección está en el dominio y en la base de datos: solo puede existir una ejecución activa por entrega y el Worker reclama atómicamente el cambio de QUEUED a RUNNING.

**Si se ve la estimación temporal:**

> La interfaz puede orientar con el histórico reciente, pero no promete una duración exacta porque depende de compilación, contenedor y proveedores externos.

**Transición:**

> A partir de este momento podemos observar el trabajo del Worker sin convertir el navegador en la fuente de verdad.

---

## 29:40–30:50 — Seguimiento en directo

**En pantalla:** eventos y logs en vivo.

> El estado cambia a RUNNING y empiezan a aparecer eventos del pipeline.
>
> El navegador recibe estos cambios mediante SSE. Antes de abrir el flujo recupera los eventos persistidos posteriores a la última secuencia conocida. Si la conexión se pierde, vuelve a solicitar el backlog y reconecta. De esta forma, una interrupción visual no borra la historia de la evaluación.
>
> Los eventos permiten saber si el sistema está planificando, preparando el entorno, ejecutando, evaluando o componiendo el informe. Los logs se agrupan para evitar convertir cada fragmento de salida en una escritura independiente.

**Si la ejecución sigue activa después de mostrar varios eventos:**

> La asincronía se aprecia precisamente aquí. Para no esperar a un proveedor o a una construcción en directo, voy a abrir una ejecución ya completada de la misma práctica. Al final podremos volver a esta.

Abrir la pestaña preparada.

---

## 30:50–32:50 — Informe y evidencia

**En pantalla:** informe completado.

Recorrido recomendado:

1. Resumen.
2. Evidencia de ejecución.
3. Desglose por rúbrica.
4. Limitaciones o advertencias.
5. Hallazgos de calidad.

> Este es el resultado consolidado. Conviene leerlo en el mismo orden en el que se construyó.
>
> Primero vemos el resultado general, pero debajo permanece la evidencia: compilación, código de salida, stdout, stderr y resultados observados. Esta capa responde qué ocurrió.
>
> Después aparece la valoración por criterios. Esta capa responde cómo se interpreta lo ocurrido respecto de la actividad. La propuesta está estructurada y vinculada a la rúbrica; no es únicamente un párrafo libre.
>
> Si el modelo hubiese declarado un resultado incompatible con los logs, el guardarraíl añadiría una limitación y degradaría la confianza. El objetivo no es afirmar que desaparecen todas las alucinaciones, sino impedir que determinadas contradicciones objetivas pasen silenciosamente como una evaluación positiva.
>
> Finalmente aparecen los hallazgos de calidad. Cada uno puede incorporar categoría, severidad, archivo, línea, fragmento y explicación conceptual, de manera que el feedback sea accionable.

**Si hay artefactos visibles para docente:**

> La ejecución conserva artefactos y metadatos del proceso, incluidos modelo, consumo y coste. Esto permite investigar posteriormente cómo se produjo un resultado y comparar reevaluaciones.

**Transición:**

> El mismo BuildRun no se presenta igual a todos los usuarios.

---

## 32:50–33:40 — Vista del estudiante y tutor

**En pantalla:** informe desde la sesión estudiante y tutor pedagógico.

> El estudiante recibe una proyección pedagógica. No se exponen el razonamiento interno, la solución de referencia ni los artefactos reservados al personal docente.
>
> El tutor permite preguntar sobre una evaluación ya terminada. Su contexto se construye desde campos expresamente permitidos para el estudiante. No se confía únicamente en decir al modelo que no revele la solución.

Realizar una pregunta breve:

> ¿Qué debería revisar primero para corregir esta entrega sin darme la solución?

Después de la respuesta:

> La finalidad es orientar el siguiente paso, no sustituir el proceso de aprendizaje.

**Transición:**

> Vuelvo al docente, porque todavía falta la única acción con efecto académico final.

---

## 33:40–34:30 — Revisión y nota oficial

**En pantalla:** revisión docente o libro de calificaciones.

> Esta cifra es una propuesta automática asociada al BuildRun. No es todavía la nota oficial.
>
> El docente puede contrastarla con la evidencia, aceptar el resultado, modificarlo o rechazarlo. Solo al confirmar se guarda la calificación efectiva en la entrega.
>
> Mantener separadas propuesta y nota permite medir posteriormente cuánto coincide el sistema con el profesorado. También evita una decisión completamente autónoma, aunque no elimina por sí sola el posible sesgo de anclaje.

Editar ligeramente la nota o las observaciones si ayuda a que la diferencia sea visible y confirmar.

---

## 34:30–35:00 — Valor para el grupo

**En pantalla:** panel docente, progreso, libro de calificaciones e indicadores agregados de calidad.

> El recorrido individual termina en una nota revisada, pero el valor docente continúa a escala de grupo.
>
> El libro de calificaciones indica quién ha sido evaluado. El resumen de progreso permite localizar entregas pendientes o retrasadas. Y los indicadores de calidad responden una pregunta más pedagógica: qué errores se repiten y qué conviene explicar en la siguiente clase.
>
> La plataforma hace operativa esta visión, aunque el ahorro real de tiempo todavía debe medirse con usuarios y cohortes reales.

---

## 35:00–36:00 — Cierre

**En pantalla:** permanecer en el panel o volver al resumen del BuildRun. No regresar a una diapositiva cargada.

> Con esta demo hemos recorrido las cuatro responsabilidades de la arquitectura.
>
> La ejecución y las pruebas han producido evidencia. Los modelos han interpretado esa evidencia en el contexto del código y de la rúbrica. El sistema ha aplicado contratos y comprobaciones deterministas. Y el docente ha conservado la decisión académica final.
>
> EduCodeAI no se diferencia por añadir IA a un autograder, sino por convertir la evaluación en una cadena trazable y revisable.
>
> La evidencia observa. La IA interpreta. El sistema comprueba. El docente decide.
>
> Muchas gracias. Quedo a vuestra disposición para las preguntas.

---

# Plan de contingencia para la demo

## Si la evaluación en vivo tarda

No esperar en silencio más de treinta o cuarenta segundos.

> La evaluación es asíncrona precisamente porque su duración no debe bloquear la interfaz. Mientras continúa, abriré otra ejecución de la misma práctica que ya está completada y recorreremos el resultado.

Volver al run en directo al final si ya ha terminado.

## Si falla el flujo SSE

> El canal en directo se ha interrumpido. Esto permite distinguir transporte de persistencia: los eventos confirmados siguen en PostgreSQL y la interfaz puede recuperar el backlog desde la última secuencia.

Actualizar una vez. Si no se recupera, continuar con la ejecución preparada.

## Si falla un proveedor LLM

No lanzar reintentos manuales repetidos.

> El proveedor externo forma parte de la superficie de fallo. El sistema distingue errores recuperables, puede utilizar alternativas configuradas y conserva el estado y la traza del BuildRun. Para no convertir la defensa en una espera de un tercero, continuaré con una ejecución completada.

## Si Docker no está disponible

> La API permanece separada del daemon. La indisponibilidad del Worker impide nuevas evaluaciones, pero no elimina entregas, informes ni trazas ya persistidas.

Mostrar una evaluación previa.

## Si falla la subida

> La entrega y el objeto se gestionan mediante estados y compensaciones porque PostgreSQL y MinIO no comparten una transacción. Utilizaré la entrega ya preparada para continuar el recorrido.

## Si se pierde demasiado tiempo

Recortar en este orden:

1. No abrir /llm.
2. No realizar una pregunta real al tutor.
3. Resumir el seguimiento SSE en una frase.
4. Enseñar solo un hallazgo de calidad.
5. Reducir la visión agregada a veinte segundos.

No recortar:

- la comparación con el mercado;
- el resultado principal del estado del arte;
- la separación hechos–juicio–nota;
- el guardarraíl;
- la revisión docente;
- las limitaciones.

---

# Preguntas previsibles y respuestas breves

## ¿En qué se diferencia de VPL, Gradescope, CodeGrade, Codio o Vocareum?

No en una función aislada. Esas plataformas ya ofrecen diferentes combinaciones de entrega, ejecución, tests, rúbricas, IA y revisión humana. EduCodeAI se posiciona en la organización explícita de la confianza: distingue entrega y reevaluación, separa hechos y juicio, contrasta determinadas afirmaciones con la ejecución real y vincula modelo, coste, eventos y artefactos a un BuildRun revisable.

## ¿No podría resolverse simplemente con tests?

Los tests son la mejor evidencia para los casos previstos, pero no explican siempre el error conceptual ni evalúan fácilmente claridad, organización o mantenibilidad. El LLM añade interpretación cualitativa; no sustituye la ejecución.

## ¿Por qué no utilizar únicamente un LLM?

Porque leer código no certifica qué ocurrió al ejecutarlo. Además, distintos modelos pueden ser más permisivos o restrictivos. Por eso el modelo recibe evidencia real y su resultado queda sometido a contratos, guardarraíles y revisión docente.

## ¿Qué impide que el modelo invente que el programa funciona?

La evaluación utiliza logs reales y contratos separados de hechos y juicio. Un guardarraíl contrasta tres contradicciones concretas y degrada resultados positivos incompatibles con la evidencia. No es una garantía universal, por lo que la propuesta sigue siendo revisable.

## ¿Por qué seis etapas y no una sola llamada al modelo?

Porque cada fase tiene una responsabilidad, un contrato y una política de fallo diferentes. La separación permite validar entradas, conservar resultados intermedios, cambiar proveedores por función y localizar en qué punto se produjo un problema.

## ¿Qué ocurre si llegan dos solicitudes de evaluación al mismo tiempo?

Una restricción de PostgreSQL impide dos runs activos para la misma entrega. El Worker reclama además de forma atómica QUEUED → RUNNING, por lo que una segunda recepción del mismo trabajo de cola no vuelve a iniciar el pipeline.

## ¿Qué pasa si Redis falla después de crear el BuildRun?

El BuildRun ya es durable. Si el fallo se devuelve a la API, se marca inmediatamente como FAILED. Si el proceso muere entre persistir y encolar, un reconciliador detecta runs QUEUED antiguos sin trabajo válido.

## ¿Por qué SSE y no WebSockets?

El flujo es principalmente servidor → cliente. SSE reutiliza HTTP y es suficiente para eventos incrementales. Se consume mediante fetch para adjuntar Authorization, recuperar el backlog y controlar la reconexión sin incluir tokens en la URL.

## ¿Puede el estudiante modificar las pruebas?

La suite docente se almacena separada y se monta en modo de solo lectura fuera del workspace del estudiante.

## ¿Puede el tutor revelar la solución?

El contexto se construye desde una proyección permitida al estudiante. La solución de referencia, el razonamiento interno y los artefactos reservados no se incluyen. Sigue existiendo riesgo residual de generación, pero se reduce la posibilidad de fuga desde el contexto.

## ¿Docker basta para ejecutar código hostil?

No. Se aplican restricciones de red, usuario, capacidades, sistema de archivos, procesos, CPU, memoria y tiempo. Aun así, runc comparte kernel y docker.sock es una frontera crítica. Un despliegue real debe aislar el Worker y puede emplear gVisor u otra frontera reforzada.

## ¿Por qué un monolito modular y no microservicios?

Porque el dominio comparte muchos contratos y el volumen del prototipo no justifica la complejidad de desplegar numerosos servicios. API y Worker ya separan las cargas y privilegios que sí son materialmente diferentes, conservando un único modelo de dominio.

## ¿Por qué PostgreSQL, Redis y MinIO?

PostgreSQL aporta integridad relacional y una traza durable; Redis ofrece las primitivas necesarias para BullMQ y coordinación rápida; MinIO evita almacenar binarios grandes dentro de la base relacional y ofrece una interfaz compatible con S3.

## ¿Cómo demostrarías que mejora realmente la corrección?

Con un corpus representativo y doble corrección ciega: concordancia por criterio, tasa de modificación de propuestas, falsos positivos y negativos del guardarraíl, tiempo docente, coste por entrega y análisis de errores por modelo.

## ¿La revisión humana elimina el riesgo de una nota injusta?

Evita que la propuesta tenga efecto automático, pero no elimina el sesgo de anclaje. Habría que comparar docentes que califican antes y después de ver la propuesta y medir cuánto cambia su decisión.

## ¿Cumple ya el RGPD y el Reglamento europeo de Inteligencia Artificial?

No se presenta como una certificación. La supervisión humana, la trazabilidad y el filtrado por rol son una base técnica. Un despliegue institucional necesita análisis jurídico, evaluación de riesgos, política de retención, base legal para enviar datos a proveedores y la documentación exigible.

## ¿Detecta plagio?

No es una capacidad central del flujo implementado. Añadirla requeriría un subsistema propio, tratamiento de falsos positivos, garantías de privacidad y revisión humana.

## ¿Por qué hay varios proveedores?

Porque el modelo no es una decisión neutral ni permanente. El proveedor puede elegirse por calidad, privacidad, coste, disponibilidad o necesidades de cada etapa. La abstracción también permite comparar resultados y reducir dependencia tecnológica.

---

# Frases que conviene utilizar y evitar

| Evitar | Utilizar |
| --- | --- |
| “Somos la primera plataforma que combina IA y autograding” | “La aportación está en cómo se organiza y traza la cadena de evaluación” |
| “Los competidores solo ejecutan tests” | “El mercado ya ofrece soluciones deterministas e híbridas con capacidades amplias” |
| “La IA pone la nota” | “La IA propone una valoración; el docente fija la nota oficial” |
| “Docker hace que ejecutar código sea seguro” | “Aplicamos defensa en profundidad y reconocemos el riesgo residual” |
| “La cola procesa exactamente una vez” | “La cola entrega al menos una vez y el Worker reclama el estado de forma idempotente” |
| “La subida es una transacción atómica” | “La operación cruza PostgreSQL y MinIO y utiliza estados y compensaciones” |
| “El guardarraíl elimina las alucinaciones” | “Detecta tres clases concretas de contradicción con la evidencia” |
| “El sistema ya escala horizontalmente” | “API y Worker pueden dimensionarse por separado; falta validarlo bajo carga” |
| “La plataforma demuestra que ahorra tiempo” | “La plataforma hace medible esa hipótesis; el ahorro requiere validación de campo” |
| “EduCodeAI cumple el Reglamento de IA” | “La trazabilidad y la supervisión son una base; el cumplimiento requiere evaluación formal” |

---

# Versión comprimida de 25 minutos

Si el tribunal impone un límite menor:

- Apertura: 1 minuto.
- Mercado: 2 minutos, agrupando las plataformas en tres familias.
- Estado del arte: 3 minutos, manteniendo la revisión sistemática, Jukiewicz y verificación.
- Posicionamiento: 1 minuto.
- Arquitectura e implementación: 6 minutos.
- Limitaciones: 1 minuto.
- Demo: 10 minutos.
- Cierre: 1 minuto.

En la demo comprimida:

1. Mostrar la configuración docente sin editarla.
2. Subir la entrega.
3. Lanzar la evaluación y mostrar dos eventos.
4. Abrir inmediatamente el run completado.
5. Enseñar evidencia, rúbrica, un hallazgo y la nota docente.
6. Mostrar el panel agregado durante veinte segundos.

---

# Notas privadas de coherencia entre memoria y código

**No leer durante la presentación.** Sirven para evitar afirmaciones vulnerables si el tribunal compara la memoria con la implementación.

1. **Composición del comando final.** La memoria afirma que el comando final evita cadenas interpretadas por un shell. La implementación valida la propuesta como tokens, ejecutables, rutas y metacaracteres, pero finalmente construye una receta controlada que utiliza sh -c. En la defensa debe afirmarse que no se ejecuta texto bruto del LLM; no conviene afirmar que no interviene ningún shell.

2. **Construcción con red.** La memoria indica que el código del estudiante no está presente durante la fase con red. Se copia un conjunto reducido de manifiestos de dependencias, no el árbol completo, pero esos manifiestos siguen controlados por el estudiante y algunos pueden activar lógica de instalación. Conviene hablar de reducción de exposición, no de ausencia total de entrada no confiable.

3. **Contexto del tutor.** La memoria describe la eliminación de secciones sensibles de un artefacto amplio. La implementación actual construye el contexto desde una proyección explícitamente permitida al estudiante. Puede presentarse como un endurecimiento posterior hacia una lista blanca.

4. **Seguridad, escalabilidad e inmediatez.** Algunas frases de la conclusión de la memoria son más fuertes que el capítulo de limitaciones. En la defensa conviene decir: el sandbox reduce riesgo; la arquitectura permite dimensionar API y Worker, pero no se ha validado horizontalmente; y la evaluación es asíncrona, no necesariamente instantánea.

---

# Referencias para preparar las diapositivas

Estas referencias se muestran en pequeño o se incorporan a las notas; no es necesario leerlas.

## Estado del mercado

- [Virtual Programming Lab — características oficiales](https://vpl.dis.ulpgc.es/index.php/en/about/features)
- [Virtual Programming Lab — documentación e introducción](https://vpl.dis.ulpgc.es/documentation/vpl-4.4.2/introduction.html)
- [Gradescope — creación de actividades de programación](https://guides.gradescope.com/hc/en-us/articles/22254107840909-Creating-a-Programming-Assignment)
- [CodeGrade — autograding e integración con LMS](https://www.codegrade.com/solutions/learning-and-grading-in-one-place)
- [Codio — documentación de calificación](https://docs.codio.com/instructors/teaching/grading/grading.html)
- [Vocareum — laboratorios y evaluación](https://www.vocareum.com/virtual-labs/)

## Estado del arte académico

- Messer, Brown y Kölling, “Automated Grading and Feedback Tools for Programming Education: A Systematic Review”, 2024. DOI: 10.1145/3636515.
- Pitts, Hridi y Lekshmi Narayanan, “A Survey of LLM-Based Applications in Programming Education: Balancing Automation and Human Oversight”, 2025. DOI: 10.18653/v1/2025.hcinlp-1.21.
- Pankiewicz y Baker, “Large Language Models (GPT) for Automating Feedback on Programming Assignments”, 2023. DOI: 10.58459/icce.2023.950.
- Koutcheme et al., “Evaluating Language Models for Generating and Judging Programming Feedback”, 2025. DOI: 10.1145/3641554.3701791.
- Jukiewicz, “A Systematic Comparison of Large Language Models for Automated Assignment Assessment in Programming Education”, 2026. DOI: 10.1016/j.caeo.2026.100364.
- Dhuliawala et al., “Chain-of-Verification Reduces Hallucination in Large Language Models”, 2024. DOI: 10.18653/v1/2024.findings-acl.212.

## Fuente principal del contenido

- Memoria “EduCodeAI: Plataforma académica para la corrección de software asistida por IA”, versión 3.
- Especialmente: capítulo 2 para mercado y estado del arte; capítulo 4 para diseño e implementación; capítulos 5, 6 y 7 para demo, limitaciones y trabajo futuro.
