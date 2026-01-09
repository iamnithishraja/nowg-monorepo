import {
  ChevronRight,
  File as FileIcon,
  Folder as FolderIcon,
  FileCode,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Archive as ArchiveIcon,
  Database as DatabaseIcon,
  Package as PackageIcon,
  Terminal as TerminalIcon,
  Atom,
} from "lucide-react";
import React, { useMemo } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";

type FileItem = { name: string; path: string; content: string };

interface FileTreeProps {
  files?: FileItem[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  onOpenSearch?: () => void;
  hideHeader?: boolean;
}

type TreeNode = { name: string; path: string; children?: TreeNode[] };

// Persistence helpers (cookie-based, like shadcn sidebar)
const FILETREE_COOKIE_NAME = "filetree_state";
const FILETREE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getProjectKey(): string {
  if (typeof window === "undefined") return "default";
  try {
    const params = new URLSearchParams(window.location.search);
    const convo = params.get("conversationId");
    if (convo) return convo;
    // Fallback to pathname (e.g., workspace route) to avoid collisions
    return window.location.pathname || "default";
  } catch {
    return "default";
  }
}

function readExpandedFromCookie(): Set<string> {
  if (typeof document === "undefined") return new Set<string>();
  try {
    const projectKey = getProjectKey();
    const cookieName = `${FILETREE_COOKIE_NAME}_${projectKey}`;
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${cookieName}=`));
    if (!cookie) return new Set<string>();
    const value = decodeURIComponent(cookie.split("=")[1] || "");
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return new Set<string>(parsed.filter((p) => typeof p === "string"));
    }
    return new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeExpandedToCookie(paths: Set<string>) {
  if (typeof document === "undefined") return;
  try {
    const projectKey = getProjectKey();
    const cookieName = `${FILETREE_COOKIE_NAME}_${projectKey}`;
    const value = encodeURIComponent(JSON.stringify(Array.from(paths)));
    document.cookie = `${cookieName}=${value}; path=/; max-age=${FILETREE_COOKIE_MAX_AGE}`;
  } catch {
    // no-op
  }
}

// Selected file persistence
const SELECTED_FILE_COOKIE_NAME = "selected_file";

function readSelectedFromCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const projectKey = getProjectKey();
    const cookieName = `${SELECTED_FILE_COOKIE_NAME}_${projectKey}`;
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${cookieName}=`));
    if (!cookie) return undefined;
    const value = decodeURIComponent(cookie.split("=")[1] || "");
    return value || undefined;
  } catch {
    return undefined;
  }
}

function writeSelectedToCookie(path: string) {
  if (typeof document === "undefined") return;
  try {
    const projectKey = getProjectKey();
    const cookieName = `${SELECTED_FILE_COOKIE_NAME}_${projectKey}`;
    const value = encodeURIComponent(path);
    document.cookie = `${cookieName}=${value}; path=/; max-age=${FILETREE_COOKIE_MAX_AGE}`;
  } catch {
    // no-op
  }
}

function TechBadge({
  label,
  bg,
  fg,
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] text-[9px] font-semibold"
      style={{ backgroundColor: bg, color: fg }}
      title={label}
    >
      {label}
    </span>
  );
}

// Simple inline brand-like logos for popular tech
function LogoJS() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-4 h-4 flex-shrink-0"
      aria-label="JavaScript"
    >
      <rect width="32" height="32" rx="4" fill="#F7DF1E" />
      <text
        x="7"
        y="22"
        fontSize="14"
        fontFamily="Inter,system-ui,Arial"
        fontWeight="700"
        fill="#1a1a1a"
      >
        JS
      </text>
    </svg>
  );
}
function LogoTS() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-4 h-4 flex-shrink-0"
      aria-label="TypeScript"
    >
      <rect width="32" height="32" rx="4" fill="#3178C6" />
      <text
        x="6"
        y="22"
        fontSize="14"
        fontFamily="Inter,system-ui,Arial"
        fontWeight="700"
        fill="#ffffff"
      >
        TS
      </text>
    </svg>
  );
}
function LogoHTML() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-4 h-4 flex-shrink-0"
      aria-label="HTML"
    >
      <path d="M4 2h24l-2.2 24L16 30l-9.8-4L4 2z" fill="#E34F26" />
      <path d="M16 26.5l7.9-3.2L24.5 4H16v22.5z" fill="#EF652A" />
    </svg>
  );
}
function LogoCSS() {
  return (
    <svg viewBox="0 0 32 32" className="w-4 h-4 flex-shrink-0" aria-label="CSS">
      <path d="M4 2h24l-2.2 24L16 30l-9.8-4L4 2z" fill="#1572B6" />
      <path d="M16 26.5l7.9-3.2L24.5 4H16v22.5z" fill="#33A9DC" />
    </svg>
  );
}

