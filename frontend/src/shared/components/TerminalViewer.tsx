import React, { useRef, useState } from "react";
import { RiFileCopyLine, RiCheckLine, RiTerminalBoxLine } from "react-icons/ri";

interface TerminalViewerProps {
  content: string | string[];
  title?: string;
  maxHeight?: string;
}

export function TerminalViewer({ 
  content, 
  title = "Terminal Output", 
  maxHeight = "400px" 
}: TerminalViewerProps) {
  const [copied, setCopied] = useState(false);
  const textContent = Array.isArray(content) ? content.join('\n') : content;

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simple heuristic to colorize error keywords if ANSI is not present
  const renderLine = (line: string, i: number) => {
    let className = "text-slate-300";
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes("error") || lowerLine.includes("exception") || lowerLine.includes("fail")) {
      className = "text-rose-400 font-bold";
    } else if (lowerLine.includes("warn")) {
      className = "text-amber-300";
    } else if (lowerLine.includes("success") || lowerLine.includes("pass")) {
      className = "text-emerald-400";
    }

    return (
      <div key={i} className="flex hover:bg-slate-800/50 px-4 py-0.5">
        <span className="text-slate-500 select-none pr-4 text-xs min-w-[2.5rem] text-right">
          {i + 1}
        </span>
        <span className={`${className} whitespace-pre-wrap break-all`}>
          {line || " "}
        </span>
      </div>
    );
  };

  const lines = textContent.split('\n');

  return (
    <div className="rounded-xl overflow-hidden bg-[#1E1E1E] border border-slate-700 shadow-xl flex flex-col font-mono text-sm my-4">
      {/* Terminal Header */}
      <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {/* macOS style dots */}
          <div className="flex gap-1.5 mr-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <RiTerminalBoxLine className="text-slate-400" />
          <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            {title}
          </span>
        </div>
        <button 
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition flex items-center gap-1 text-xs bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          title="Copiar logs"
          aria-label="Copiar logs"
        >
          {copied ? <RiCheckLine className="text-emerald-400" /> : <RiFileCopyLine />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* Terminal Content */}
      <div 
        className="overflow-y-auto py-2 custom-scrollbar"
        style={{ maxHeight }}
      >
        {lines.length === 0 || (lines.length === 1 && lines[0] === "") ? (
          <div className="px-4 py-2 text-slate-500 italic">Sin salida registrada...</div>
        ) : (
          lines.map((line, i) => renderLine(line, i))
        )}
      </div>
    </div>
  );
}
