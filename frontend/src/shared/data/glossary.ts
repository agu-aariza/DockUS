export interface GlossaryEntry {
  term: string;
  title: string;
  description: string;
}

const GLOSSARY_ENTRIES: GlossaryEntry[] = [
  {
    term: "E1",
    title: "Estado evaluativo 1",
    description:
      "La entrega cumple lo esencial y el sistema pudo validarla con suficiente confianza.",
  },
  {
    term: "E2",
    title: "Estado evaluativo 2",
    description:
      "La entrega funciona de forma parcial o necesita correcciones antes de considerarse completa.",
  },
  {
    term: "E3",
    title: "Estado evaluativo 3",
    description:
      "Hubo un bloqueo operativo o una contradiccion fuerte con la rubrica que impidio validar el trabajo.",
  },
  {
    term: "E4",
    title: "Estado evaluativo 4",
    description:
      "La entrega no se pudo validar por una situacion degradada o una falta de evidencia suficiente.",
  },
  {
    term: "T1",
    title: "Tipo estructural 1",
    description:
      "Proyecto simple o directo, sin mucha orquestacion alrededor del punto de entrada principal.",
  },
  {
    term: "T2",
    title: "Tipo estructural 2",
    description:
      "Proyecto con algo mas de estructura interna, pero aun con flujo de ejecucion bastante directo.",
  },
  {
    term: "T3",
    title: "Tipo estructural 3",
    description:
      "Proyecto con varias piezas coordinadas o dependencias que requieren mas contexto para ejecutarse.",
  },
  {
    term: "T4",
    title: "Tipo estructural 4",
    description:
      "Proyecto de estructura mas compleja o especializada, donde el builder necesita una receta clara para ejecutarlo.",
  },
  {
    term: "C1",
    title: "Capacidad C1",
    description:
      "Capacidad del sistema para identificar la forma general del proyecto y su contrato de ejecucion.",
  },
  {
    term: "C2",
    title: "Capacidad C2",
    description:
      "Capacidad del sistema para proponer un comando principal de ejecucion con suficientes senales observables.",
  },
  {
    term: "C3",
    title: "Capacidad C3",
    description:
      "Capacidad del sistema para reconocer servicios persistentes o procesos que necesitan healthcheck.",
  },
  {
    term: "C4",
    title: "Capacidad C4",
    description:
      "Capacidad del sistema para localizar senales de test y validacion automatica.",
  },
  {
    term: "C5",
    title: "Capacidad C5",
    description:
      "Capacidad del sistema para comprobar que un servicio responde de forma observable.",
  },
  {
    term: "C6",
    title: "Capacidad C6",
    description:
      "Capacidad del sistema para reconocer configuracion externa o dependencias declarativas relevantes.",
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
      "La entrega aun no cumple el minimo necesario o tiene errores que impiden validarla como aprobada.",
  },
  {
    term: "Capacidades",
    title: "Capacidades del sistema",
    description:
      "Senales que resumen lo que DockUS si pudo reconocer, ejecutar o validar dentro de tu entrega.",
  },
];

const glossaryMap = new Map(
  GLOSSARY_ENTRIES.map((entry) => [entry.term.toUpperCase(), entry]),
);

export function findGlossaryEntry(term: string): GlossaryEntry | null {
  return glossaryMap.get(term.trim().toUpperCase()) ?? null;
}
