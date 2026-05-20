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
  RiChat3Line,
  RiSendPlane2Fill,
  RiSave2Line,
} from "react-icons/ri";
import { useState, useMemo } from "react";
import type { DeliveryEntity, BuildRunEntity } from "../../shared/types";
import { Button } from "./ui/Button";

interface TeacherGradingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  files: Array<{ path: string; content: string }>;
  isLoadingFiles: boolean;
  onSubmitGrading: (grade: string, graderNotes: string) => Promise<void>;
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

  // Mock chat state for premium interaction feel
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "tutor" | "student" | "system"; text: string; time: string }>>([
    {
      sender: "system",
      text: "Pipeline de evaluación técnica finalizado automáticamente.",
      time: "Ayer, 16:45",
    },
    {
      sender: "student",
      text: "Hola profesor, he corregido los problemas de concurrencia y he subido la v" + delivery.version + ". ¿Podría revisarlo?",
      time: "Hoy, 09:30",
    },
    {
      sender: "tutor",
      text: "Revisando. Veo que el reporte de IA indica un estado " + (reportRun?.llmAssessment?.evaluativeState ?? "E2") + ". Validemos los ficheros.",
      time: "Hoy, 10:15",
    },
  ]);
  const [newMessage, setNewMessage] = useState("");

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
        return <RiFileCodeLine className="text-emerald-500" />;
      case "md":
        return <RiMarkdownLine className="text-sky-500" />;
      case "json":
        return <RiBracesLine className="text-amber-500" />;
      case "txt":
        return <RiInformationLine className="text-slate-400" />;
      case "sh":
      case "bash":
        return <RiTerminalBoxLine className="text-brand-blue" />;
      case "yml":
      case "yaml":
        return <RiHashtag className="text-brand-gold-dark" />;
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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        sender: "tutor",
        text: newMessage,
        time: "Ahora",
      },
    ]);
    setNewMessage("");
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-academic-surface text-academic-on-surface antialiased animate-fade-in">
      {/* Header Bar */}
      <header className="flex items-center justify-between border-b border-academic-outline-variant bg-white px-6 py-4 shadow-academic">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-maroon/10 text-brand-maroon">
            <RiAwardFill className="text-2xl" />
          </div>
          <div>
            <h3 className="font-display text-lg font-black tracking-tight text-brand-maroon">
              Estudio de Calificación Docente
            </h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-academic-outline">
              v{delivery.version} · {delivery.studentName} ({delivery.studentEmail})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {reportRun?.llmAssessment && (
            <div className="hidden lg:flex items-center gap-3 rounded-xl border border-brand-gold/30 bg-brand-gold/[0.04] px-4 py-1">
              <span className="text-xs font-bold text-brand-gold-dark">
                Nota IA: {reportRun.llmAssessment.recommendedGrade?.toFixed(2) ?? "N/A"}
              </span>
              <div className="h-3 w-px bg-brand-gold/20" />
              <span className="text-xs font-black text-brand-gold-dark">
                Estado: {reportRun.llmAssessment.evaluativeState}
              </span>
            </div>
          )}
          
          <button
            onClick={onClose}
            className="group flex h-10 w-10 items-center justify-center rounded-full border border-academic-outline-variant bg-white text-academic-outline transition-all hover:bg-rose-500 hover:text-white"
          >
            <RiCloseLine className="text-2xl transition-transform group-hover:rotate-90" />
          </button>
        </div>
      </header>

      {/* Main Double-Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Code Files Explorer & Preview */}
        <section className="flex flex-1 border-r border-academic-outline-variant bg-white overflow-hidden">
          {/* File Tree / List */}
          <aside className="flex w-64 flex-col border-r border-academic-outline-variant bg-academic-surface-container/30">
            <div className="p-4 border-b border-academic-outline-variant">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-academic-outline" />
                <input
                  type="text"
                  placeholder="Buscar archivo..."
                  className="w-full rounded-xl border border-academic-outline-variant bg-white py-1.5 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand-blue"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 scroll-bar">
              <div className="mb-2 px-2 text-[10px] font-black tracking-widest text-academic-outline">
                ARCHIVOS ZIP
              </div>
              {isLoadingFiles ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RiLoader4Line className="text-2xl text-brand-maroon animate-spin" />
                  <span className="text-xs text-academic-outline font-bold">Analizando zip...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-xs text-academic-outline italic">Vacío o sin coincidencia</p>
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
                        className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all ${
                          isActive
                            ? "bg-brand-maroon/5 text-brand-maroon font-bold border-l-4 border-brand-maroon pl-2"
                            : "text-academic-on-surface-variant hover:bg-academic-surface hover:text-academic-on-surface"
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
          <main className="flex-1 flex flex-col bg-academic-surface-container/10">
            <header className="flex items-center justify-between border-b border-academic-outline-variant bg-white px-4 py-2">
              <div className="flex items-center gap-2 text-xs text-academic-on-surface-variant font-mono">
                <RiFileCodeLine className="text-brand-maroon" />
                <span>{selectedFile?.path || "ningún archivo seleccionado"}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!selectedFile}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-academic-outline transition-all hover:bg-academic-surface hover:text-academic-on-surface disabled:opacity-30"
                >
                  {copied ? <RiCheckLine className="text-emerald-500" /> : <RiFileCopyLine />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={!selectedFile}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-academic-outline transition-all hover:bg-academic-surface hover:text-academic-on-surface disabled:opacity-30"
                >
                  <RiDownloadLine />
                  Descargar
                </button>
              </div>
            </header>

            <div className="relative flex-1 overflow-auto bg-slate-955 custom-scrollbar">
              {selectedFile ? (
                <div className="flex min-h-full">
                  {/* Line Numbers */}
                  <div className="flex-shrink-0 border-r border-white/5 bg-slate-900/40 px-3 py-4 text-right select-none">
                    {selectedFile.content.split("\n").map((_, i) => (
                      <div key={i} className="text-[10px] leading-5 text-slate-500 font-mono">
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  {/* Code */}
                  <pre className="flex-1 px-5 py-4 text-[12px] leading-5 text-slate-200 font-mono overflow-visible select-text">
                    <code>{selectedFile.content}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-academic-outline gap-4">
                  <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center border border-academic-outline-variant shadow-academic">
                    <RiFileCodeLine className="text-3xl opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Selecciona un archivo del explorador para empezar</p>
                </div>
              )}
            </div>
          </main>
        </section>

        {/* Right Side: Grading & Discussion Sidepanel */}
        <section className="w-[480px] flex flex-col bg-white overflow-hidden shadow-academic">
          {/* Scrollable Contents */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* AI Recommendation Context */}
            {reportRun?.llmAssessment ? (
              <article className="rounded-2xl border border-brand-gold/30 bg-brand-gold/[0.02] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-brand-gold-dark mb-1">
                  Dictamen de la Inteligencia Artificial
                </div>
                <h4 className="font-display font-bold text-academic-on-surface text-base">
                  {reportRun.llmAssessment.structuralType}
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-academic-on-surface-variant">
                  {reportRun.llmAssessment.rationale}
                </p>
              </article>
            ) : null}

            {/* Official Grading Form */}
            <form onSubmit={(e) => { e.preventDefault(); void handleSaveGrading(); }} className="space-y-4">
              <div className="border-b border-academic-outline-variant pb-3">
                <h4 className="font-display font-bold text-base text-brand-maroon">
                  Nota Oficial y Feedback
                </h4>
                <p className="text-xs text-academic-outline mt-1">
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
                    className="input-field text-center font-bold font-display text-lg"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="ui-label">Estado de la Entrega</label>
                  <div className="flex items-center h-11 border border-academic-outline-variant bg-academic-surface-container/30 rounded-xl px-3 text-xs font-bold text-academic-on-surface-variant">
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

            {/* Tutor-Student Discussion */}
            <div className="border-t border-academic-outline-variant pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <RiChat3Line className="text-xl text-brand-maroon" />
                <h4 className="font-display font-bold text-base text-brand-maroon">
                  Discusión y Auditoría
                </h4>
              </div>

              <div className="space-y-3 rounded-2xl bg-academic-surface p-4 max-h-[220px] overflow-y-auto border border-academic-outline-variant">
                {chatMessages.map((msg, index) => {
                  if (msg.sender === "system") {
                    return (
                      <div key={index} className="text-center py-1 border-b border-academic-outline-variant/30">
                        <span className="text-[9px] font-bold text-academic-outline uppercase tracking-wider">
                          {msg.text} · {msg.time}
                        </span>
                      </div>
                    );
                  }
                  const isTutor = msg.sender === "tutor";
                  return (
                    <div
                      key={index}
                      className={`flex flex-col max-w-[85%] ${
                        isTutor ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div
                        className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          isTutor
                            ? "bg-brand-maroon text-white"
                            : "bg-academic-surface-container text-academic-on-surface-variant"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[9px] text-academic-outline mt-1 px-1">
                        {isTutor ? "Tú" : "Alumno"} · {msg.time}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enviar comentario al alumno..."
                  className="flex-1 rounded-xl border border-academic-outline-variant bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-maroon"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" variant="secondary" className="!h-9 !w-9 !p-0">
                  <RiSendPlane2Fill className="text-base text-brand-maroon" />
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