function getTechLogoByName(name: string): React.ReactNode | null {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";

  // React for JSX/TSX
  if (ext === "jsx" || ext === "tsx") {
    return (
      <Atom
        className="w-4 h-4 flex-shrink-0"
        style={{ color: "#61DAFB" }}
        aria-label="React"
      />
    );
  }

  // JS / TS real logos
  if (ext === "js" || ext === "mjs" || ext === "cjs") {
    return <LogoJS />;
  }
  if (ext === "ts") {
    return <LogoTS />;
  }

  // Markup / Styles - use logos for HTML/CSS
  if (ext === "html" || ext === "htm") {
    return <LogoHTML />;
  }
  if (ext === "css") {
    return <LogoCSS />;
  }
  if (ext === "scss" || ext === "sass") {
    return <TechBadge label="S" bg="#CC6699" fg="#ffffff" />;
  }
  if (ext === "less") {
    return <TechBadge label="L" bg="#1D365D" fg="#ffffff" />;
  }

  // Docs / data
  if (ext === "md" || ext === "mdx") {
    return <TechBadge label="MD" bg="#666666" fg="#ffffff" />;
  }
  if (ext === "json" || ext === "jsonc") {
    return <TechBadge label="J" bg="#6E6E6E" fg="#ffffff" />;
  }
  if (ext === "yml" || ext === "yaml") {
    return <TechBadge label="Y" bg="#CB9F1A" fg="#1a1a1a" />;
  }

  // Popular back-end / languages
  if (ext === "py") {
    return <TechBadge label="Py" bg="#3776AB" fg="#ffffff" />;
  }
  if (ext === "rb") {
    return <TechBadge label="Rb" bg="#CC342D" fg="#ffffff" />;
  }
  if (ext === "php") {
    return <TechBadge label="PHP" bg="#777BB4" fg="#ffffff" />;
  }
  if (ext === "go") {
    return <TechBadge label="Go" bg="#00ADD8" fg="#00303B" />;
  }
  if (ext === "rs") {
    return <TechBadge label="Rs" bg="#DEA584" fg="#1a1a1a" />;
  }
  if (ext === "java") {
    return <TechBadge label="Jv" bg="#007396" fg="#ffffff" />;
  }
  if (ext === "kt" || ext === "kts") {
    return <TechBadge label="Kt" bg="#B125EA" fg="#ffffff" />;
  }
  if (ext === "cs") {
    return <TechBadge label="C#" bg="#178600" fg="#ffffff" />;
  }
  if (ext === "cpp" || ext === "c" || ext === "hpp" || ext === "h") {
    return <TechBadge label="C/C++" bg="#00599C" fg="#ffffff" />;
  }
  if (ext === "swift") {
    return <TechBadge label="Sw" bg="#F05138" fg="#ffffff" />;
  }
  if (ext === "dart") {
    return <TechBadge label="Da" bg="#0175C2" fg="#ffffff" />;
  }

  return null;
}

function getFileIconByName(name: string) {
  const lower = name.toLowerCase();

  // Special filenames
  if (
    lower === "package.json" ||
    lower.endsWith(".lock") ||
    lower === "pnpm-lock.yaml" ||
    lower === "yarn.lock" ||
    lower === "package-lock.json"
  ) {
    return <PackageIcon className="w-4 h-4 flex-shrink-0" />;
  }
  if (lower === "dockerfile" || lower === ".dockerignore") {
    return <PackageIcon className="w-4 h-4 flex-shrink-0" />;
  }
  if (
    lower === "readme" ||
    lower === "readme.md" ||
    lower.endsWith(".md") ||
    lower.endsWith(".mdx") ||
    lower.endsWith(".txt")
  ) {
    return <FileText className="w-4 h-4 flex-shrink-0" />;
  }

  const ext = lower.includes(".") ? lower.split(".").pop() || "" : "";

  // Media
  if (
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "svg",
      "webp",
      "ico",
      "bmp",
      "tiff",
      "avif",
    ].includes(ext)
  ) {
    return <ImageIcon className="w-4 h-4 flex-shrink-0" />;
  }
  if (["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext)) {
    return <VideoIcon className="w-4 h-4 flex-shrink-0" />;
  }
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) {
    return <MusicIcon className="w-4 h-4 flex-shrink-0" />;
  }

  // Archives
  if (["zip", "tar", "gz", "tgz", "rar", "7z", "xz", "bz2"].includes(ext)) {
    return <ArchiveIcon className="w-4 h-4 flex-shrink-0" />;
  }

  // Databases / data
  if (["sql", "db", "sqlite", "sqlite3", "mdb"].includes(ext)) {
    return <DatabaseIcon className="w-4 h-4 flex-shrink-0" />;
  }

  // Shell / scripts
  if (["sh", "bash", "zsh", "ps1", "bat", "cmd"].includes(ext)) {
    return <TerminalIcon className="w-4 h-4 flex-shrink-0" />;
  }

  // Config / text-like
  if (
    [
      "json",
      "jsonc",
      "yaml",
      "yml",
      "toml",
      "ini",
      "conf",
      "env",
      "cfg",
      "properties",
    ].includes(ext)
  ) {
    return <FileText className="w-4 h-4 flex-shrink-0" />;
  }

  // Code
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "mjs",
      "cjs",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "kt",
      "kts",
      "cs",
      "cpp",
      "c",
      "h",
      "hpp",
      "php",
      "swift",
      "dart",
      "html",
      "htm",
      "css",
      "scss",
      "sass",
      "less",
      "vue",
      "svelte",
      "astro",
    ].includes(ext)
  ) {
    return <FileCode className="w-4 h-4 flex-shrink-0" />;
  }

  return <FileIcon className="w-4 h-4 flex-shrink-0" />;
}

