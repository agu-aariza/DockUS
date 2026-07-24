/**
 * @fileoverview Componente compartido de la interfaz DockUS (MarkdownContent).
 *
 * @module MarkdownContent
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps): JSX.Element {
  return (
    <div className={`prose prose-slate max-w-none text-sm leading-6 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.92em] prose-code:text-slate-800 prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:bg-slate-950 prose-pre:px-4 prose-pre:py-3 prose-strong:text-slate-900 ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ children, className: codeClassName, ...props }) {
            const isInline = !String(codeClassName ?? "").includes("language-");
            if (isInline) {
              return (
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.92em] text-slate-800" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
