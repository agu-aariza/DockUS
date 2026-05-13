import { Highlight, themes } from "prism-react-renderer";

import type { BuilderRuntimeFamily } from "../types";

interface CodeSnippetProps {
  code: string;
  runtimeFamily?: BuilderRuntimeFamily;
  title?: string;
}

function resolveLanguage(runtimeFamily?: BuilderRuntimeFamily): string {
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
}: CodeSnippetProps): JSX.Element | null {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const language = resolveLanguage(runtimeFamily);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
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
