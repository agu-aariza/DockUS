import { useEffect, useMemo, useRef, useState } from "react";

export interface PreviewFile {
  path: string;
  content: string;
}

export interface FilePreviewState {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filteredFiles: PreviewFile[];
  selectedFileIdx: number;
  selectFile: (index: number) => void;
  selectedFile: PreviewFile | undefined;
  lineNumbers: string;
  copied: boolean;
  handleCopy: () => void;
  handleDownload: () => void;
}

const COPIED_FEEDBACK_MS = 2000;

export function useFilePreview(files: PreviewFile[]): FilePreviewState {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedFileIdx >= files.length) {
      setSelectedFileIdx(0);
    }
  }, [files, selectedFileIdx]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const filteredFiles = useMemo(() => {
    const normalized = searchQuery.toLowerCase();
    return files.filter((file) => file.path.toLowerCase().includes(normalized));
  }, [files, searchQuery]);

  const selectedFile = files[selectedFileIdx];

  const lineNumbers = useMemo(() => {
    if (!selectedFile?.content) return "";
    const totalLines = selectedFile.content.split("\n").length;
    return Array.from({ length: totalLines }, (_, index) => index + 1).join("\n");
  }, [selectedFile?.content]);

  const handleCopy = () => {
    if (!selectedFile) return;
    void navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  const handleDownload = () => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = selectedFile.path.split("/").pop() || "file.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return {
    searchQuery,
    setSearchQuery,
    filteredFiles,
    selectedFileIdx,
    selectFile: setSelectedFileIdx,
    selectedFile,
    lineNumbers,
    copied,
    handleCopy,
    handleDownload,
  };
}
