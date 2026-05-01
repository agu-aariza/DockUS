import {
  RiCloseLine,
  RiFileCodeLine,
  RiLoader4Line,
  RiSearchLine,
  RiFileCopyLine,
  RiDownloadLine,
  RiTerminalBoxLine,
  RiMarkdownLine,
  RiBracesLine,
  RiHashtag,
  RiInformationLine,
  RiCheckLine,
} from "react-icons/ri";
import { useState, useMemo } from "react";

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  isLoading: boolean;
  files: Array<{ path: string; content: string }>;
}

export function CodePreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  isLoading,
  files,
}: CodePreviewModalProps) {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const filteredFiles = useMemo(() => {
    return files.filter((f) =>
      f.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const selectedFile = files[selectedFileIdx];

  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "py":
        return <RiFileCodeLine className="text-blue-400" />;
      case "md":
        return <RiMarkdownLine className="text-sky-400" />;
      case "json":
        return <RiBracesLine className="text-amber-400" />;
      case "txt":
        return <RiInformationLine className="text-slate-400" />;
      case "sh":
      case "bash":
        return <RiTerminalBoxLine className="text-emerald-400" />;
      case "yml":
      case "yaml":
        return <RiHashtag className="text-brand-blue" />;
      default:
        return <RiFileCodeLine className="text-slate-400" />;
    }
  };

  const handleCopy = () => {
    if (!selectedFile) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile.path.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-slate-300 antialiased animate-in fade-in duration-300">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue ring-1 ring-brand-blue/20">
            <RiFileCodeLine className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedFile && (
            <div className="hidden md:flex items-center gap-2 mr-4 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
              <span className="text-[11px] text-slate-400 font-mono">{selectedFile.path}</span>
            </div>
          )}
          <button
            onClick={onClose}
            className="group flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/50 text-slate-400 transition-all hover:bg-rose-500 hover:text-white"
          >
            <RiCloseLine className="text-xl transition-transform group-hover:rotate-90" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Explorer) */}
        <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/40">
          <div className="p-4">
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar archivo..."
                className="w-full rounded-lg bg-slate-800/50 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-blue/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin scrollbar-thumb-slate-800 hover:scrollbar-thumb-slate-700">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              EXPLORADOR
            </div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RiLoader4Line className="text-3xl text-brand-blue animate-spin" />
                <span className="text-xs text-slate-500 font-medium">Leyendo ZIP...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-xs text-slate-600 italic">No se encontraron archivos</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredFiles.map((file) => {
                  const idx = files.findIndex(f => f.path === file.path);
                  const isActive = selectedFileIdx === idx;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFileIdx(idx)}
                      className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-all ${
                        isActive
                          ? "bg-brand-blue/10 text-brand-blue-light shadow-sm ring-1 ring-brand-blue/20"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      <span className="flex-shrink-0 transition-transform group-hover:scale-110">
                        {getFileIcon(file.path)}
                      </span>
                      <span className="truncate text-left font-medium">{file.path}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex flex-1 flex-col bg-slate-950">
          {/* Editor Header / Breadcrumbs */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-4 py-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <RiFileCodeLine className="text-slate-500" />
              <span className="font-mono">{selectedFile?.path || "ningún archivo seleccionado"}</span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                disabled={!selectedFile}
                className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-400 transition-all hover:bg-slate-800 hover:text-white disabled:opacity-30"
              >
                {copied ? <RiCheckLine className="text-emerald-400" /> : <RiFileCopyLine />}
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!selectedFile}
                className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-400 transition-all hover:bg-slate-800 hover:text-white disabled:opacity-30"
              >
                <RiDownloadLine />
                Descargar
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-auto bg-[#0d1117] custom-scrollbar">
            {selectedFile ? (
              <div className="flex min-h-full">
                {/* Line Numbers Gutter */}
                <div className="flex-shrink-0 border-r border-slate-800 bg-slate-900/20 px-4 py-6 text-right select-none">
                  {selectedFile.content.split("\n").map((_, i) => (
                    <div key={i} className="text-[11px] leading-6 text-slate-600 font-mono">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code Content */}
                <pre className="flex-1 px-6 py-6 text-[13px] leading-6 text-slate-300 font-mono overflow-visible selection:bg-brand-blue/30">
                  <code>{selectedFile.content}</code>
                </pre>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-slate-600 gap-4">
                <div className="h-20 w-20 rounded-full bg-slate-900/50 flex items-center justify-center border border-slate-800">
                  <RiFileCodeLine className="text-4xl opacity-20" />
                </div>
                <p className="text-sm font-medium opacity-50">Selecciona un archivo del explorador para empezar</p>
              </div>
            )}
          </div>
          
          {/* Status Bar */}
          <footer className="flex items-center justify-between border-t border-slate-800 bg-brand-blue/5 px-4 py-1 text-[10px] font-medium text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                EXTRACTED_VIEW
              </span>
              <span>UTF-8</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Lines: {selectedFile?.content.split("\n").length || 0}</span>
              <span className="text-brand-blue/60 uppercase">DockUS Engine v1.0</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
