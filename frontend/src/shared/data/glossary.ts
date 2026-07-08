interface GlossaryEntry {
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
      "Hubo un bloqueo operativo o una contradicción fuerte con la rúbrica que impidió validar el trabajo.",
  },
  {
    term: "E4",
    title: "Estado evaluativo 4",
    description:
      "La entrega no se pudo validar por una situación degradada o una falta de evidencia suficiente.",
  },
  {
    term: "T1",
    title: "Tipo estructural 1",
    description:
      "Proyecto simple o directo, sin mucha orquestación alrededor del punto de entrada principal.",
  },
  {
    term: "T2",
    title: "Tipo estructural 2",
    description:
      "Proyecto con algo más de estructura interna, pero aún con flujo de ejecución bastante directo.",
  },
  {
    term: "T3",
    title: "Tipo estructural 3",
    description:
      "Proyecto con varias piezas coordinadas o dependencias que requieren más contexto para ejecutarse.",
  },
  {
    term: "T4",
    title: "Tipo estructural 4",
    description:
      "Proyecto de estructura más compleja o especializada, donde el builder necesita una receta clara para ejecutarlo.",
  },
  {
    term: "C1",
    title: "Capacidad C1",
    description:
      "Capacidad del sistema para identificar la forma general del proyecto y su contrato de ejecución."
  },
  {
    term: "C2",
    title: "Capacidad C2",
    description:
      "Capacidad del sistema para proponer un comando principal de ejecución con suficientes señales observables.",
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
      "Capacidad del sistema para localizar señales de test y validación automática.",
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
