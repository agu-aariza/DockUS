import { RiCloseLine, RiFileCodeLine } from "react-icons/ri";
import { CodeViewer } from "./file-preview/CodeViewer";
import { FileExplorer } from "./file-preview/FileExplorer";
import { FilePreviewShell } from "./file-preview/FilePreviewShell";
import { useFilePreview, type PreviewFile } from "./file-preview/useFilePreview";

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  isLoading: boolean;
  files: PreviewFile[];
}

/** Read-only, dark-themed source explorer for a student delivery. */
export function CodePreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  isLoading,
  files,
}: CodePreviewModalProps) {
  const preview = useFilePreview(files);

  if (!isOpen) return null;

  const { selectedFile } = preview;

  const header = (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
          <RiFileCodeLine className="text-xl" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {selectedFile ? (
          <div className="mr-4 hidden items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/50 px-3 py-1 md:flex">
            <span className="font-mono text-[11px] text-slate-400">
              {selectedFile.path}
            </span>
          </div>
        ) : null}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="group flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300 transition hover:bg-red-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
        >
          <RiCloseLine className="text-xl transition-colors" />
        </button>
      </div>
    </header>
  );

  const statusBar = (
    <footer className="flex items-center justify-between border-t border-slate-800 bg-primary/5 px-4 py-1 text-[10px] font-medium text-slate-500">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          EXTRACTED_VIEW
        </span>
        <span>UTF-8</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Lines: {selectedFile?.content.split("\n").length ?? 0}</span>
        <span className="uppercase text-primary/60">DockUS Engine v1.0</span>
      </div>
    </footer>
  );

  return (
    <FilePreviewShell theme="dark" header={header}>
      <FileExplorer
        theme="dark"
        files={files}
        filteredFiles={preview.filteredFiles}
        selectedFileIdx={preview.selectedFileIdx}
        onSelectFile={preview.selectFile}
        searchQuery={preview.searchQuery}
        onSearchChange={preview.setSearchQuery}
        isLoading={isLoading}
      />
      <CodeViewer
        theme="dark"
        selectedFile={selectedFile}
        lineNumbers={preview.lineNumbers}
        copied={preview.copied}
        onCopy={preview.handleCopy}
        onDownload={preview.handleDownload}
        footer={statusBar}
      />
    </FilePreviewShell>
  );
}
