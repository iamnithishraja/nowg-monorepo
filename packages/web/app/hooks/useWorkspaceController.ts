import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { OPENROUTER_MODELS } from "../consts/models";
import { filesToSnapshot, saveSnapshot } from "../lib/chatPersistence";
import { createClientFileStorageService } from "../lib/clientFileStorage";
import {
  autoInstallDependencies,
  tryRestoreNodeModulesCache,
} from "../lib/nodeModulesAutoInstall";
import { getWebContainer } from "../lib/webcontainer";
import { useWorkspaceStore } from "../stores/useWorkspaceStore";
import type { Message } from "../types/chat";
import type {
  TemplateFileSnapshot,
  WorkspaceVersion,
} from "../types/versioning";
import type { FileMap } from "../utils/constants";
import { WORK_DIR } from "../utils/constants";
import {
  createConversationVersion,
  fetchConversationVersions,
} from "../utils/versionApi";
import {
  convertToUIMessages,
  createConversation,
  loadConversation,
  selectTemplate,
  updateConversationUrl,
} from "../utils/workspaceApi";
import { useStreamingHandler } from "./useStreamingHandler";
import { useToolExecution } from "./useToolExecution";
import { useWebContainer } from "./useWebContainer";
import { useWorkspaceChat } from "./useWorkspaceChat";
import { useWorkspaceFiles } from "./useWorkspaceFiles";
import { useChatHandlers } from "./workspace/useChatHandlers";
import { useExposeFiles } from "./workspace/useExposeFiles";
import { useInitialPromptHandler } from "./workspace/useInitialPromptHandler";
import { useStreamingWrapper } from "./workspace/useStreamingWrapper";
import { useTemplateFiles } from "./workspace/useTemplateFiles";
import {
  reconstructFilesFromArtifacts,
  reconstructFilesFromMessages,
  useWorkspaceInit,
} from "./workspace/useWorkspaceInit";

const isBase64DataUrl = (content: string) =>
  content.startsWith("data:") && content.includes("base64,");

const cloneTemplateFiles = (
  files: TemplateFileSnapshot[],
): TemplateFileSnapshot[] => files.map((file) => ({ ...file }));

const buildFilesMapFromSnapshot = (snapshot: TemplateFileSnapshot[]): FileMap =>
  snapshot.reduce<FileMap>((acc, file) => {
    const absolutePath = `${WORK_DIR}/${file.path.replace(/^\//, "")}`;
    acc[absolutePath] = {
      type: "file",
      content: file.content,
      isBinary: isBase64DataUrl(file.content),
    };
    return acc;
  }, {});

