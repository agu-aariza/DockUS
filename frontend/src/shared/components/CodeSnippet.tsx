/**
 * @fileoverview Componente compartido de la interfaz DockUS (CodeSnippet).
 *
 * @module CodeSnippet
 */

import { Highlight, themes } from "prism-react-renderer";

import type { BuilderRuntimeFamily } from "../../features/builder/types";

interface CodeSnippetProps {
  code: string;
  runtimeFamily?: BuilderRuntimeFamily;
  title?: string;
  /** Archivo del hallazgo: su extensión resuelve el lenguaje mejor que el runtime. */
  file?: string | null;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  py: "python",
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  java: "java",
  sh: "bash",
  json: "json",
};

/**
 * El runtime declarado por el planificador puede llegar como `unknown` —y
 * entonces el bloque se pintaba como `text`, sin resaltado, aunque el hallazgo
 * apuntase a un `.c`. La extensión del archivo es la señal más directa; el
 * runtime queda como respaldo.
 */
function resolveLanguage(
  runtimeFamily?: BuilderRuntimeFamily,
  file?: string | null,
): string {
  const extension = file?.split(".").pop()?.toLowerCase();
  if (extension && LANGUAGE_BY_EXTENSION[extension]) {
    return LANGUAGE_BY_EXTENSION[extension];
  }

  switch (runtimeFamily) {
    case "python":
      return "python";
    case "node":
      return "javascript";
    case "c":
      return "c";
    default:
      return "text";
  }
}

export function CodeSnippet({
  code,
  runtimeFamily,
  title = "Fragmento sugerido",
  file,
}: CodeSnippetProps): JSX.Element | null {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const language = resolveLanguage(runtimeFamily, file);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
        <span>{title}</span>
        <span>{language}</span>
      </div>
      <Highlight theme={themes.nightOwl} code={trimmed} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto px-4 py-4 text-sm leading-6`}
            style={style}
          >
            {tokens.map((line, lineIndex) => (
              <div key={lineIndex} {...getLineProps({ line })}>
                <span className="mr-4 inline-block min-w-[2ch] select-none text-right text-slate-500">
                  {lineIndex + 1}
                </span>
                {line.map((token, tokenIndex) => (
                  <span key={tokenIndex} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
