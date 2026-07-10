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
        return <RiFileCodeLine className="text-primary" />;
      default:
        return <RiFileCodeLine className="text-slate-400" />;
    }
  };

  const handleCopy = () => {
    if (!selectedFile) return;
    void navigator.clipboard.writeText(selectedFile.content);
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
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950 text-slate-300 antialiased">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <RiFileCodeLine className="text-xl" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedFile && (
            <div className="hidden md:flex items-center gap-2 mr-4 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1">
              <span className="text-[11px] font-mono text-slate-400">{selectedFile.path}</span>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="group flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-red-600 hover:text-white focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:outline-none"
          >
            <RiCloseLine className="text-xl transition-colors" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Explorer) */}
        <aside className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/60">
          <div className="p-4">
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar archivo..."
                aria-label="Buscar archivo"
                className="w-full rounded-md bg-slate-800/50 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 transition focus:outline-none focus:ring-1 focus:ring-primary/50 hover:bg-slate-800/70"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
            <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Explorador
            </div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <RiLoader4Line className="animate-spin text-xl text-primary/80" />
                <span className="text-xs font-medium text-slate-500">Leyendo ZIP...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-xs italic text-slate-600">No se encontraron archivos</p>
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
                      className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition ${
                        isActive
                          ? "bg-primary/10 text-blue-300 ring-1 ring-primary/20"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      }`}
                    >
                      <span className="shrink-0">
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
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <RiFileCodeLine className="text-slate-500" />
              <span className="font-mono">{selectedFile?.path || "ningún archivo seleccionado"}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                disabled={!selectedFile}
                className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-30"
              >
                {copied ? <RiCheckLine className="text-emerald-400" /> : <RiFileCopyLine />}
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!selectedFile}
                className="flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-30"
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
                <div className="shrink-0 border-r border-slate-800 bg-slate-900/20 px-4 py-6 text-right select-none">
                  {selectedFile.content.split("\n").map((_, i) => (
                    <div key={i} className="font-mono text-[11px] leading-6 text-slate-600">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code Content */}
                <pre className="flex-1 overflow-visible px-6 py-6 font-mono text-[13px] leading-6 text-slate-300 selection:bg-primary/30">
                  <code>{selectedFile.content}</code>
                </pre>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-600">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-800 bg-slate-900/50">
                  <RiFileCodeLine className="text-4xl opacity-20" />
                </div>
                <p className="text-sm font-medium opacity-50">Selecciona un archivo del explorador para empezar</p>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <footer className="flex items-center justify-between border-t border-slate-800 bg-primary/5 px-4 py-1 text-[10px] font-medium text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                EXTRACTED_VIEW
              </span>
              <span>UTF-8</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Lines: {selectedFile?.content.split("\n").length || 0}</span>
              <span className="uppercase text-primary/60">DockUS Engine v1.0</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