function useConversationVersions(conversationId: string | null) {
  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!conversationId) {
        if (!cancelled) {
          setVersions([]);
          setIsHydrated(true);
        }
        return;
      }
      try {
        setIsHydrated(false);
        const serverVersions = await fetchConversationVersions(conversationId);
        if (!cancelled) {
          setVersions(serverVersions);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[Workspace] Failed to load versions", error);
          setVersions([]);
        }
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const createVersion = useCallback(
    async (payload: {
      label?: string;
      files: TemplateFileSnapshot[];
      previewUrl?: string | null;
      selectedPath?: string;
      anchorMessageId?: string | null;
    }) => {
      if (!conversationId) return null;
      setIsSaving(true);
      try {
        const saved = await createConversationVersion(conversationId, payload);
        setVersions((prev) => [...prev, saved]);
        return saved;
      } catch (error) {
        console.error("Failed to save version snapshot:", error);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [conversationId],
  );

  return {
    versions,
    currentVersionId: versions[versions.length - 1]?.id ?? null,
    isHydrated,
    isSaving,
    createVersion,
  };
}

export function useWorkspaceController(
  designScheme?: any,
  onInsufficientBalance?: (errorData?: any) => void,
  onChatTitleUpdated?: (title: string) => void,
) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const {
    selectedModel,
    setSelectedModel,
    conversationId,
    setConversationId,
    conversationTitle,
    setConversationTitle,
    input,
    setInput,
    activeTab,
    setActiveTab,
    previewUrl,
    setPreviewUrl,
    isProcessingTemplate,
    setIsProcessingTemplate,
    hasHandledInitialPrompt,
    setHasHandledInitialPrompt,
  } = useWorkspaceStore();

  const {
    runLinear,
    runShell,
    onTerminalOutput,
    saveFile,
    resetProjectDirectory,
    previewUrl: livePreviewUrl,
    stop: stopWebContainer,
    killAll,
  } = useWebContainer() as any;
  const chat = useWorkspaceChat();
  const files = useWorkspaceFiles();
  const toolExecution = useToolExecution();
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  // Track the streaming conversation ID (since state updates are async)
  // This ref tracks the conversation ID that comes from the streaming response
  const streamingConversationIdRef = useRef<string | null>(null);

  // Reset the streaming ref when conversationId prop changes
  useEffect(() => {
    // Only reset if we have a new conversationId (not null/undefined)
    if (conversationId) {
      streamingConversationIdRef.current = conversationId;
    }
  }, [conversationId]);
  const {
    versions,
    currentVersionId: latestVersionIdInList,
    isHydrated: versionsHydrated,
    isSaving: isSavingVersion,
    createVersion,
  } = useConversationVersions(conversationId);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const isOnLatestVersion =
    !currentVersionId ||
    !latestVersionIdInList ||
    currentVersionId === latestVersionIdInList;

  useEffect(() => {
    if (versions.length === 0) {
      setCurrentVersionId(null);
      return;
    }
    if (
      !currentVersionId ||
      !versions.some((version) => version.id === currentVersionId)
    ) {
      setCurrentVersionId(versions[versions.length - 1]?.id ?? null);
    }
  }, [versions, currentVersionId]);
  const latestFilesRef = useRef(files.templateFilesState);
  const latestMessagesRef = useRef(chat.messages);
  const latestSelectedPathRef = useRef(files.selectedPath);
  const latestPreviewRef = useRef<string | null>(
    livePreviewUrl || previewUrl || null,
  );
  // Track if version was captured in current streaming session (prevents duplicates)
  const versionCapturedInSessionRef = useRef(false);

  useEffect(() => {
    latestFilesRef.current = files.templateFilesState;
  }, [files.templateFilesState]);

  useEffect(() => {
    latestMessagesRef.current = chat.messages;
  }, [chat.messages]);

  useEffect(() => {
    latestSelectedPathRef.current = files.selectedPath;
  }, [files.selectedPath]);

  useEffect(() => {
    latestPreviewRef.current = livePreviewUrl || previewUrl || null;
  }, [livePreviewUrl, previewUrl]);

  const captureVersionSnapshot = useCallback(
    async (label?: string, force = false, filesOverride?: TemplateFileSnapshot[]) => {
      // Skip if already captured in this session (unless forced)
      if (!force && versionCapturedInSessionRef.current) {
        return;
      }

      if (!versionsHydrated || !conversationId) return;

      const filesSnapshot = filesOverride ? cloneTemplateFiles(filesOverride) : cloneTemplateFiles(latestFilesRef.current);
      if (filesSnapshot.length === 0) {
        return;
      }

      // Mark as captured for this session
      versionCapturedInSessionRef.current = true;

      let anchorMessageId: string | null = null;
      try {
        const serverData = await loadConversation(conversationId);
        const serverMessages = serverData?.messages ?? [];
        anchorMessageId = serverMessages[serverMessages.length - 1]?.id ?? null;
      } catch (error) {
        console.warn(
          "Failed to resolve persistent message id, falling back",
          error,
        );
        const messagesSnapshot = latestMessagesRef.current;
        anchorMessageId =
          messagesSnapshot.length > 0
            ? (messagesSnapshot[messagesSnapshot.length - 1]?.id ?? null)
            : null;
      }

      try {
        const savedVersion = await createVersion({
          label,
          files: filesSnapshot,
          previewUrl: latestPreviewRef.current ?? null,
          selectedPath: latestSelectedPathRef.current,
          anchorMessageId,
        });
        if (savedVersion?.id) {
          setCurrentVersionId(savedVersion.id);
        }
      } catch (error) {
        console.error("Failed to save version snapshot:", error);
      }
    },
    [
      versionsHydrated,
      conversationId,
      latestFilesRef,
      latestSelectedPathRef,
      latestPreviewRef,
      latestMessagesRef,
      createVersion,
    ],
  );

  const handleVersionSelect = useCallback(
    async (versionId: string) => {
      if (!versionId || isRestoringVersion || !versionsHydrated) return;

      const targetVersion = versions.find(
        (version) => version.id === versionId,
      );
      if (!targetVersion) return;

      if (currentVersionId === versionId) {
        return;
      }

      setIsRestoringVersion(true);
      try {
        await resetProjectDirectory("/home/project");

        for (const file of targetVersion.files) {
          await saveFile(file.path, file.content);
        }

        const clonedFiles = cloneTemplateFiles(targetVersion.files);
        files.setTemplateFilesState(clonedFiles);
        latestFilesRef.current = clonedFiles;
        files.setFilesMap(buildFilesMapFromSnapshot(clonedFiles));
        const nextSelectedPath =
          targetVersion.selectedPath ?? clonedFiles[0]?.path ?? "";
        files.setSelectedPath(nextSelectedPath);
        latestSelectedPathRef.current = nextSelectedPath;

        chat.setIsLoading(false);
        chat.setIsStreaming(false);
        if ((chat as any).resetFileIndicators) {
          (chat as any).resetFileIndicators();
        }

        const nextPreview = targetVersion.previewUrl ?? null;
        setPreviewUrl(nextPreview);
        latestPreviewRef.current = nextPreview;

        const { clearTerminal } = useWorkspaceStore.getState() as any;
        clearTerminal();
        setCurrentVersionId(versionId);
      } catch (error) {
        console.error("Failed to switch versions:", error);
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [
      versions,
      isRestoringVersion,
      versionsHydrated,
      currentVersionId,
      resetProjectDirectory,
      saveFile,
      files,
      chat,
      setPreviewUrl,
    ],
  );

  const ensureLatestVersionBeforeSend = useCallback(async () => {
    if (
      !versionsHydrated ||
      !latestVersionIdInList ||
      currentVersionId === latestVersionIdInList
    ) {
      return;
    }
    await handleVersionSelect(latestVersionIdInList);
  }, [
    versionsHydrated,
    latestVersionIdInList,
    currentVersionId,
    handleVersionSelect,
  ]);

  const handleManualVersionCreate = useCallback(
    (label?: string, force = false, filesOverride?: TemplateFileSnapshot[]) => {
      void captureVersionSnapshot(label, force, filesOverride);
    },
    [captureVersionSnapshot],
  );

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { handleStreamingResponse } = useStreamingHandler();

  // Keep a slot for uploads to use specifically for the initial send
  const initialUploadsRef = useRef<File[] | null>(null);

  // File restoration function
  const restoreFilesForConversation = async (
    conversationId: string,
  ): Promise<File[]> => {
    try {
      const fileStorageService = createClientFileStorageService();
      const files =
        await fileStorageService.getFilesForConversation(conversationId);

      if (files && files.length > 0) {
        const restoredFiles: File[] = [];

        for (const fileMeta of files) {
          try {
            // Get the actual file data from IndexedDB
            const db = await fileStorageService.initDatabase();
            const transaction = db.transaction(["files"], "readonly");
            const store = transaction.objectStore("files");
            const request = store.get(fileMeta.id);

            const result: any = await new Promise((resolve, reject) => {
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });

            if (result) {
              const content = result.base64Data || result.content;
              if (content) {
                // Convert base64 back to File object
                let blob: Blob;
                if (result.isBinary && result.base64Data) {
                  // For binary files, decode base64
                  const base64Data =
                    result.base64Data.split(",")[1] || result.base64Data;
                  const byteCharacters = atob(base64Data);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  blob = new Blob([byteArray], { type: fileMeta.type });
                } else {
                  // For text files
                  blob = new Blob([content], { type: fileMeta.type });
                }

                const file = new File([blob], fileMeta.name, {
                  type: fileMeta.type,
                });
                restoredFiles.push(file);
              }
            }
          } catch (error) {
            console.error(
              `❌ [FILE RESTORE] Error restoring file ${fileMeta.name}:`,
              error,
            );
          }
        }

        if (restoredFiles.length > 0) {
          setUploadedFiles(restoredFiles);
          return restoredFiles;
        }
      } else {
      }
    } catch (error) {
      console.error("❌ [FILE RESTORE] Error restoring files:", error);
    }
    return [];
  };

  const isMountedRef = useRef(true);
  const shellRequestedRef = useRef(false);
  const npmInstallHandledRef = useRef(false); // Track if npm install was already run in this session

  const urlConversationId =
    searchParams.get("conversationId") ||
    (location.state as any)?.conversationId;
  const {
    initialPrompt,
    displayMessage,
    isSystemPrompt,
    model,
    importedFiles,
    repoUrl,
    figmaUrl,
    enableFigmaMCP,
  } = (location.state as any) || {};

  useEffect(() => {
    if (!selectedModel) {
      // Use model from navigation state if available, otherwise default to first model
      const modelFromState = model || OPENROUTER_MODELS[0].id;
      setSelectedModel(modelFromState);
    }
  }, [selectedModel, setSelectedModel, model]);

  // Restore files ONLY when coming from home route with initial prompt
  // Don't restore for existing conversations opened from sidebar
  useEffect(() => {
    if (conversationId && initialPrompt) {
      // Only restore files if we have an initial prompt (coming from home route)
      restoreFilesForConversation(conversationId).catch(() => {});
    } else if (conversationId && !initialPrompt) {
      // When opening existing conversation from sidebar, clear any uploaded files state
      setUploadedFiles([]);
    }
  }, [conversationId, initialPrompt]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Don't cleanup chat during re-renders to prevent aborting ongoing requests
      setIsProcessingTemplate(false);
      // NOTE: We do NOT kill processes here anymore!
      // Killing is now handled in useWorkspaceInit only when switching to a DIFFERENT conversation
      // This allows the dev server to keep running when navigating away and back
    };
  }, []);

  const handleFileActionStart = async (action: any) => {
    if (!isMountedRef.current) return;

    try {
      const rawPath = action.filePath || "";
      const wcPath = files.normalizeFilePath(rawPath, true);
      const fileName = wcPath.split("/").pop() || wcPath;

      // Hide protected config files from UI checklist
      const isProtected =
        /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
          fileName,
        );
      if (isProtected) return;

      // Determine if file existed before updating state
      const existed = files.templateFilesState.some(
        (f: any) => f.path === wcPath,
      );

      // Update command progress to show file creation
      const { setCommandProgress } = useWorkspaceStore.getState() as any;
      setCommandProgress({
        phase: "preparing",
        message: "Creating files",
        details: `Writing ${fileName}...`,
        progress: 10,
        startTime: Date.now(),
        error: null,
      });

      // Show in-progress indicator immediately when LLM starts generating the file
      chat.addFileCreationIndicator(
        fileName,
        existed ? "modified" : "created",
        isMountedRef,
      );
    } catch (error) {
      console.error("File action start failed:", error);
    }
  };

  const handleFileAction = async (action: any) => {
    if (!isMountedRef.current) return;

    try {
      const rawPath = action.filePath || "";
      const wcPath = files.normalizeFilePath(rawPath, true);
      const content = action.content ?? "";
      const fileName = wcPath.split("/").pop() || wcPath;

      // Hide protected config files from UI checklist and skip marking as created/modified
      const isProtected =
        /^(tailwind\.config\.(js|ts)|postcss\.config\.(js|ts)|vite\.config\.(js|ts))$/i.test(
          fileName,
        );
      if (isProtected) {
        // Non-blocking file write
        saveFile(wcPath, content).catch(console.error);
        files.updateFileInState(rawPath, content, isMountedRef);
        return;
      }

      // Save the file immediately (non-blocking for better performance)
      saveFile(wcPath, content).catch(console.error);

      // Smart auto-install: Run npm install if package.json changes and LLM didn't already handle it
      // Uses a delay to give LLM time to send its own shell action first
      if (fileName === "package.json" && !npmInstallHandledRef.current) {
        const packageJsonContent = content;

        // Delay to let LLM shell actions arrive first
        setTimeout(async () => {
          // Check again after delay - LLM might have sent npm install by now
          if (npmInstallHandledRef.current || !isMountedRef.current) {
            return;
          }

          npmInstallHandledRef.current = true;

          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          const wc = await getWebContainer();

          if (!wc) {
            return;
          }

          try {
            await autoInstallDependencies({
              packageJsonContent,
              wc,
              runShell,
              appendTerminalLine,
            });

            // Refresh preview after npm install completes to pick up new dependencies
            window.dispatchEvent(
              new CustomEvent("preview-control", {
                detail: { action: "refresh" },
              }),
            );
          } catch (error) {
            console.error("[Auto-Install] Failed:", error);
          }
        }, 2000); // 2 second delay to let LLM shell actions arrive
      }

      if (!isMountedRef.current) return;

      files.updateFileInState(rawPath, content, isMountedRef);

      // Reduced delay for better perceived performance
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Mark as completed since file generation and save are done
      (chat as any).markFileCompleted?.(fileName, isMountedRef);
    } catch (error) {
      console.error("File action failed:", error);
    }
  };

  const handleShellAction = async (action: any) => {
    try {
      // Get command from either action.command (new) or action.content (loaded)
      let command = action.command || action.content?.trim();

      if (!command) {
        return;
      }

      shellRequestedRef.current = true;

      // Track if this is an npm install command
      const isNpmInstall =
        command.includes("npm install") ||
        command.includes("npm i ") ||
        command === "npm i";

      // Track if this is a dev server command
      const isDevServer =
        command.includes("npm run dev") ||
        command.includes("npm start") ||
        command.includes("yarn dev") ||
        command.includes("pnpm dev") ||
        command.includes("bun dev") ||
        command.includes("vite") ||
        command.includes("next dev");

      if (isNpmInstall) {
        npmInstallHandledRef.current = true;
      }

      // Mark application as started with the command
      if ((chat as any).addApplicationStarted) {
        (chat as any).addApplicationStarted(command, isMountedRef);
      }

      // Only runLinear if WebContainer is not already initialized or if no preview is running
      // This prevents breaking existing preview when running commands
      if (!previewUrl && !livePreviewUrl) {
        const wcFiles = files.templateFilesState.map((f: any) => ({
          path: f.path,
          content: f.content,
        }));
        await runLinear(wcFiles);
      }

      // Append banner to terminal via store and set initial progress
      const { appendTerminalLine, setIsTerminalRunning, setCommandProgress } =
        useWorkspaceStore.getState() as any;
      setIsTerminalRunning(true);
      appendTerminalLine(`$ ${command}`);

      // Set initial command progress based on command type
      if (isNpmInstall) {
        setCommandProgress({
          phase: "installing",
          message: "Installing dependencies",
          details: "Fetching and linking packages...",
          progress: 20,
          startTime: Date.now(),
          error: null,
        });
      } else if (isDevServer) {
        setCommandProgress({
          phase: "starting",
          message: "Starting development server",
          details: "Booting up the dev server...",
          progress: 70,
          startTime: Date.now(),
          error: null,
        });
      } else {
        setCommandProgress({
          phase: "preparing",
          message: "Running command",
          details:
            command.substring(0, 50) + (command.length > 50 ? "..." : ""),
          progress: 10,
          startTime: Date.now(),
          error: null,
        });
      }

      // Try to restore node_modules from cache if this is an npm install command
      // Cache is populated by background preload from GitHub repo on home page load
      if (isNpmInstall) {
        try {
          const packageJsonFile = files.templateFilesState.find(
            (f: any) =>
              f.path === "package.json" || f.path.endsWith("/package.json"),
          );

          if (packageJsonFile) {
            const wc = await getWebContainer();

            if (wc) {
              const result = await tryRestoreNodeModulesCache({
                packageJsonContent: packageJsonFile.content,
                wc,
                command,
                appendTerminalLine,
              });

              if (result.skipInstall) {
                setIsTerminalRunning(false);
                return;
              }

              if (result.modifiedCommand) {
                command = result.modifiedCommand;
              }
            }
          }
        } catch (cacheError) {
          console.error("[NodeModulesCache] Error checking cache:", cacheError);
          // Continue with normal npm install
        }
      }

      // Stream terminal output to store and detect preview URL lines
      const detach = onTerminalOutput((line: string) => {
        const { setCommandProgress } = useWorkspaceStore.getState() as any;

        // Detect Vite/WebContainer URL lines
        const urlMatch = line.match(/https?:\/\/[^\s]+/);
        if (urlMatch && !previewUrl) {
          setPreviewUrl(urlMatch[0]);
          // Update progress to ready
          setCommandProgress({
            phase: "ready",
            message: "Preview ready",
            details: "Your application is running",
            progress: 100,
          });
          // Auto-refresh preview when URL is detected
          window.dispatchEvent(
            new CustomEvent("preview-control", {
              detail: { action: "refresh" },
            }),
          );
        }

        // Detect server ready patterns and update progress
        const lowerLine = line.toLowerCase();
        if (
          /ready in|local:|localhost:|compiled successfully|listening on|running at|➜\s+local:/i.test(
            line,
          )
        ) {
          setCommandProgress({
            phase: "ready",
            message: "Server is ready",
            details: "Waiting for preview URL...",
            progress: 95,
          });
        } else if (
          /starting.*dev|vite|next dev|webpack|dev server/i.test(lowerLine)
        ) {
          setCommandProgress({
            phase: "starting",
            message: "Starting development server",
            details: "Booting up the dev server...",
            progress: 75,
          });
        } else if (
          /added\s+\d+\s+packages?|audited\s+\d+\s+packages?|up to date|done in\s+\d/i.test(
            lowerLine,
          )
        ) {
          setCommandProgress({
            phase: "building",
            message: "Dependencies installed",
            details: "Preparing to start server...",
            progress: 55,
          });
        } else if (
          /resolving|fetching|linking|installing|preinstall|postinstall/i.test(
            lowerLine,
          )
        ) {
          setCommandProgress({
            phase: "installing",
            message: "Installing dependencies",
            details: "Fetching and linking packages...",
            progress: 35,
          });
        }

        // Filter noisy extension warnings
        const noisy = /origins don't match|preloaded using link preload/i.test(
          line,
        );
        if (noisy) return;
      });

      // Run in background so UI stays responsive and we can acknowledge immediately
      runShell(
        command,
        (line: string) => {
          const cleaned = line
            // strip ANSI escape sequences like \u001b[1G, \u001b[0K, colors, etc.
            .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
            // drop carriage returns that create spinner artifacts
            .replace(/\r/g, "")
            .trim();

          // Skip empty lines, spinner chars, and very short lines
          if (cleaned.length === 0) return;
          if (cleaned.length <= 2) return; // Skip single/double char lines

          // Skip if line only contains spinner characters
          const onlySpinners =
            /^[\\/|\-⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏➜←↑→↓◐◓◑◒◴◷◶◵⣾⣽⣻⢿⡿⣟⣯⣷▌▐█▀▄■□●○◆◇\s]+$/.test(
              cleaned,
            );
          if (onlySpinners) return;

          appendTerminalLine(cleaned);
        },
        true,
      )
        .then(async () => {
          const { setCommandProgress, resetCommandProgress } =
            useWorkspaceStore.getState() as any;

          // Refresh preview after npm install completes to pick up new dependencies
          if (isNpmInstall) {
            setCommandProgress({
              phase: "building",
              message: "Dependencies installed",
              details: "Ready to start server...",
              progress: 55,
            });
            window.dispatchEvent(
              new CustomEvent("preview-control", {
                detail: { action: "refresh" },
              }),
            );
          }

          // If dev server command completed successfully, check for preview URL
          if (isDevServer) {
            // Give the server a moment to output the URL
            setTimeout(() => {
              const currentPreviewUrl = useWorkspaceStore.getState().previewUrl;
              if (currentPreviewUrl) {
                setCommandProgress({
                  phase: "ready",
                  message: "Preview ready",
                  details: "Your application is running",
                  progress: 100,
                });
                // Auto-refresh preview
                window.dispatchEvent(
                  new CustomEvent("preview-control", {
                    detail: { action: "refresh" },
                  }),
                );
              }
            }, 500);
          }
        })
        .catch((error: any) => {
          const { setCommandProgress } = useWorkspaceStore.getState() as any;
          setCommandProgress({
            phase: "error",
            message: "Command failed",
            details: error?.message || "An error occurred",
            progress: 0,
            error: error?.message || "Command execution failed",
          });
        })
        .finally(() => {
          setIsTerminalRunning(false);
          detach();
        });
    } catch (error) {
      console.error("Error handling shell action:", error);
    }
  };

  const { handleTemplateFiles } = useTemplateFiles({
    files,
    saveFile,
    runLinear,
    setPreviewUrl,
    resetProjectDirectory,
    runShell,
  });

  const { stream } = useStreamingWrapper(
    handleStreamingResponse,
    () => ({
      onConversationId: (id: string) => {
        if (id && !conversationId) {
          setConversationId(id);
          streamingConversationIdRef.current = id; // Track for snapshot saving
        }
      },
      onFileActionStart: async (action: any) => {
        await handleFileActionStart(action);
      },
      onFileAction: async (action: any) => {
        await handleFileAction(action);
      },
      onShellAction: async (action: any) => {
        await handleShellAction(action);
      },
      onTextDelta: (delta: string) => {
        // Append all text deltas (including processing placeholder)
        chat.updateLastAssistantMessage(
          (prev: string) => prev + delta,
          isMountedRef,
        );
      },
      // Surface DB queries and results to terminal for visibility
      onDbAction: (action: any) => {
        try {
          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          if (action?.sql) {
            appendTerminalLine(`-- executing SQL`);
            appendTerminalLine(action.sql);
          }
        } catch {}
      },
      onDbResult: (data: any) => {
        try {
          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          if (data?.ok) {
            appendTerminalLine(`-- SQL OK`);
          } else {
            appendTerminalLine(
              `-- SQL ERROR: ${data?.error || "unknown error"}`,
            );
          }
        } catch {}
      },
      onSupabaseInfo: (data: any) => {
        try {
          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          if (data?.supabaseUrl) {
            appendTerminalLine(`-- Supabase URL: ${data.supabaseUrl}`);
          }
        } catch {}
      },
      // Tool execution handlers for frontend tools
      onToolCall: toolExecution.executeToolCall,
      onToolCallStart: (toolCall) => {
        try {
          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          appendTerminalLine(`🔧 Executing tool: ${toolCall.name}`);
        } catch {}
      },
      onToolCallComplete: (result) => {
        try {
          const { appendTerminalLine } = useWorkspaceStore.getState() as any;
          if (result.success) {
            appendTerminalLine(`✅ Tool ${result.name} completed`);
          } else {
            const errorMsg =
              !result.success && "error" in result.result
                ? (result.result as { error: string }).error
                : "Unknown error";
            appendTerminalLine(`❌ Tool ${result.name} failed: ${errorMsg}`);
          }
        } catch {}
      },
      // R2 sync status handlers - server-side DB sync (conversation.json)
      // We ignore these now since client handles file upload loader separately
      onSyncStarted: () => {
        // Ignore - client-side file upload handles the loader
      },
      onSyncCompleted: () => {
        // Ignore - client-side file upload handles the loader
      },
      onMessageComplete: (content: string) => {
        // Extract and set project title FIRST
        const artifactMatch = content.match(
          /<nowgaiArtifact[^>]*title="([^"]*)"/i,
        );
        if (
          artifactMatch &&
          artifactMatch[1] &&
          (chat as any).setProjectTitle
        ) {
          (chat as any).setProjectTitle(artifactMatch[1], isMountedRef);
        }

        // Clean up content by removing all nowgai actions and artifacts
        // Remove any partial artifact/action content that leaked through streaming
        const cleanContent = content
          .replace(/<nowgaiAction[^>]*>[\s\S]*?<\/nowgaiAction>/g, "")
          .replace(/<nowgaiArtifact[^>]*>[\s\S]*?<\/nowgaiArtifact>/g, "")
          .replace(/<nowgai[^>]*$/, "")
          .trim();

        // Update message with cleaned content (preserves order, just removes file content)
        chat.updateLastAssistantMessage(cleanContent, isMountedRef);
      },
      onDone: () => {
        (async () => {
          console.log(
            `%c[R2 Sync] 🎯 onDone callback triggered - streaming complete`,
            "color: #8b5cf6; font-weight: bold; font-size: 14px",
          );
          if (isMountedRef.current) {
            chat.setIsStreaming(false);
            // Mark all remaining file indicators as completed (removes spinners)
            if ((chat as any).markAllFilesCompleted) {
              (chat as any).markAllFilesCompleted(isMountedRef);
            }
            // When prompt streaming is fully complete, switch to preview tab
            setActiveTab("preview" as any);
            void captureVersionSnapshot();

            // Use refs because state/closures are stale when this callback fires
            const currentConvId =
              streamingConversationIdRef.current || conversationId;
            // Use latestFilesRef to get current files (closure has stale state)
            const currentFiles = latestFilesRef.current;

            console.log(
              `%c[R2 Sync] 🔍 onDone check: conversationId=${currentConvId}, filesCount=${currentFiles?.length || 0}`,
              "color: #8b5cf6; font-weight: bold",
            );

            if (currentConvId && currentFiles.length > 0) {
              // Sync files to R2 from frontend (client-side upload)
              const { setIsSyncingToR2 } = useWorkspaceStore.getState();
              try {
                console.log(
                  `%c[R2 Sync] 🔄 Setting isSyncingToR2 = true`,
                  "color: #8b5cf6; font-weight: bold",
                );
                setIsSyncingToR2(true);

                const {
                  uploadFilesToR2WithPresignedUrls,
                  syncConversationJsonToR2,
                } = await import("../lib/r2UploadClient");

                const filesToSync = currentFiles.map((f: any) => ({
                  path: f.path,
                  content: f.content,
                }));

                console.log(
                  `%c[R2 Sync] 📤 Starting client-side upload of ${filesToSync.length} files...`,
                  "color: #8b5cf6; font-weight: bold",
                );

                const uploadResult = await uploadFilesToR2WithPresignedUrls(
                  currentConvId,
                  undefined, // No chatId for main conversation
                  filesToSync,
                );

                if (uploadResult.success) {
                  console.log(
                    `%c[R2 Sync] ✅ Successfully uploaded ${uploadResult.uploadedFiles.length} files`,
                    "color: #22c55e; font-weight: bold",
                  );
                } else {
                  console.warn(
                    `%c[R2 Sync] ⚠️ Some files failed to upload:`,
                    "color: #f59e0b; font-weight: bold",
                    uploadResult.failedFiles,
                  );
                }

                // Also sync conversation.json (metadata) to R2
                await syncConversationJsonToR2(currentConvId);
              } catch (syncError) {
                console.error(
                  `%c[R2 Sync] ❌ Error syncing files to R2:`,
                  "color: #ef4444; font-weight: bold",
                  syncError,
                );
              } finally {
                console.log(
                  `%c[R2 Sync] 🔄 Setting isSyncingToR2 = false`,
                  "color: #8b5cf6; font-weight: bold",
                );
                setIsSyncingToR2(false);
              }

              // Also save snapshot to IndexedDB for fast future restore
              try {
                const snapshot = filesToSnapshot(
                  currentFiles.map((f: any) => ({
                    path: f.path,
                    content: f.content,
                  })),
                );
                await saveSnapshot(currentConvId, snapshot);
              } catch (error) {
                console.error("[Snapshot] Failed to save snapshot:", error);
              }
            }
          }
          // Do not auto-start dev server on done; it will be started by shell stream
          shellRequestedRef.current = false;
          // Reset npm install flag for next streaming session
          npmInstallHandledRef.current = false;
        })();
      },
      onError: (error: string, errorType?: string) => {
        const err = new Error(error) as Error & { errorType?: string };
        // Preserve provider_maintenance context so catch blocks can identify it
        if (
          errorType === "provider_maintenance" ||
          error.includes("under maintenance") ||
          error.includes("won't be deducted")
        ) {
          err.errorType = "provider_maintenance";
        }
        throw err;
      },
    }),
    isMountedRef,
  );

  const { handleInitialPrompt } = useInitialPromptHandler({
    chat,
    files,
    selectedModel,
    conversationId,
    setInput,
    setIsProcessingTemplate,
    importedFiles,
    repoUrl,
    handleTemplateFiles,
    handleStreamingResponseWrapper: stream,
    isMountedRef,
    selectTemplate,
    designScheme,
    onInsufficientBalance,
    getUploadedFiles: () => initialUploadsRef.current || uploadedFiles,
    clearUploadedFiles: () => {
      setUploadedFiles([]);
      initialUploadsRef.current = [];
    },
    figmaUrl,
    enableFigmaMCP,
  });

  // Get chatId from search params
  const chatId = searchParams.get("chatId");
  const chatMode = useWorkspaceStore((s) => s.chatMode);

  const { handleSend: baseHandleSend } = useChatHandlers({
    chat,
    files,
    conversationId,
    chatId, // Pass chatId to handlers
    selectedModel,
    setInput,
    hasHandledInitialPrompt,
    setHasHandledInitialPrompt,
    handleInitialPrompt,
    isMountedRef,
    uploadedFiles,
    designScheme,
    onInsufficientBalance,
    figmaUrl,
    enableFigmaMCP,
    chatMode,
    onChatTitleUpdated,
    captureVersionSnapshot, // Auto-create version after chat streaming
  });

  const handleSend = async (messageContent: string) => {
    // Store files in IndexedDB and get file metadata
    const fileMetadata: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      uploadedAt: string;
      base64Data?: string;
    }> = [];

    // Capture current files to process
    const currentUploadedFiles = [...uploadedFiles];

    // Do not clear uploaded files yet; keep them until after sending so they are included as attachments

    if (currentUploadedFiles.length > 0 && conversationId) {
      const fileStorageService = createClientFileStorageService();

      // Process uploaded files and add them to the filesMap
      const processedFiles: {
        [key: string]: { type: "file"; content: string; isBinary: boolean };
      } = {};

      for (let i = 0; i < currentUploadedFiles.length; i++) {
        const file = currentUploadedFiles[i];
        const fileName = file.name;
        const filePath = `/uploaded/${fileName}`;

        // Store in IndexedDB
        try {
          const webContainer = (window as any).webcontainerInstance;
          const result = await fileStorageService.storeFile(
            file,
            conversationId,
            webContainer,
          );

          if (result.success && result.fileId) {
            // For images, read the base64 data to store in the database
            let base64Data: string | undefined = undefined;
            if (file.type.startsWith("image/")) {
              try {
                base64Data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = () => reject(reader.error);
                  reader.readAsDataURL(file);
                });
              } catch (error) {
                console.error("Error reading image file:", error);
              }
            }

            fileMetadata.push({
              id: result.fileId,
              name: file.name,
              type: file.type,
              size: file.size,
              uploadedAt: new Date().toISOString(),
              base64Data,
            });
          }
        } catch (error) {
          console.error("Error storing file in IndexedDB:", error);
        }

        try {
          if (
            file.type.startsWith("text/") ||
            /json|javascript|typescript|csv|xml|html|css|md|markdown/.test(
              file.type,
            ) ||
            /\.(txt|md|json|js|ts|tsx|jsx|css|html)$/i.test(file.name)
          ) {
            const content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            });
            processedFiles[filePath] = {
              type: "file",
              content,
              isBinary: false,
            };
          } else {
            // For binary (images, pdf, etc.), store as base64 data URL string to keep in context buffer if needed
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            processedFiles[filePath] = {
              type: "file",
              content: dataUrl,
              isBinary: true,
            };
          }
        } catch (error) {
          console.error("Error reading file:", error);
        }
      }

      // Merge uploaded files with existing filesMap
      const updatedFilesMap = { ...files.filesMap, ...processedFiles };
      files.setFilesMap(updatedFilesMap);

      // Removed image auto-add to template files
    }

    // Pass file metadata to baseHandleSend - it will add the message with files
    try {
      // Reset version captured flag for this new streaming session
      versionCapturedInSessionRef.current = false;

      const response = await baseHandleSend(messageContent, fileMetadata);

      // Clear uploaded files state immediately after message is sent
      setUploadedFiles([]);

      if (response) {
        await stream(response);

        // Ensure version snapshot is captured after streaming completes
        // This is a fallback in case onDone doesn't fire properly
        await captureVersionSnapshot();
      }

      // NOTE: We keep files in IndexedDB for faster loading
      // They are also saved to MongoDB for permanent storage
    } catch (error) {
      console.error("Error in handleSend:", error);

      // Handle specific error cases
      if (error instanceof Error) {
        const errorAny = error as any;
        // Check if this is an abort error
        if (error.name === "AbortError") {
          // Check if user intentionally cancelled (stop button)
          if (chat.userCancelledRef?.current) {
            chat.setError("Chat aborted.");
            chat.userCancelledRef.current = false;
          }
          // Otherwise it's cleanup/unmount - don't show error
          return;
        } else if (
          errorAny.errorType === "provider_maintenance" ||
          error.message.includes("under maintenance") ||
          error.message.includes("won't be deducted")
        ) {
          // Our OpenRouter credits exhausted — show maintenance message; do not deduct user credits
          chat.setError(error.message);
        } else if (
          error.message.includes("Insufficient balance") ||
          error.message.includes("Payment Required") ||
          error.message.includes("spending limit") ||
          error.message.includes("project wallet")
        ) {
          // Trigger insufficient balance modal instead of showing text error
          if (onInsufficientBalance) {
            onInsufficientBalance(errorAny.errorData);
            // Don't set any error message - let the modal handle it
          } else {
            // Fallback to text error if no callback provided
            const errorMessage =
              "💰 **Insufficient Balance**\n\nYour account balance is too low to continue. Please recharge your account to add credits.\n\n💡 **Quick Fix**: Click the 'Recharge' button in the header or go to the recharge page to add credits.";
            chat.setError(errorMessage);
          }
        } else {
          chat.setError(`Failed to process prompt: ${error.message}`);
        }
      } else {
        chat.setError("Failed to process prompt");
      }
      chat.setIsLoading(false);
      chat.setIsStreaming(false);
    }
  };

  // Handle regular prompts (not templates) using normal chat flow
  const handleRegularPrompt = async (
    messageContent: string,
    currentConversationId?: string,
  ) => {
    try {
      const activeConversationId = currentConversationId || conversationId;

      // Ensure model is set before proceeding
      if (!selectedModel) {
        setSelectedModel(OPENROUTER_MODELS[0].id);
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: messageContent,
      };

      chat.addMessage(userMessage, isMountedRef);
      chat.setIsLoading(true);
      chat.setIsStreaming(true);
      chat.setError(null);

      // Begin a new assistant message for proper streaming
      const assistantMessageId = chat.beginAssistantMessage(isMountedRef);

      // Use the selectedModel (which should now be set) or fallback to default
      const effectiveModel = selectedModel || OPENROUTER_MODELS[0].id;
      const response = await chat.sendChatMessage(
        [userMessage],
        files.filesMap || {},
        activeConversationId,
        effectiveModel,
        uploadedFiles,
      );

      await stream(response);
    } catch (error) {
      console.error("Error in handleRegularPrompt:", error);

      // Handle specific error cases
      if (error instanceof Error) {
        // Check if this is an abort error
        if (error.name === "AbortError") {
          // Check if user intentionally cancelled (stop button)
          if (chat.userCancelledRef?.current) {
            chat.setError("Chat aborted.");
            chat.userCancelledRef.current = false;
          }
          // Otherwise it's cleanup/unmount - don't show error
          return;
        } else if (
          (error as any).errorType === "provider_maintenance" ||
          error.message.includes("under maintenance") ||
          error.message.includes("won't be deducted")
        ) {
          // Our OpenRouter credits exhausted — show maintenance message; do not deduct user credits
          chat.setError(error.message);
        } else if (
          error.message.includes("Insufficient balance") ||
          error.message.includes("Payment Required")
        ) {
          // Trigger insufficient balance modal instead of showing text error
          if (onInsufficientBalance) {
            onInsufficientBalance();
            // Don't set any error message - let the modal handle it
          } else {
            // Fallback to text error if no callback provided
            const errorMessage =
              "💰 **Insufficient Balance**\n\nYour account balance is too low to continue. Please recharge your account to add credits.\n\n💡 **Quick Fix**: Click the 'Recharge' button in the header or go to the recharge page to add credits.";
            chat.setError(errorMessage);
          }
        } else {
          chat.setError(`Failed to process prompt: ${error.message}`);
        }
      } else {
        chat.setError("Failed to process prompt");
      }
      chat.setIsLoading(false);
      chat.setIsStreaming(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || chat.isLoading) return;

    await ensureLatestVersionBeforeSend();

    const messageContent = input.trim();

    // Reset version captured flag for this new message
    versionCapturedInSessionRef.current = false;

    if (!hasHandledInitialPrompt) {
      // For empty conversations, use initial prompt handler which includes template selection/cloning
      await handleInitialPrompt(messageContent, conversationId || undefined);
      setHasHandledInitialPrompt(true);
    } else {
      await handleSend(messageContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInterrupt = () => {
    chat.interruptGeneration();
  };

  const handleRevert = async (messageId: string) => {
    if (!isMountedRef.current) return;

    try {
      // Only allow revert on user messages
      const targetMessage = chat.messages.find(
        (m: Message) => m.id === messageId,
      );
      if (!targetMessage || targetMessage.role !== "user") {
        return;
      }

      // Call backend API to revert
      if (conversationId) {
        try {
          const response = await fetch("/api/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "revert",
              conversationId: conversationId,
              messageId: messageId,
              messageContent: targetMessage.content,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Failed to revert messages in database:", errorText);
            return;
          }

          const result = await response.json();

          if (result.success && result.messages) {
            // Update frontend with the updated messages from backend
            const uiMessages = convertToUIMessages(result.messages);
            chat.setMessages(uiMessages);

            // Reset WebContainer project directory first
            await resetProjectDirectory("/home/project");

            // ✅ Use artifact data from backend if available (more reliable)
            if (result.artifacts && result.artifacts.fileContents) {
              await reconstructFilesFromArtifacts(
                result.artifacts,
                files,
                saveFile,
                runLinear,
              );
            } else {
              // Fallback to message-based reconstruction
              await reconstructFilesFromMessages(
                uiMessages,
                files,
                saveFile,
                runLinear,
              );
            }

            // Reset file indicators
            if ((chat as any).resetFileIndicators) {
              (chat as any).resetFileIndicators();
            }

            // Clear any existing preview URLs
            setPreviewUrl(null);

            // Clear terminal
            const { clearTerminal } = useWorkspaceStore.getState() as any;
            clearTerminal();
          } else {
            console.error("Backend revert failed:", result);
          }
        } catch (error) {
          console.error("Error reverting messages:", error);
        }
      } else {
        console.error("No conversationId available for revert");
      }
    } catch (err) {
      console.error("Revert failed", err);
    }
  };

  useWorkspaceInit({
    urlConversationId,
    initialPrompt,
    displayMessage,
    isSystemPrompt,
    model,
    importedFiles,
    setSelectedModel,
    setConversationId,
    setConversationTitle,
    setHasHandledInitialPrompt,
    setInput,
    handleTemplateFiles,
    handleInitialPrompt,
    createConversation,
    loadConversation,
    updateConversationUrl,
    convertToUIMessages,
    chat,
    handleStreamingResponseWrapper: stream,
    searchParams,
    location,
    selectedModel,
    files,
    saveFile,
    runLinear,
    designScheme,
    beforeInitialPrompt: async (cid: string) => {
      // DON'T restore files here for conversations coming from home route
      // The files are already in the database attached to the user message
      // Sending them again would create duplicates
      // Only restore from IndexedDB if this is a truly new conversation
      // that hasn't been saved to DB yet (shouldn't happen in normal flow)
    },
  });

  useExposeFiles(files.templateFilesState);

  useEffect(() => {
    if (
      !versionsHydrated ||
      versions.length > 0 ||
      chat.isStreaming ||
      chat.isLoading ||
      isProcessingTemplate ||
      chat.messages.length === 0 ||
      files.templateFilesState.length === 0
    ) {
      return;
    }

    void captureVersionSnapshot();
  }, [
    versionsHydrated,
    versions.length,
    chat.isStreaming,
    chat.isLoading,
    isProcessingTemplate,
    chat.messages.length,
    files.templateFilesState.length,
    captureVersionSnapshot,
  ]);

  const versionOptions = useMemo(
    () =>
      versions.map((version, index, array) => ({
        id: version.id,
        label: index === array.length - 1 ? "Latest" : version.label,
      })),
    [versions],
  );

  const canCreateVersion =
    versionsHydrated &&
    !!conversationId &&
    !isRestoringVersion &&
    !isSavingVersion &&
    !chat.isStreaming &&
    !chat.isLoading &&
    files.templateFilesState.length > 0;
  const canRestoreVersion = canCreateVersion && !isOnLatestVersion;

  const handleRestoreCurrentVersion = useCallback(async () => {
    if (!canRestoreVersion || !currentVersionId) {
      return;
    }

    const sourceVersion = versions.find(
      (version) => version.id === currentVersionId,
    );
    const restoredLabel = sourceVersion
      ? `Restored - ${sourceVersion.label}`
      : "Restored version";

    await captureVersionSnapshot(restoredLabel);
  }, [canRestoreVersion, currentVersionId, versions, captureVersionSnapshot]);

  // Revert to a specific version - restores files, creates a new version, and syncs to R2
  const handleRevertToVersion = useCallback(
    async (versionId: string) => {
      if (
        !versionId ||
        isRestoringVersion ||
        !versionsHydrated ||
        !conversationId
      )
        return;

      const targetVersion = versions.find((v) => v.id === versionId);
      if (!targetVersion) return;

      setIsRestoringVersion(true);
      try {
        // First, restore the files from the target version
        await resetProjectDirectory("/home/project");

        for (const file of targetVersion.files) {
          await saveFile(file.path, file.content);
        }

        const clonedFiles = cloneTemplateFiles(targetVersion.files);
        files.setTemplateFilesState(clonedFiles);
        latestFilesRef.current = clonedFiles;
        files.setFilesMap(buildFilesMapFromSnapshot(clonedFiles));
        const nextSelectedPath =
          targetVersion.selectedPath ?? clonedFiles[0]?.path ?? "";
        files.setSelectedPath(nextSelectedPath);
        latestSelectedPathRef.current = nextSelectedPath;

        chat.setIsLoading(false);
        chat.setIsStreaming(false);
        if ((chat as any).resetFileIndicators) {
          (chat as any).resetFileIndicators();
        }

        const nextPreview = targetVersion.previewUrl ?? null;
        setPreviewUrl(nextPreview);
        latestPreviewRef.current = nextPreview;

        const { clearTerminal } = useWorkspaceStore.getState() as any;
        clearTerminal();

        // Now create a new version with these files (making it the latest)
        const revertedLabel = `Reverted to ${targetVersion.label}`;
        const savedVersion = await createVersion({
          label: revertedLabel,
          files: clonedFiles,
          previewUrl: nextPreview,
          selectedPath: nextSelectedPath,
          anchorMessageId: targetVersion.anchorMessageId,
        });

        if (savedVersion?.id) {
          setCurrentVersionId(savedVersion.id);
        }

        // Sync reverted files to R2 so they persist when reopening the conversation
        const filesToSync = clonedFiles
          .filter((f) => f.content && f.content.trim().length > 0)
          .map((f) => ({
            path: f.path,
            content: f.content,
          }));

        if (filesToSync.length > 0) {
          const { setIsSyncingToR2 } = useWorkspaceStore.getState();
          try {
            setIsSyncingToR2(true);

            // Use client-side upload with pre-signed URLs
            const { uploadFilesToR2WithPresignedUrls } =
              await import("../lib/r2UploadClient");

            const uploadResult = await uploadFilesToR2WithPresignedUrls(
              conversationId,
              undefined, // No chatId for revert
              filesToSync,
            );

            if (!uploadResult.success) {
              console.warn(
                "[Revert] Some files failed to sync to R2:",
                uploadResult.failedFiles,
              );
            }
          } catch (syncError) {
            console.error("[Revert] Error syncing files to R2:", syncError);
          } finally {
            setIsSyncingToR2(false);
          }

          // Also save IndexedDB snapshot for fast restore
          try {
            const snapshot = filesToSnapshot(filesToSync);
            await saveSnapshot(conversationId, snapshot);
          } catch (snapshotError) {
            console.error(
              "[Revert] Error saving IndexedDB snapshot:",
              snapshotError,
            );
          }
        }
      } catch (error) {
        console.error("Failed to revert to version:", error);
      } finally {
        setIsRestoringVersion(false);
      }
    },
    [
      versions,
      isRestoringVersion,
      versionsHydrated,
      conversationId,
      resetProjectDirectory,
      saveFile,
      files,
      chat,
      setPreviewUrl,
      createVersion,
    ],
  );

  const handleReturnToLatestVersion = useCallback(() => {
    if (isOnLatestVersion || !latestVersionIdInList) {
      return;
    }
    void handleVersionSelect(latestVersionIdInList);
  }, [isOnLatestVersion, latestVersionIdInList, handleVersionSelect]);

  // Memoize saveFile to prevent recreation
  const memoizedSaveFile = useCallback(
    (path: string, content: string) => {
      files.updateFileContent(path, content);
      return saveFile(path, content);
    },
    [files.updateFileContent, saveFile],
  );

  // Memoize terminal state to prevent unnecessary re-renders
  const terminalLines = useWorkspaceStore((s) => s.terminalLines);
  const isTerminalRunning = useWorkspaceStore((s) => s.isTerminalRunning);

  // Memoize tool execution status to prevent re-renders
  const toolExecutionStatuses = useMemo(
    () => toolExecution.getAllStatuses(),
    [toolExecution.getAllStatuses],
  );

  const availableTools = useMemo(
    () => toolExecution.getAvailableTools(),
    [toolExecution.getAvailableTools],
  );

  const hasToolSupport = useMemo(
    () => toolExecution.hasToolSupport(),
    [toolExecution.hasToolSupport],
  );

  // Memoize the preview URL to prevent unnecessary re-renders
  const resolvedPreviewUrl = useMemo(
    () => livePreviewUrl || previewUrl,
    [livePreviewUrl, previewUrl],
  );

  return {
    // ui state
    selectedModel,
    setSelectedModel,
    activeTab,
    setActiveTab,
    input,
    setInput,
    isProcessingTemplate,
    previewUrl: resolvedPreviewUrl,
    terminalLines,
    isTerminalRunning,

    // chat state
    messages: chat.messages,
    chatIsLoading: chat.isLoading,
    chatIsStreaming: chat.isStreaming,
    chatError: chat.error,
    currentToolCalls: chat.currentToolCalls || [],
    streamingSegments: chat.streamingSegments || [],
    // Expose setters for safety timeout reset
    chat: {
      setIsLoading: chat.setIsLoading,
      setIsStreaming: chat.setIsStreaming,
      setError: chat.setError,
      addMessage: chat.addMessage,
    },

    // files state
    templateFilesState: files.templateFilesState,
    selectedPath: files.selectedPath,
    setSelectedPath: files.setSelectedPath,
    saveFile: memoizedSaveFile,

    // conversation state
    conversationId,
    conversationTitle,

    // versioning
    versionOptions,
    versions, // Full version objects with files for deployment
    currentVersionId,
    handleVersionSelect,
    isRestoringVersion,
    handleManualVersionCreate,
    canCreateVersion,
    handleRestoreCurrentVersion,
    handleRevertToVersion,
    handleReturnToLatestVersion,
    canRestoreVersion,
    isOnLatestVersion,

    // handlers
    handleSubmit,
    handleKeyDown,
    handleRevert,
    handleInterrupt,

    // file upload state
    uploadedFiles,
    setUploadedFiles,

    // tool execution state
    toolExecutionStatuses,
    isExecutingTools: toolExecution.isExecuting,
    availableTools,
    hasToolSupport,
  };
}
