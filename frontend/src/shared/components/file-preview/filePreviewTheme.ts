export type FilePreviewTheme = "dark" | "light";

export interface ExplorerThemeTokens {
  aside: string;
  searchBox: string;
  searchIcon: string;
  input: string;
  list: string;
  heading: string;
  loader: string;
  mutedText: string;
  itemActive: string;
  itemInactive: string;
}

export interface ViewerThemeTokens {
  root: string;
  toolbar: string;
  toolbarPath: string;
  toolbarIcon: string;
  toolbarButton: string;
  surface: string;
  gutter: string;
  code: string;
  emptyRoot: string;
  emptyBadge: string;
  emptyIcon: string;
  emptyText: string;
}

export const SHELL_THEME: Record<FilePreviewTheme, string> = {
  dark: "fixed inset-0 z-[120] flex flex-col bg-slate-950 text-slate-300 antialiased",
  light: "fixed inset-0 z-[120] flex flex-col bg-app-bg text-slate-900 antialiased",
};

export const EXPLORER_THEME: Record<FilePreviewTheme, ExplorerThemeTokens> = {
  dark: {
    aside: "flex w-72 flex-col border-r border-slate-800 bg-slate-900/60",
    searchBox: "p-4",
    searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-500",
    input:
      "w-full rounded-md bg-slate-800/50 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 transition hover:bg-slate-800/70 focus:outline-none focus:ring-1 focus:ring-primary/50",
    list: "custom-scrollbar flex-1 overflow-y-auto px-2 pb-4",
    heading:
      "mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500",
    loader: "animate-spin text-xl text-primary/80 motion-reduce:animate-none",
    mutedText: "text-xs font-medium text-slate-500",
    itemActive: "bg-primary/10 text-primary-300 ring-1 ring-primary/20",
    itemInactive: "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
  },
  light: {
    aside: "flex w-64 flex-col border-r border-app-border bg-slate-50/50",
    searchBox: "border-b border-app-border p-4",
    searchIcon: "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400",
    input:
      "w-full rounded-md border border-app-border bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-500 transition hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-primary",
    list: "custom-scrollbar flex-1 overflow-y-auto px-2 py-3",
    heading:
      "mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500",
    loader: "animate-spin text-xl text-accent/80 motion-reduce:animate-none",
    mutedText: "text-xs font-medium text-slate-500",
    itemActive: "bg-accent-subtle font-semibold text-accent ring-1 ring-accent/10",
    itemInactive: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
  },
};

export const VIEWER_THEME: Record<FilePreviewTheme, ViewerThemeTokens> = {
  dark: {
    root: "flex flex-1 flex-col bg-slate-950",
    toolbar:
      "flex items-center justify-between border-b border-slate-800 bg-slate-900/40 px-4 py-2",
    toolbarPath: "flex items-center gap-2 text-[11px] text-slate-400",
    toolbarIcon: "text-slate-500",
    toolbarButton:
      "flex h-8 items-center gap-2 rounded-md px-3 text-[11px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-30",
    surface: "custom-scrollbar relative flex-1 overflow-auto bg-[#0d1117]",
    gutter:
      "shrink-0 select-none whitespace-pre border-r border-slate-800 bg-slate-900/20 px-4 py-6 text-right font-mono text-[11px] leading-6 text-slate-600",
    code:
      "flex-1 overflow-visible px-6 py-6 font-mono text-[13px] leading-6 text-slate-300 selection:bg-primary/30",
    emptyRoot:
      "flex h-full flex-col items-center justify-center gap-4 text-slate-600",
    emptyBadge:
      "flex h-20 w-20 items-center justify-center rounded-full border border-slate-800 bg-slate-900/50",
    emptyIcon: "text-4xl opacity-20",
    emptyText: "text-sm font-medium opacity-50",
  },
  light: {
    root: "flex flex-1 flex-col bg-slate-50/30",
    toolbar:
      "flex items-center justify-between border-b border-app-border bg-white px-4 py-2",
    toolbarPath: "flex items-center gap-2 font-mono text-xs text-slate-500",
    toolbarIcon: "text-accent",
    toolbarButton:
      "flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-30",
    surface: "custom-scrollbar relative flex-1 overflow-auto bg-slate-950",
    gutter:
      "shrink-0 select-none whitespace-pre border-r border-white/5 bg-slate-900/40 px-3 py-4 text-right font-mono text-[10px] leading-5 text-slate-500",
    code:
      "flex-1 select-text overflow-visible px-5 py-4 font-mono text-[12px] leading-5 text-slate-200 selection:bg-primary/30",
    emptyRoot:
      "flex h-full flex-col items-center justify-center gap-4 text-slate-400",
    emptyBadge:
      "flex h-16 w-16 items-center justify-center rounded-full border border-app-border bg-white",
    emptyIcon: "text-3xl opacity-40",
    emptyText: "text-sm font-medium",
  },
};
