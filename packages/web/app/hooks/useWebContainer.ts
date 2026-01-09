import { useState, useCallback } from "react";
import {
  runWebContainer,
  stopDevServer,
  writeWebContainerFile,
  resetProjectDirectory,
  runShellCommand,
  runShellCommandBackground,
  onPreviewUrl,
  killAllProcesses,
} from "../lib/webcontainer";

export function useWebContainer() {
  const [ready] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [terminalListeners, setTerminalListeners] = useState<
    ((line: string) => void)[]
  >([]);

  const runLinear = useCallback(
    async (files: Array<{ path: string; content: string }>) => {
      if (!files || files.length === 0) {
        return null;
      }

      setLoading(true);
      setError(null);
      setPreviewUrl(null);

      try {
        const url = await runWebContainer(files);

        if (url) {
          setPreviewUrl(url);
          return url;
        } else {
          setError("Failed to start WebContainer - no URL returned");
          return null;
        }
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error("[Hook] runLinear error", e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Subscribe to preview URL changes from the WebContainer library
  useState(() => {
    const off = onPreviewUrl((url) => {
      setPreviewUrl(url);
    });
    return off;
  });

  const onTerminalOutput = useCallback((cb: (line: string) => void) => {
    setTerminalListeners((prev) => [...prev, cb]);
    return () => setTerminalListeners((prev) => prev.filter((f) => f !== cb));
  }, []);

  const runShell = useCallback(
    async (
      command: string,
      onLine?: (line: string) => void,
      background = false
    ) => {
      const multiplex = (line: string) => {
        onLine?.(line);
        for (const l of terminalListeners) l(line);
      };
      if (background) {
        return await new Promise<number>((resolve) => {
          runShellCommandBackground(command, multiplex, (code) => {
            resolve(typeof code === "number" ? code : 0);
          });
        });
      }
      return runShellCommand(command, multiplex);
    },
    [terminalListeners]
  );

  const stop = useCallback(async () => {
    try {
      await stopDevServer();
      setPreviewUrl(null);
    } catch (e) {
      console.error("[Hook] Error stopping server:", e);
    }
  }, []);

  return {
    ready,
    error,
    loading,
    previewUrl,
    runLinear,
    runShell,
    onTerminalOutput,
    stop,
    killAll: killAllProcesses,
    saveFile: writeWebContainerFile,
    resetProjectDirectory,
  };
}
