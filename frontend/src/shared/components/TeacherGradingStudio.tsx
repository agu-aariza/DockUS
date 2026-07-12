import {
  RiCloseLine,
  RiFileCodeLine,
  RiSearchLine,
  RiFileCopyLine,
  RiDownloadLine,
  RiCheckLine,
  RiHashtag,
  RiTerminalBoxLine,
  RiBracesLine,
  RiMarkdownLine,
  RiInformationLine,
  RiLoader4Line,
  RiAwardFill,
  RiSave2Line,
} from "react-icons/ri";
import { useState, useMemo, useEffect } from "react";
import type { DeliveryEntity } from "../../features/deliveries/types";
import type { BuildRunEntity } from "../../features/builder/types";
import { Button } from "./ui/Button";

interface TeacherGradingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  files: Array<{ path: string; content: string }>;
  isLoadingFiles: boolean;
  onSubmitGrading: (_grade: string, _graderNotes: string) => Promise<void>;
  initialGrade: string;
  initialNotes: string;
}

export function TeacherGradingStudio({
  isOpen,
  onClose,
  delivery,
  reportRun,
  files,
  isLoadingFiles,
  onSubmitGrading,
  initialGrade,
  initialNotes,
}: TeacherGradingStudioProps) {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Grading form state
  const [grade, setGrade] = useState(initialGrade);
  const [graderNotes, setGraderNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (files.length === 0) {
      setSelectedFileIdx(0);
    } else if (selectedFileIdx >= files.length) {
      setSelectedFileIdx(0);
    }
  }, [files, selectedFileIdx]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) =>
      f.path.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const selectedFile = files[selectedFileIdx];

  const lineNumbers = useMemo(() => {
    if (!selectedFile?.content) return "";
    const totalLines = selectedFile.content.split("\n").length;
    return Array.from({ length: totalLines }, (_, i) => i + 1).join("\n");
  }, [selectedFile?.content]);

  const getFileIcon = (path: string) => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "py":
        return <RiFileCodeLine className="text-emerald-500" />;
      case "md":
        return <RiMarkdownLine className="text-sky-500" />;
      case "json":
        return <RiBracesLine className="text-amber-500" />;
      case "txt":
        return <RiInformationLine className="text-slate-400" />;
      case "sh":
      case "bash":
        return <RiTerminalBoxLine className="text-primary" />;
      case "yml":
      case "yaml":
        return <RiHashtag className="text-amber-500" />;
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

  const handleSaveGrading = async () => {
    setIsSaving(true);
    try {
      await onSubmitGrading(grade, graderNotes);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-app-bg text-slate-900 antialiased">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-app-border bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
            <RiAwardFill className="text-2xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-accent">
              Estudio de Calificación Docente
            </h3>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              v{delivery.version} · {delivery.studentName} ({delivery.studentEmail})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {reportRun?.llmAssessment && (
            <div className="hidden lg:flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-1">
              <span className="text-xs font-bold text-amber-700">
                Nota IA: {reportRun.llmAssessment.recommendedGrade?.toFixed(2) ?? "N/A"}
              </span>
              <div className="h-3 w-px bg-amber-300" />
              <span className="text-xs font-bold text-amber-800">
                Estado: {reportRun.llmAssessment.evaluativeState}
              </span>
            </div>
          )}
          
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="group flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-500 transition-all hover:bg-rose-500 hover:text-white focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:outline-none"
          >
            <RiCloseLine className="text-2xl transition-colors" />
          </button>
        </div>
      </header>

      {/* Main Double-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Code Files Explorer & Preview */}
        <section className="flex flex-1 border-r border-app-border bg-white overflow-hidden">
          {/* File Tree / List */}
          <aside className="flex w-64 flex-col border-r border-app-border bg-slate-50/50">
            <div className="p-4 border-b border-app-border">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar archivo..."
                  aria-label="Buscar archivo"
                  className="w-full rounded-md border border-app-border bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-500 transition focus:outline-none focus:ring-1 focus:ring-primary hover:border-slate-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 scroll-bar">
              <div className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-slate-500">
                Archivos ZIP
              </div>
              {isLoadingFiles ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RiLoader4Line className="text-lg text-accent/80 animate-spin" />
                  <span className="text-xs text-slate-500 font-medium">Analizando zip...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-xs text-slate-400 italic">Vacío o sin coincidencia</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredFiles.map((file) => {
                    const idx = files.findIndex((f) => f.path === file.path);
                    const isActive = selectedFileIdx === idx;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFileIdx(idx)}
                        className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-all ${
                          isActive
                            ? "bg-accent-subtle text-accent font-semibold ring-1 ring-accent/10"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span className="flex-shrink-0">
                          {getFileIcon(file.path)}
                        </span>
                        <span className="truncate text-left">{file.path}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Code Viewer Panel */}
          <main className="flex-1 flex flex-col bg-slate-50/30">
            <header className="flex items-center justify-between border-b border-app-border bg-white px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <RiFileCodeLine className="text-accent" />
                <span>{selectedFile?.path || "ningún archivo seleccionado"}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!selectedFile}
                  className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-30"
                >
                  {copied ? <RiCheckLine className="text-emerald-500" /> : <RiFileCopyLine />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!selectedFile}
                  className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none disabled:opacity-30"
                >
                  <RiDownloadLine />
                  Descargar
                </button>
              </div>
            </header>

            <div className="relative flex-1 overflow-auto bg-slate-950 custom-scrollbar">
              {selectedFile ? (
                <div className="flex min-h-full">
                  {/* Line Numbers */}
                  <pre className="flex-shrink-0 border-r border-white/5 bg-slate-900/40 px-3 py-4 text-right select-none font-mono text-[10px] leading-5 text-slate-500 whitespace-pre">{lineNumbers}</pre>
                  {/* Code */}
                  <pre className="flex-1 px-5 py-4 text-[12px] leading-5 text-slate-200 font-mono overflow-visible select-text"><code>{selectedFile.content}</code></pre>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center border border-app-border">
                    <RiFileCodeLine className="text-3xl opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Selecciona un archivo del explorador para empezar</p>
                </div>
              )}
            </div>
          </main>
        </section>

        {/* Right Side: Grading & Discussion Sidepanel */}
        <section className="w-[480px] flex flex-col bg-white overflow-hidden border-l border-app-border">
          {/* Scrollable Contents */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* AI Recommendation Context */}
            {reportRun?.llmAssessment ? (
              <article className="rounded-lg border border-amber-200 bg-amber-50/30 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 mb-1">
                  Dictamen de la Inteligencia Artificial
                </div>
                <h4 className="font-bold text-slate-900 text-base">
                  {reportRun.llmAssessment.structuralType}
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {reportRun.llmAssessment.rationale}
                </p>
              </article>
            ) : null}

            {/* Official Grading Form */}
            <form onSubmit={(e) => { e.preventDefault(); void handleSaveGrading(); }} className="space-y-4">
              <div className="border-b border-app-border pb-3">
                <h4 className="font-bold text-base text-accent">
                  Nota Oficial y Feedback
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Consolida la nota oficial para el expediente del estudiante.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="ui-label">Nota (0-10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    className="input-field text-center font-bold text-lg"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="ui-label">Estado de la Entrega</label>
                  <div className="flex items-center h-11 border border-app-border bg-slate-50/50 rounded-md px-3 text-xs font-bold text-slate-500">
                    {delivery.status}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="ui-label">Observaciones del Evaluador</label>
                <textarea
                  className="input-field min-h-[120px] text-xs"
                  value={graderNotes}
                  onChange={(e) => setGraderNotes(e.target.value)}
                  placeholder="Escribe comentarios de corrección, rúbricas aplicadas o avisos manuales..."
                />
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full flex items-center justify-center gap-2"
                onClick={handleSaveGrading}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RiLoader4Line className="animate-spin text-lg" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <RiSave2Line className="text-lg" />
                    Guardar Calificación Oficial
                  </>
                )}
              </Button>
            </form>


          </div>
        </section>
      </div>
    </div>
  );
}
