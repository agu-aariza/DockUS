import type { PropsWithChildren } from "react";

import { findGlossaryEntry } from "../data/glossary";

interface GlossaryTermProps extends PropsWithChildren {
  term: string;
  className?: string;
}

export function GlossaryTerm({
  term,
  className = "",
  children,
}: GlossaryTermProps): JSX.Element {
  const entry = findGlossaryEntry(term);
  const label = children ?? term;

  if (!entry) {
    return <>{label}</>;
  }

  return (
    <abbr
      className={`cursor-help rounded border-b border-dotted border-current/40 font-semibold no-underline ${className}`.trim()}
      title={`${entry.title}: ${entry.description}`}
      aria-label={`${entry.title}. ${entry.description}`}
    >
      {label}
    </abbr>
  );
}
