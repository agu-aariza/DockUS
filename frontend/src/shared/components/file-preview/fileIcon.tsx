import {
  RiBracesLine,
  RiFileCodeLine,
  RiHashtag,
  RiInformationLine,
  RiMarkdownLine,
  RiTerminalBoxLine,
} from "react-icons/ri";

/** Mid-tone colors so the same icon set stays legible on both the dark and light shells. */
export function getFileIcon(path: string): JSX.Element {
  const ext = path.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "py":
      return <RiFileCodeLine className="text-blue-500" />;
    case "md":
      return <RiMarkdownLine className="text-sky-500" />;
    case "json":
      return <RiBracesLine className="text-amber-500" />;
    case "txt":
      return <RiInformationLine className="text-slate-400" />;
    case "sh":
    case "bash":
      return <RiTerminalBoxLine className="text-emerald-500" />;
    case "yml":
    case "yaml":
      return <RiHashtag className="text-amber-500" />;
    default:
      return <RiFileCodeLine className="text-slate-400" />;
  }
}
