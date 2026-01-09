import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  FileCode,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Music as MusicIcon,
  Archive as ArchiveIcon,
  Database as DatabaseIcon,
  Package as PackageIcon,
  Terminal as TerminalIcon,
  Atom,
} from "lucide-react";
import { Badge } from "./ui/badge";

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

function LogoJS() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="w-4 h-4 shrink-0"
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
      className="w-4 h-4 shrink-0"
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
      className="w-4 h-4 shrink-0"
      aria-label="HTML"
    >
      <path d="M4 2h24l-2.2 24L16 30l-9.8-4L4 2z" fill="#E34F26" />
      <path d="M16 26.5l7.9-3.2L24.5 4H16v22.5z" fill="#EF652A" />
    </svg>
  );
}

function LogoCSS() {
  return (
    <svg viewBox="0 0 32 32" className="w-4 h-4 shrink-0" aria-label="CSS">
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
        className="w-4 h-4 shrink-0"
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

interface FileItemEntry {
  name: string;
  status: "created" | "modified";
  completed?: boolean;
}

interface FileCreationChecklistProps {
  title: string;
  files: FileItemEntry[];
  isApplicationStarted?: boolean;
  command?: string;
  versionNumber?: number;
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
    return <PackageIcon className="w-4 h-4 shrink-0" />;
  }
  if (
    lower === "readme" ||
    lower === "readme.md" ||
    lower.endsWith(".md") ||
    lower.endsWith(".mdx") ||
    lower.endsWith(".txt")
  ) {
    return <FileText className="w-4 h-4 shrink-0" />;
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
    return <ImageIcon className="w-4 h-4 shrink-0" />;
  }
  if (["mp4", "webm", "mov", "m4v", "avi", "mkv"].includes(ext)) {
    return <VideoIcon className="w-4 h-4 shrink-0" />;
  }
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) {
    return <MusicIcon className="w-4 h-4 shrink-0" />;
  }

  // Archives
  if (["zip", "tar", "gz", "tgz", "rar", "7z", "xz", "bz2"].includes(ext)) {
    return <ArchiveIcon className="w-4 h-4 shrink-0" />;
  }

  // Databases / data
  if (["sql", "db", "sqlite", "sqlite3", "mdb"].includes(ext)) {
    return <DatabaseIcon className="w-4 h-4 shrink-0" />;
  }

  // Shell / scripts
  if (["sh", "bash", "zsh", "ps1", "bat", "cmd"].includes(ext)) {
    return <TerminalIcon className="w-4 h-4 shrink-0" />;
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
    return <FileText className="w-4 h-4 shrink-0" />;
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
      "c",
      "cpp",
      "h",
      "hpp",
      "cs",
      "php",
      "swift",
      "r",
      "scala",
      "dart",
      "lua",
      "pl",
      "vim",
      "ex",
      "exs",
      "erl",
      "hrl",
      "clj",
      "cljs",
      "cljc",
      "elm",
      "fs",
      "fsx",
      "ml",
      "mli",
      "hs",
      "lhs",
    ].includes(ext)
  ) {
    return <FileCode className="w-4 h-4 shrink-0" />;
  }

  // HTML/CSS/Web
  if (["html", "htm", "css", "scss", "sass", "less", "styl"].includes(ext)) {
    return <FileCode className="w-4 h-4 shrink-0" />;
  }

  // Default
  return <FileIcon className="w-4 h-4 shrink-0" />;
}

export function FileCreationChecklist({
  title,
  files,
  isApplicationStarted = false,
  command = "",
  versionNumber,
}: FileCreationChecklistProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="bg-gradient-to-b from-surface-2/80 to-surface-1/90 border border-border/30 rounded-2xl overflow-hidden shadow-lg shadow-black/5 backdrop-blur-sm">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-surface-3/30 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20">
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-purple-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-purple-400" />
          )}
        </div>
        <span className="font-medium text-sm text-foreground">{title}</span>
        {versionNumber && (
          <Badge
            variant="secondary"
            className="text-[10px] px-2 py-0.5 h-auto font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20"
          >
            v{versionNumber}
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground/70">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="border-t border-border/20">
          <div className="divide-y divide-border/20">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-3/20 transition-colors"
              >
                {/* Status indicator */}
                <div className={`flex items-center justify-center w-6 h-6 rounded-lg ${
                  file.completed 
                    ? file.status === "modified" 
                      ? "bg-amber-500/15 border border-amber-500/20" 
                      : "bg-emerald-500/15 border border-emerald-500/20"
                    : "bg-purple-500/15 border border-purple-500/20"
                }`}>
                  {file.completed ? (
                    file.status === "modified" ? (
                      <span className="text-[10px] text-amber-400 font-bold">M</span>
                    ) : (
                      <Check className="w-3 h-3 text-emerald-400" />
                    )
                  ) : (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                  )}
                </div>

                {/* File icon */}
                <div className={file.completed ? "opacity-100" : "opacity-60"}>
                  {getTechLogoByName(file.name) ?? getFileIconByName(file.name)}
                </div>

                {/* File name */}
                <span className={`text-sm font-mono ${
                  file.completed ? "text-foreground" : "text-foreground/60"
                }`}>
                  {file.name}
                </span>

                {/* Status badge */}
                <span className={`ml-auto text-[10px] font-semibold px-2.5 py-1 rounded-lg ${
                  file.completed
                    ? file.status === "modified"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                }`}>
                  {file.status === "modified"
                    ? file.completed ? "Modified" : "Modifying..."
                    : file.completed ? "Created" : "Creating..."}
                </span>
              </div>
            ))}
          </div>

          {isApplicationStarted && (
            <div className="flex items-center gap-3 px-4 py-3.5 bg-emerald-500/5 border-t border-border/20">
              <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-emerald-400">Application started</span>
            </div>
          )}

          {command && (
            <div className="px-4 py-3 bg-surface-2/30 border-t border-border/20">
              <div className="bg-surface-1/80 border border-border/30 rounded-xl px-4 py-2.5 font-mono text-xs text-muted-foreground">
                <span className="text-purple-400 mr-2">$</span>
                {command}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
