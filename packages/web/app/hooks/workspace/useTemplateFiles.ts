import { useCallback } from "react";
import { getWebContainer } from "../../lib/webcontainer";
import { autoInstallDependencies } from "../../lib/nodeModulesAutoInstall";

interface TemplateFileParam {
  name?: string;
  path: string;
  content: string;
}

interface UseTemplateFilesDeps {
  files: {
    setupTemplateFiles: (files: Array<{ name: string; path: string; content: string }>) => Array<{ name: string; path: string; content: string }>;
  };
  saveFile: (path: string, content: string) => Promise<void>;
  runLinear: (files: Array<{ path: string; content: string }>) => Promise<string | null>;
  setPreviewUrl: (url: string | null) => void;
  resetProjectDirectory?: (projectRoot?: string) => Promise<void>;
  runShell?: (command: string, onLine?: (line: string) => void, background?: boolean) => Promise<number>;
}

export function useTemplateFiles({ files, saveFile, runLinear, setPreviewUrl, resetProjectDirectory, runShell }: UseTemplateFilesDeps) {
  const handleTemplateFiles = useCallback(
    async (templateFiles: TemplateFileParam[]) => {
      try {
        // Clean the project directory first to avoid leftover placeholder files
        if (resetProjectDirectory) {
          try { await resetProjectDirectory("/home/project"); } catch {}
        }
        const normalized = templateFiles.map((f) => ({
          name: f.name ?? (f.path.split("/").pop() || f.path),
          path: f.path,
          content: f.content,
        }));
        const wcFiles = files.setupTemplateFiles(normalized);

        const fileWritePromises = wcFiles.map((f) => saveFile(f.path, f.content));
        await Promise.all(fileWritePromises);

        // Ensure the WebContainer is booted and these files exist in its FS
        await runLinear(wcFiles.map((f) => ({ path: f.path, content: f.content })));

        // Auto-install dependencies if package.json exists in template files
        const packageJsonFile = wcFiles.find(
          (f) => f.path === "package.json" || f.path.endsWith("/package.json")
        );

        if (packageJsonFile && runShell) {
          // Handle npm install with caching
          (async () => {
            try {
              const wc = await getWebContainer();

              if (!wc) {
                return;
              }

              await autoInstallDependencies({
                packageJsonContent: packageJsonFile.content,
                wc,
                runShell,
                appendTerminalLine: () => {}, // Template files don't show terminal output
              });
            } catch (error) {
              console.error("[Template] Install/cache failed:", error);
              // Fallback to simple npm install
              try {
                await runShell("npm install", undefined, true);
              } catch {}
            }
          })();
        }

        // Do not start dev server here; preview will be set when shell starts server
        setPreviewUrl(null);
      } catch (error) {
        console.error("Error handling template files:", error);
        setPreviewUrl(null);
      }
    },
    [files, saveFile, runLinear, setPreviewUrl, resetProjectDirectory, runShell]
  );

  return { handleTemplateFiles };
}


