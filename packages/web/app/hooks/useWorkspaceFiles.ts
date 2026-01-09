import { useState } from "react";
import { WORK_DIR, type FileMap } from "../utils/constants";
import type { FileAction } from "../types/action";

interface TemplateFile {
  name: string;
  path: string;
  content: string;
}

export function useWorkspaceFiles() {
  const [filesMap, setFilesMap] = useState<FileMap>({});
  const [templateFilesState, setTemplateFilesState] = useState<TemplateFile[]>(
    []
  );
  const [baseTemplateFiles, setBaseTemplateFiles] = useState<TemplateFile[]>(
    []
  );
  const [selectedPath, setSelectedPath] = useState<string>("");

  const normalizeFilePath = (rawPath: string, forWebContainer = false) => {
    let path = rawPath;

    if (forWebContainer) {
      // For WebContainer: relative from project root
      if (path.startsWith("/")) {
        path = path.replace(`${WORK_DIR}/`, "");
        if (path.startsWith("/")) path = path.slice(1);
      }
    } else {
      // For UI: absolute paths
      path = rawPath.startsWith("/")
        ? rawPath.startsWith(`${WORK_DIR}/`)
          ? rawPath
          : `${WORK_DIR}${rawPath}`
        : `${WORK_DIR}/${rawPath}`;
    }

    return path;
  };

  const updateFileInState = (
    rawPath: string,
    content: string,
    mountedRef?: React.RefObject<boolean>
  ) => {
    if (mountedRef?.current === false) return;

    const absolutePath = normalizeFilePath(rawPath, false);
    const wcPath = normalizeFilePath(rawPath, true);
    const fileName = wcPath.split("/").pop() || wcPath;

    // Update filesMap for context
    setFilesMap((prev) => ({
      ...prev,
      [absolutePath]: { type: "file", content, isBinary: false },
    }));

    // Update templateFilesState for UI
    setTemplateFilesState((prev) => {
      const idx = prev.findIndex((f) => f.path === wcPath);

      if (idx === -1) {
        if (!selectedPath) setTimeout(() => setSelectedPath(wcPath), 50);
        return [...prev, { name: fileName, path: wcPath, content }];
      } else {
        const next = [...prev];
        next[idx] = { ...next[idx], content };
        return next;
      }
    });
  };

  const applyFileAction = async (
    action: FileAction,
    saveFile: (path: string, content: string) => Promise<void>,
    messageId: string,
    artifactId: string,
    actionId: string
  ) => {
    try {
      const rawPath = action.filePath || "";
      const absolutePath = normalizeFilePath(rawPath, false);
      const wcPath = normalizeFilePath(rawPath, true);
      const content = action.content ?? "";

      // Check if this is binary content (base64 data URL)
      const isBinary =
        content.startsWith("data:") && content.includes("base64,");

      // Save to WebContainer and wait for completion
      await saveFile(wcPath, content);

      // Update filesMap for context
      setFilesMap((prev) => ({
        ...prev,
        [absolutePath]: { type: "file", content, isBinary },
      }));

      // Update templateFilesState for UI
      setTemplateFilesState((prev) => {
        const idx = prev.findIndex((f) => f.path === wcPath);
        const fileName = wcPath.split("/").pop() || wcPath;

        if (idx === -1) {
          return [...prev, { name: fileName, path: wcPath, content }];
        } else {
          const next = [...prev];
          next[idx] = { ...next[idx], content };
          return next;
        }
      });
    } catch (error) {
      console.error(
        "Failed applying file action",
        { messageId, artifactId, actionId, filePath: action.filePath },
        error
      );
    }
  };

  const setupTemplateFiles = (files: TemplateFile[]) => {
    // Normalize paths for WebContainer
    const wcFiles = files.map((f) => ({
      name: f.name,
      path: normalizeFilePath(f.path, true),
      content: f.content,
    }));

    setTemplateFilesState(wcFiles);
    // Capture base template snapshot for future reverts
    setBaseTemplateFiles(wcFiles);

    // Build initial FileMap with absolute paths
    const initialMap: FileMap = {};
    for (const f of wcFiles) {
      const absolutePath = `${WORK_DIR}/${f.path.replace(/^\//, "")}`;
      initialMap[absolutePath] = {
        type: "file",
        content: f.content,
        isBinary: false,
      };
    }
    setFilesMap(initialMap);

    // Select first file by default
    if (files.length > 0 && !selectedPath) {
      setSelectedPath(files[0].path);
    }

    return wcFiles;
  };

  const updateFileContent = (path: string, content: string) => {
    setTemplateFilesState((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content } : f))
    );
  };

  return {
    filesMap,
    setFilesMap,
    templateFilesState,
    setTemplateFilesState,
    baseTemplateFiles,
    selectedPath,
    setSelectedPath,
    normalizeFilePath,
    updateFileInState,
    applyFileAction,
    setupTemplateFiles,
    updateFileContent,
  };
}
