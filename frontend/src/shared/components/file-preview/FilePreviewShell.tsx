import type { ReactNode } from "react";
import { SHELL_THEME, type FilePreviewTheme } from "./filePreviewTheme";

interface FilePreviewShellProps {
  theme: FilePreviewTheme;
  header: ReactNode;
  children: ReactNode;
}

/** Full-screen overlay shared by the read-only previewer and the grading studio. */
export function FilePreviewShell({
  theme,
  header,
  children,
}: FilePreviewShellProps): JSX.Element {
  return (
    <div className={SHELL_THEME[theme]}>
      {header}
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
