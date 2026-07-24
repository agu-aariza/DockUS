import type { ReactNode } from "react";
import {
  RiCheckLine,
  RiDownloadLine,
  RiFileCodeLine,
  RiFileCopyLine,
} from "react-icons/ri";
import { VIEWER_THEME, type FilePreviewTheme } from "./filePreviewTheme";
import type { PreviewFile } from "./useFilePreview";

interface CodeViewerProps {
  theme: FilePreviewTheme;
  selectedFile: PreviewFile | undefined;
  lineNumbers: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  footer?: ReactNode;
}

export function CodeViewer({
  theme,
  selectedFile,
  lineNumbers,
  copied,
  onCopy,
  onDownload,
  footer,
}: CodeViewerProps): JSX.Element {
  const tokens = VIEWER_THEME[theme];

  return (
    <main className={tokens.root}>
      <div className={tokens.toolbar}>
        <div className={tokens.toolbarPath}>
          <RiFileCodeLine className={tokens.toolbarIcon} />
          <span className="font-mono">
            {selectedFile?.path ?? "ningún archivo seleccionado"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            disabled={!selectedFile}
            className={tokens.toolbarButton}
          >
            {copied ? (
              <RiCheckLine className="text-success-500" />
            ) : (
              <RiFileCopyLine />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <button
            onClick={onDownload}
            disabled={!selectedFile}
            className={tokens.toolbarButton}
          >
            <RiDownloadLine />
            Descargar
          </button>
        </div>
      </div>

      <div className={tokens.surface}>
        {selectedFile ? (
          <div className="flex min-h-full">
            <pre className={tokens.gutter}>{lineNumbers}</pre>
            <pre className={tokens.code}>
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        ) : (
          <div className={tokens.emptyRoot}>
            <div className={tokens.emptyBadge}>
              <RiFileCodeLine className={tokens.emptyIcon} />
            </div>
            <p className={tokens.emptyText}>
              Selecciona un archivo del explorador para empezar
            </p>
          </div>
        )}
      </div>

      {footer}
    </main>
  );
}