function buildTree(files: FileItem[]): TreeNode[] {
  const root: Record<string, any> = {};
  for (const f of files) {
    const parts = f.path.split("/").filter(Boolean);
    let cursor = root;
    let curPath = "";
    parts.forEach((p, idx) => {
      curPath = curPath ? `${curPath}/${p}` : p;
      cursor[p] = cursor[p] || { name: p, path: curPath, children: {} };
      if (idx < parts.length - 1) cursor = cursor[p].children;
    });
  }
  const toArray = (node: Record<string, any>): TreeNode[] =>
    Object.values(node)
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((n: any) => ({
        name: n.name,
        path: n.path,
        children: n.children ? toArray(n.children) : undefined,
      }));
  return toArray(root);
}

export default function FileTree({
  files = [],
  selectedPath,
  onSelect,
  onOpenSearch,
  hideHeader = false,
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [expanded, setExpanded] = React.useState<Set<string>>(() =>
    readExpandedFromCookie()
  );

  // Hydrate selected file on mount if not provided by parent
  React.useEffect(() => {
    if (!selectedPath && onSelect) {
      const persisted = readSelectedFromCookie();
      if (persisted) onSelect(persisted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever selection changes
  React.useEffect(() => {
    if (selectedPath) writeSelectedToCookie(selectedPath);
  }, [selectedPath]);

  const isExpanded = React.useCallback(
    (path: string) => expanded.has(path),
    [expanded]
  );

  const setNodeExpanded = React.useCallback((path: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(path);
      else next.delete(path);
      writeExpandedToCookie(next);
      return next;
    });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed height */}
      {!hideHeader && (
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-foreground/90" />
              <span className="text-foreground font-medium">Files</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenSearch?.()}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Search (Ctrl/Cmd+K)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10.5 3.75a6.75 6.75 0 1 0 4.2 12.07l3.24 3.24a.75.75 0 1 0 1.06-1.06l-3.24-3.24A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Search</span>
            </button>
          </div>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        <div className="h-full overflow-y-auto p-2">
          <div className="space-y-1">
            {tree.map((node) => (
              <Tree
                key={node.path}
                node={node}
                selectedPath={selectedPath}
                onSelect={onSelect}
                isExpanded={isExpanded}
                setNodeExpanded={setNodeExpanded}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tree({
  node,
  selectedPath,
  onSelect,
  isExpanded,
  setNodeExpanded,
}: {
  node: TreeNode;
  selectedPath?: string;
  onSelect?: (path: string) => void;
  isExpanded: (path: string) => boolean;
  setNodeExpanded: (path: string, open: boolean) => void;
}) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  if (!hasChildren) {
    return (
      <div>
        <button
          onClick={() => {
            writeSelectedToCookie(node.path);
            onSelect?.(node.path);
          }}
          className={`w-full flex items-center gap-2 px-2 py-1 text-left text-sm rounded hover:bg-muted transition-colors ${
            selectedPath === node.path
              ? "bg-primary/20 text-primary"
              : "text-foreground"
          }`}
        >
          {getTechLogoByName(node.name) ?? getFileIconByName(node.name)}
          <span className="truncate min-w-0">{node.name}</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <Collapsible
        className="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
        open={isExpanded(node.path)}
        onOpenChange={(open) => setNodeExpanded(node.path, open)}
      >
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 px-2 py-1 text-left text-sm rounded hover:bg-muted transition-colors text-foreground">
            <ChevronRight className="w-4 h-4 transition-transform" />
            <FolderIcon className="w-4 h-4" />
            {node.name}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 space-y-1 mt-1">
            {node.children!.map((child) => (
              <Tree
                key={child.path}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                isExpanded={isExpanded}
                setNodeExpanded={setNodeExpanded}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
