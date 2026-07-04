import { RiFile3Line, RiFolder3Line, RiGitCommitLine, RiHistoryLine } from "react-icons/ri";

import { Badge } from "../../shared/components/ui/Layout";
import type {
  SubmissionPreviewDiff,
  SubmissionPreviewFile,
} from "../utils/validateSubmission";

interface TreeNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children: TreeNode[];
}

interface TreeBuilderNode {
  name: string;
  path: string;
  kind: "file" | "directory";
  children: Map<string, TreeBuilderNode>;
}

interface FileTreePreviewProps {
  files: SubmissionPreviewFile[];
  diff: SubmissionPreviewDiff;
  totalSizeBytes: number;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes]
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === "directory" ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "es");
    })
    .map((node) => ({
      ...node,
      children: sortNodes(node.children),
    }));
}

function toTreeNode(node: TreeBuilderNode): TreeNode {
  return {
    name: node.name,
    path: node.path,
    kind: node.kind,
    children: sortNodes([...node.children.values()].map(toTreeNode)),
  };
}

function buildTree(files: SubmissionPreviewFile[]): TreeNode[] {
  const root = new Map<string, TreeBuilderNode>();

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let currentChildren = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      const existing = currentChildren.get(part);

      if (existing) {
        currentChildren = existing.children;
        return;
      }

      const nextNode: TreeBuilderNode = {
        name: part,
        path: currentPath,
        kind: isFile ? "file" : "directory",
        children: new Map(),
      };

      currentChildren.set(part, nextNode);
      currentChildren = nextNode.children;
    });
  }

  return sortNodes([...root.values()].map(toTreeNode));
}

function TreeBranch({ nodes }: { nodes: TreeNode[] }): JSX.Element {
  return (
    <ul className="space-y-2 text-sm text-slate-900">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.kind === "directory" ? (
            <details open className="rounded-lg border border-app-border bg-white px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-2 font-medium">
                <RiFolder3Line className="text-primary" />
                {node.name}
              </summary>
              {node.children.length > 0 ? (
                <div className="mt-3 pl-4">
                  <TreeBranch nodes={node.children} />
                </div>
              ) : null}
            </details>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-app-border bg-white px-3 py-2">
              <RiFile3Line className="text-slate-400" />
              <span className="truncate">{node.name}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FileTreePreview({
  files,
  diff,
  totalSizeBytes,
}: FileTreePreviewProps): JSX.Element | null {
  if (files.length === 0) {
    return null;
  }

  const tree = buildTree(files);

  return (
    <section className="rounded-lg border border-app-border bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preview del ZIP
          </div>
          <h4 className="mt-2 text-lg font-semibold text-slate-900">
            Estructura detectada antes de enviar
          </h4>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {files.length} archivo(s) · {formatBytes(totalSizeBytes)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success" icon={<RiGitCommitLine />}>
            +{diff.added.length} añadidos
          </Badge>
          <Badge variant="warning" icon={<RiHistoryLine />}>
            {diff.persisted.length} persistentes
          </Badge>
          <Badge variant="danger" icon={<RiHistoryLine />}>
            -{diff.removed.length} eliminados
          </Badge>
        </div>
      </div>

      <div className="mt-5 max-h-[26rem] overflow-auto pr-1">
        <TreeBranch nodes={tree} />
      </div>
    </section>
  );
}
