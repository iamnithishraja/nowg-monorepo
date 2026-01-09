import { useEffect } from "react";

export function useExposeFiles(templateFilesState: Array<{ path: string; content: string }>) {
  useEffect(() => {
    const anyWindow = window as any;
    anyWindow.__NOWGAI_WORKSPACE_FILES__ =
      templateFilesState?.map((f) => ({ path: f.path, content: f.content })) || [];
    return () => {
      try {
        anyWindow.__NOWGAI_WORKSPACE_FILES__ = [];
      } catch {}
    };
  }, [templateFilesState]);
}


