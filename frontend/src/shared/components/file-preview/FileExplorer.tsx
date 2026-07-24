/**
 * @fileoverview Componente de previsualización de archivos y código fuente (FileExplorer).
 *
 * @module FileExplorer
 */

import { RiLoader4Line, RiSearchLine } from "react-icons/ri";
import { getFileIcon } from "./fileIcon";
import { EXPLORER_THEME, type FilePreviewTheme } from "./filePreviewTheme";
import type { PreviewFile } from "./useFilePreview";

interface FileExplorerProps {
  theme: FilePreviewTheme;
  files: PreviewFile[];
  filteredFiles: PreviewFile[];
  selectedFileIdx: number;
  onSelectFile: (index: number) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
}

export function FileExplorer({
  theme,
  files,
  filteredFiles,
  selectedFileIdx,
  onSelectFile,
  searchQuery,
  onSearchChange,
  isLoading,
}: FileExplorerProps): JSX.Element {
  const tokens = EXPLORER_THEME[theme];

  return (
    <aside className={tokens.aside}>
      <div className={tokens.searchBox}>
        <div className="relative">
          <RiSearchLine className={tokens.searchIcon} />
          <input
            type="text"
            placeholder="Buscar archivo..."
            aria-label="Buscar archivo"
            className={tokens.input}
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      <div className={tokens.list}>
        <div className={tokens.heading}>Explorador</div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <RiLoader4Line className={tokens.loader} />
            <span className={tokens.mutedText}>Leyendo archivos...</span>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className={`${tokens.mutedText} italic`}>
              No se encontraron archivos
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredFiles.map((file) => {
              const index = files.findIndex(
                (candidate) => candidate.path === file.path,
              );
              const isActive = selectedFileIdx === index;

              return (
                <button
                  key={file.path}
                  onClick={() => onSelectFile(index)}
                  className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition ${
                    isActive ? tokens.itemActive : tokens.itemInactive
                  }`}
                >
                  <span className="shrink-0">{getFileIcon(file.path)}</span>
                  <span className="truncate text-left font-medium">
                    {file.path}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
