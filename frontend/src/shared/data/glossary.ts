/**
 * @fileoverview Módulo de la interfaz de usuario (glossary).
 *
 * @module glossary
 */

import {
  CAPABILITY_LABELS,
  EVALUATIVE_STATE_LABELS,
  STRUCTURAL_TYPE_LABELS,
} from "./builderTaxonomy";

interface GlossaryEntry {
  term: string;
  title: string;
  description: string;
}

/**
 * Los títulos de los términos codificados (E, T, C) se derivan de
 * [[builderTaxonomy]] para que el tooltip diga exactamente lo mismo que la
 * etiqueta visible, con el código entre paréntesis como referencia técnica.
 */
function codedTitle(labels: Record<string, string>, term: string): string {
  return `${labels[term]} (${term})`;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: "E1",
    title: codedTitle(EVALUATIVE_STATE_LABELS, "E1"),
    description:
      "El programa se ejecutó de principio a fin y su salida se pudo comparar con el resultado esperado.",
  },
  {
    term: "E2",
    title: codedTitle(EVALUATIVE_STATE_LABELS, "E2"),
    description:
      "El programa arrancó y produjo salida, pero no toda es correcta. Revisa el desglose por criterios para ver qué falló.",
  },
  {
    term: "E3",
    title: codedTitle(EVALUATIVE_STATE_LABELS, "E3"),
    description:
      "El programa no compiló, no arrancó o no llegó a imprimir nada evaluable. Comprueba que compila y que escribe algo por pantalla antes de reenviar.",
  },
  {
    term: "E4",
    title: codedTitle(EVALUATIVE_STATE_LABELS, "E4"),
    description:
      "La evaluación automática no pudo completarse con la evidencia disponible. No es un juicio sobre tu código: vuelve a lanzar la evaluación o avisa a tu profesor.",
  },
  {
    term: "T1",
    title: codedTitle(STRUCTURAL_TYPE_LABELS, "T1"),
    description:
      "Proyecto simple o directo, sin mucha orquestación alrededor del punto de entrada principal.",
  },
  {
    term: "T2",
    title: codedTitle(STRUCTURAL_TYPE_LABELS, "T2"),
    description:
      "Proyecto con algo más de estructura interna, pero aún con flujo de ejecución bastante directo.",
  },
  {
    term: "T3",
    title: codedTitle(STRUCTURAL_TYPE_LABELS, "T3"),
    description:
      "Proyecto con varias piezas coordinadas o dependencias que requieren más contexto para ejecutarse.",
  },
  {
    term: "T4",
    title: codedTitle(STRUCTURAL_TYPE_LABELS, "T4"),
    description:
      "Proyecto de estructura más compleja o especializada, donde el builder necesita una receta clara para ejecutarlo.",
  },
  {
    term: "C1",
    title: codedTitle(CAPABILITY_LABELS, "C1"),
    description:
      "Capacidad del sistema para identificar la forma general del proyecto y su contrato de ejecución."
  },
  {
    term: "C2",
    title: codedTitle(CAPABILITY_LABELS, "C2"),
    description:
      "Capacidad del sistema para proponer un comando principal de ejecución con suficientes señales observables.",
  },
  {
    term: "C3",
    title: codedTitle(CAPABILITY_LABELS, "C3"),
    description:
      "Capacidad del sistema para reconocer servicios persistentes o procesos que necesitan healthcheck.",
  },
  {
    term: "C4",
    title: codedTitle(CAPABILITY_LABELS, "C4"),
    description:
      "Capacidad del sistema para localizar señales de test y validación automática.",
  },
  {
    term: "C5",
    title: codedTitle(CAPABILITY_LABELS, "C5"),
    description:
      "Capacidad del sistema para comprobar que un servicio responde de forma observable.",
  },
  {
    term: "C6",
    title: codedTitle(CAPABILITY_LABELS, "C6"),
    description:
      "Capacidad del sistema para reconocer configuración externa o dependencias declarativas relevantes.",
  },
  {
    term: "Apto",
    title: "Resultado apto",
    description:
      "La entrega supera los requisitos esenciales evaluados y no presenta bloqueos que impidan aprobar.",
  },
  {
    term: "No apto",
    title: "Resultado no apto",
    description:
      "La entrega aún no cumple el mínimo necesario o tiene errores que impiden validarla como aprobada.",
  },
  {
    term: "Capacidades",
    title: "Capacidades del sistema",
    description:
      "Señales que resumen lo que DockUS sí pudo reconocer, ejecutar o validar dentro de tu entrega.",
  },
];

const glossaryMap = new Map(
  GLOSSARY_ENTRIES.map((entry) => [entry.term.toUpperCase(), entry]),
);

export function findGlossaryEntry(term: string): GlossaryEntry | null {
  return glossaryMap.get(term.trim().toUpperCase()) ?? null;
}
