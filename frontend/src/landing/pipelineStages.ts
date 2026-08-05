/**
 * @fileoverview Etapas del pipeline mostradas en las superficies públicas.
 *
 * @module pipelineStages
 */

/**
 * Las seis etapas reales del pipeline, en orden
 * (`builder/application/services/stages/`). Van numeradas porque son una
 * secuencia de verdad: el orden es información, no adorno.
 *
 * `summary` se ve siempre; `detail` se despliega al pasar el cursor o al
 * recibir foco. Ambos describen comportamiento real del builder —receta de
 * Docker, contenedor sin privilegios ni red, doble pasada de evaluación
 * contra los hechos, informe consolidado sin prompts en bruto—; si el
 * pipeline cambia, esto se corrige, no se adorna.
 *
 * Vive aquí, y no dentro de un componente, porque lo comparten la landing y
 * la pantalla de acceso.
 */
export const PIPELINE_STAGES = [
  {
    id: "plan",
    summary: "Se planifica la estrategia de evaluación.",
    detail:
      "El modelo examina la entrega y deduce qué imagen base, qué comandos y qué tiempos hacen falta. El resultado es la receta con la que se construirá el contenedor.",
  },
  {
    id: "compile",
    summary: "Se construye la imagen y se compila el código.",
    detail:
      "Se levanta la imagen según la receta y se compilan las fuentes. Si algo no compila, el error queda recogido con su salida completa antes de intentar ejecutar nada.",
  },
  {
    id: "execution",
    summary: "Se ejecuta aislado en un contenedor.",
    detail:
      "El código corre en un contenedor sin privilegios y sin salida a la red, con límites de tiempo y memoria. Nunca se ejecuta en el servidor ni en el equipo del docente.",
  },
  {
    id: "quality",
    summary: "Se analiza la calidad del código.",
    detail:
      "Análisis estático sobre las fuentes: estilo, estructura y malas prácticas quedan registrados como hallazgos, y acompañan después a la nota en calidad de evidencia.",
  },
  {
    id: "evaluation",
    summary: "Se evalúa el resultado con el modelo.",
    detail:
      "El modelo contrasta la traza de ejecución con la rúbrica del profesorado. Una segunda pasada revisa esa evaluación contra los hechos registrados para descartar alucinaciones.",
  },
  {
    id: "report",
    summary: "Se emite el informe con la retroalimentación.",
    detail:
      "Todo se consolida en un informe estructurado: qué ha fallado, por qué y qué conviene revisar. El estudiante recibe ese informe; nunca los prompts ni las respuestas en bruto.",
  },
] as const;
