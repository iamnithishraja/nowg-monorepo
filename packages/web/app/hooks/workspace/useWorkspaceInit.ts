import { useEffect, useRef } from "react";
import { OPENROUTER_MODELS } from "../../consts/models";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore";
import type { Message } from "../../types/chat";
import { createClientFileStorageService } from "../../lib/clientFileStorage";
import { WORK_DIR } from "../../utils/constants";
import {
  loadSnapshot,
  saveSnapshot,
  filesToSnapshot,
  snapshotToFiles,
} from "../../lib/chatPersistence";
import {
  detectProjectCommands,
  createCommandActionsString,
} from "../../utils/projectCommands";
import { parseAndExecuteActions } from "../../utils/actionParser";
import {
  getWebContainer,
  runShellCommand,
  killAllProcesses,
  getPreviewUrl,
} from "../../lib/webcontainer";
import {
  hasNodeModulesInContainer,
  hasNodeModulesSnapshotByHash,
  loadNodeModulesSnapshotByHash,
  restoreNodeModulesToContainer,
} from "../../lib/nodeModulesCache";
import {
  BASE_TEMPLATE_CACHE_KEY,
  isPreloadInProgress,
  waitForPreloadComplete,
} from "../../lib/nodeModulesPreloader";

// Module-level variable to track conversation across component mounts/unmounts
// This persists even when navigating away and back
let lastActiveConversationId: string | null = null;

interface InitDeps {
  urlConversationId: string | null;
  initialPrompt?: string;
  displayMessage?: string; // User-friendly message to show in chat for system prompts
  isSystemPrompt?: boolean; // Flag to indicate this is a system-generated prompt
  model?: string;
  importedFiles?: Array<{ path: string; content: string }>;
  setSelectedModel: (m: string) => void;
  setConversationId: (id: string) => void;
  setConversationTitle: (title: string | null) => void;
  setHasHandledInitialPrompt: (v: boolean) => void;
  setInput: (v: string) => void;
  handleTemplateFiles: (
    files: Array<{ path: string; content: string }>
  ) => Promise<void>;
  handleInitialPrompt: (
    messageContent: string,
    currentConversationId?: string,
    displayMessage?: string
  ) => Promise<void>;
  createConversation: (title: string, model: string) => Promise<string>;
  loadConversation: (id: string, chatId?: string | null) => Promise<any>;
  updateConversationUrl: (
    newConversationId: string,
    searchParams: URLSearchParams,
    location: { pathname: string }
  ) => void;
  convertToUIMessages: (messages: any[]) => any[];
  chat: { setMessages: (u: any) => void; setError: (s: string) => void };
  searchParams: URLSearchParams;
  location: { pathname: string };
  selectedModel: string;
  files: any;
  saveFile: any;
  runLinear: any;
  designScheme?: any;
  beforeInitialPrompt?: (conversationId: string) => Promise<void>;
}

// Function to reconstruct files from artifact data (more reliable than message parsing)
export async function reconstructFilesFromArtifacts(
  artifacts: any,
  files: any,
  saveFile: any,
  runLinear: any
) {
  try {
    if (
      !artifacts.fileContents ||
      Object.keys(artifacts.fileContents).length === 0
    ) {
      return;
    }

    // Convert artifact file contents to workspace format
    const wcFiles = Object.entries(artifacts.fileContents).map(
      ([filePath, content]) => ({
        name: filePath.split("/").pop() || filePath,
        path: files.normalizeFilePath(filePath, true),
        content: content as string,
      })
    );

    // Update UI file state first to prevent layout shift
    files.setTemplateFilesState(wcFiles);

    // Rebuild filesMap with absolute paths
    const newMap: any = {};
    for (const f of wcFiles) {
      const absolutePath = files.normalizeFilePath(f.path, false);
      newMap[absolutePath] = {
        type: "file",
        content: f.content,
        isBinary: false,
      };
    }
    files.setFilesMap(newMap);

    // Add a small delay to let the UI update before WebContainer operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Write files to WebContainer
    for (const f of wcFiles) {
      await saveFile(f.path, f.content);
    }

    // Initialize WebContainer with files
    if (wcFiles.length > 0) {
      await runLinear(
        wcFiles.map((f) => ({ path: f.path, content: f.content }))
      );
    }

    // Execute shell commands if any
    if (artifacts.shellCommands && artifacts.shellCommands.length > 0) {
      // Get workspace store functions for terminal animation
      const { appendTerminalLine, setIsTerminalRunning } =
        useWorkspaceStore.getState() as any;

      // Import the shell execution function

      for (const command of artifacts.shellCommands) {
        try {
          // Set terminal as running for animation
          setIsTerminalRunning(true);

          // Add command banner to terminal
          appendTerminalLine(`$ ${command}`);

          await runShellCommand(command, (line: string) => {
            // Clean and display output in terminal
            const cleaned = line
              .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
              .replace(/\r/g, "");
            if (cleaned) appendTerminalLine(cleaned);
          });

          // Stop terminal animation
          setIsTerminalRunning(false);

          // Add a small delay between commands
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          setIsTerminalRunning(false);
        }
      }
    }
  } catch (error) {
    console.error("Failed to reconstruct files from artifacts:", error);
    throw error;
  }
}

/**
 * Restore files directly from R2 (primary method)
 * Uses server-side API to fetch all files from R2 storage
 */
export async function restoreFilesFromR2(
  conversationId: string,
  files: any,
  saveFile: any,
  runLinear: any
): Promise<boolean> {
  try {
    // Use the server-side API to fetch all files from R2
    // This is more efficient and secure than doing R2 fetching client-side
    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Include cookies for auth
      body: JSON.stringify({
        action: "getFilesFromR2",
        conversationId,
      }),
    });

    if (!response.ok) {
      console.warn("[R2 Restore] API request failed:", response.status);
      return false;
    }

    const result = await response.json();
    
    if (!result.success) {
      console.warn("[R2 Restore] Failed to fetch files from R2:", result.error);
      return false;
    }

    const fetchedFiles = result.files || [];

    if (fetchedFiles.length === 0) {
      return false;
    }

    // Convert to WebContainer format
    const wcFiles: Array<{ name: string; path: string; content: string }> = [];
    for (const file of fetchedFiles) {
      // Normalize the file path for WebContainer
      const normalizedPath = files.normalizeFilePath(file.path, true);
      wcFiles.push({
        name: file.name || file.path.split("/").pop() || file.path,
        path: normalizedPath,
        content: file.content,
      });
    }

    // Update UI file state
    files.setTemplateFilesState(wcFiles);

    // Rebuild filesMap with absolute paths
    const newMap: any = {};
    for (const f of wcFiles) {
      const absolutePath = files.normalizeFilePath(f.path, false);
      newMap[absolutePath] = {
        type: "file",
        content: f.content,
        isBinary: false,
      };
    }
    files.setFilesMap(newMap);

    // Write files to WebContainer
    for (const f of wcFiles) {
      await saveFile(f.path, f.content);
    }

    // Initialize WebContainer with files
    if (wcFiles.length > 0) {
      await runLinear(
        wcFiles.map((f) => ({ path: f.path, content: f.content }))
      );
    }

    // Run project setup commands
    await runProjectSetupFromFiles(wcFiles);

    // Save snapshot to IndexedDB for fast future restore
    const snapshot = filesToSnapshot(
      wcFiles.map((f) => ({ path: f.path, content: f.content }))
    );
    await saveSnapshot(conversationId, snapshot);

    return true;
  } catch (error) {
    console.error("[R2 Restore] Error restoring files from R2:", error);
    return false;
  }
}

/**
 * Try to restore files from IndexedDB snapshot first (fast path)
 * Falls back to R2 fetch if no snapshot exists
 */
export async function restoreFilesFromSnapshot(
  conversationId: string,
  messages: Message[],
  files: any,
  saveFile: any,
  runLinear: any
): Promise<boolean> {
  try {
    // Try fast path: restore from IndexedDB snapshot
    const snapshot = await loadSnapshot(conversationId);

    if (snapshot && Object.keys(snapshot.files).length > 0) {
      const wcFiles = snapshotToFiles(snapshot.files).map((f) => ({
        name: f.path.split("/").pop() || f.path,
        path: f.path,
        content: f.content,
      }));

      // Update UI file state
      files.setTemplateFilesState(wcFiles);

      // Rebuild filesMap with absolute paths
      const newMap: any = {};
      for (const f of wcFiles) {
        const absolutePath = files.normalizeFilePath(f.path, false);
        newMap[absolutePath] = {
          type: "file",
          content: f.content,
          isBinary: false,
        };
      }
      files.setFilesMap(newMap);

      // Write files to WebContainer
      for (const f of wcFiles) {
        await saveFile(f.path, f.content);
      }

      // Initialize WebContainer with files
      if (wcFiles.length > 0) {
        await runLinear(
          wcFiles.map((f) => ({ path: f.path, content: f.content }))
        );
      }

      // Run project setup commands
      await runProjectSetupFromFiles(wcFiles);

      return true; // Successfully restored from snapshot
    }

    // Snapshot not found - will fall back to R2 in the calling code
    return false;
  } catch (error) {
    console.error("[Snapshot] Error during restore:", error);
    return false;
  }
}

/**
 * Run project setup commands (npm install, dev server) from files
 * Checks node_modules cache first for faster restoration
 */
async function runProjectSetupFromFiles(
  wcFiles: Array<{ path: string; content: string }>
) {
  try {
    const { appendTerminalLine, setIsTerminalRunning } =
      useWorkspaceStore.getState() as any;

    // Find package.json to check for node_modules cache
    const packageJsonFile = wcFiles.find(
      (f) => f.path === "package.json" || f.path.endsWith("/package.json")
    );

    if (packageJsonFile) {
      // Handle npm install with caching in background (same as new conversation flow)
      (async () => {
        try {
          const wc = await getWebContainer();

          if (!wc) {
            return;
          }

          // Check if node_modules already exists in container
          const existsInContainer = await hasNodeModulesInContainer(wc);

          if (existsInContainer) {
            // Just run dev server, skip npm install
            await runDevServer(
              wcFiles,
              appendTerminalLine,
              setIsTerminalRunning
            );
            return;
          }

          // Wait for preload to complete if it's in progress
          // This prevents running npm install while GitHub clone is happening
          if (isPreloadInProgress()) {
            appendTerminalLine("⏳ Waiting for node_modules cache to be ready...");
            await waitForPreloadComplete();
            appendTerminalLine("✅ Cache ready!");
          }

          // Check if we have cached node_modules using BASE_TEMPLATE_CACHE_KEY
          // This key is populated by the preloader on the home page
          let restoredFromCache = false;
          const hasCache = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

          if (hasCache) {
            appendTerminalLine("📦 Restoring node_modules from cache...");

            const cachedFiles = await loadNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

            if (cachedFiles && cachedFiles.length > 0) {
              const restored = await restoreNodeModulesToContainer(
                wc,
                cachedFiles
              );

              if (restored) {
                appendTerminalLine("✅ Restored node_modules from cache!");
                restoredFromCache = true;
              } else {
                appendTerminalLine(
                  "⚠️ Cache incomplete, running npm install..."
                );
              }
            }
          }

          // Always run npm install to pick up any extra dependencies
          // Use --prefer-offline if we restored from cache (faster since most deps are already there)
          const installFlags = restoredFromCache
            ? "--prefer-offline --legacy-peer-deps --no-audit --no-fund"
            : "--legacy-peer-deps --no-audit --no-fund";

          appendTerminalLine(restoredFromCache
              ? "📦 Installing any additional dependencies..."
              : "📦 Installing dependencies...");

          setIsTerminalRunning(true);
          await runShellCommand(
            `npm install ${installFlags}`,
            (line: string) => {
              const cleaned = line
                .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
                .replace(/\r/g, "");
              if (cleaned) appendTerminalLine(cleaned);
            }
          );
          setIsTerminalRunning(false);
          appendTerminalLine("✅ Dependencies installed!");

          // Now run the dev server
          await runDevServer(
wcFiles,
appendTerminalLine,
setIsTerminalRunning
);
        } catch (error) {
          console.error("[ProjectSetup] Error:", error);
        }
      })();
      return; // Don't block - let it run in background
    }
  } catch (error) {
    console.error("[Snapshot] Error running project setup:", error);
  }
}

/**
 * Run just the dev server (when node_modules already exists)
 */
async function runDevServer(
  wcFiles: Array<{ path: string; content: string }>,
  appendTerminalLine: (line: string) => void,
  setIsTerminalRunning: (running: boolean) => void
) {
  try {
    const projectCommands = await detectProjectCommands(wcFiles);

    if (projectCommands.startCommand) {
      setIsTerminalRunning(true);
      appendTerminalLine(`$ ${projectCommands.startCommand}`);

      await runShellCommand(projectCommands.startCommand, (line: string) => {
        const cleaned = line
          .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
          .replace(/\r/g, "");
        if (cleaned) appendTerminalLine(cleaned);
      });

      setIsTerminalRunning(false);
    }
  } catch (error) {
    console.error("[ProjectSetup] Error running dev server:", error);
  }
}

// Function to reconstruct files and shell commands from conversation messages
export async function reconstructFilesFromMessages(
  messages: Message[],
  files: any,
  saveFile: any,
  runLinear: any,
  conversationId?: string
) {
  try {
    // Early return if no messages
    if (!messages || messages.length === 0) {
      return;
    }

    // Extract files from all assistant messages
    const latestFiles = new Map<string, string>();

    for (const message of messages) {
      if (message.role !== "assistant" || typeof message.content !== "string")
        continue;

      const fileActions: Array<{ filePath: string; content: string }> = [];

      // Extract file actions using regex (similar to handleRevert)
      try {
        const fileRegex =
          /<nowgaiAction[^>]*type="file"[^>]*filePath="([^"]+)"[^>]*>([\s\S]*?)<\/nowgaiAction>/gi;
        let match: RegExpExecArray | null;
        while ((match = fileRegex.exec(message.content)) !== null) {
          const filePath = (match[1] || "").trim();
          let content = (match[2] || "").trim();
          // Add trailing newline like parser does for non-md files
          if (!/\.md$/i.test(filePath)) {
            if (!content.endsWith("\n")) content += "\n";
          }
          if (filePath) {
            fileActions.push({ filePath, content });
          }
        }
      } catch (e) {}

      // Add files to the map (last write wins)
      for (const fa of fileActions) {
        const wcPath = files.normalizeFilePath(fa.filePath, true);
        latestFiles.set(wcPath, fa.content);
      }
    }

    if (latestFiles.size === 0) {
      return;
    }

    // Convert to array format
    const wcFiles = Array.from(latestFiles.entries()).map(
      ([path, content]) => ({
        name: path.split("/").pop() || path,
        path,
        content,
      })
    );

    // Update UI file state first to prevent layout shift
    files.setTemplateFilesState(wcFiles);

    // Rebuild filesMap with absolute paths
    const newMap: any = {};
    for (const f of wcFiles) {
      const absolutePath = files.normalizeFilePath(f.path, false);
      newMap[absolutePath] = {
        type: "file",
        content: f.content,
        isBinary: false,
      };
    }
    files.setFilesMap(newMap);

    // Add a small delay to let the UI update before WebContainer operations
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Initialize WebContainer with files
    if (wcFiles.length > 0) {
      await runLinear(
        wcFiles.map((f) => ({ path: f.path, content: f.content }))
      );
    }

    // Detect project commands using bolt.diy's approach (npm install, dev server, etc.)
    const projectCommands = await detectProjectCommands(wcFiles);

    // Create synthetic message with files + commands (bolt.diy approach)
    const commandActionsString = createCommandActionsString(projectCommands);

    if (commandActionsString) {
      // Parse and execute actions from synthetic message
      // Import terminal utilities
      const { appendTerminalLine, setIsTerminalRunning } =
        useWorkspaceStore.getState() as any;

      // Check if we can restore from cache first (before running npm install)
      const wc = await getWebContainer();
      let restoredFromCache = false;
      let nodeModulesExisted = false;

      if (wc) {
        const existsInContainer = await hasNodeModulesInContainer(wc);

        if (!existsInContainer) {
          // Wait for preload to complete if it's in progress
          // This prevents running npm install while GitHub clone is happening
          if (isPreloadInProgress()) {
            appendTerminalLine("⏳ Waiting for node_modules cache to be ready...");
            await waitForPreloadComplete();
            appendTerminalLine("✅ Cache ready!");
          }

          // Check for cached node_modules using BASE_TEMPLATE_CACHE_KEY
          const hasCache = await hasNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

          if (hasCache) {
            appendTerminalLine("📦 Restoring node_modules from cache...");
            const cachedFiles = await loadNodeModulesSnapshotByHash(BASE_TEMPLATE_CACHE_KEY);

            if (cachedFiles && cachedFiles.length > 0) {
              const restored = await restoreNodeModulesToContainer(wc, cachedFiles);
              if (restored) {
                appendTerminalLine("✅ Restored node_modules from cache!");
                restoredFromCache = true;
              }
            }
          }
        } else {
          // node_modules already exists in container
          nodeModulesExisted = true;
        }
      }

      // Create synthetic artifact content
      const syntheticContent = `
<nowgaiArtifact id="restored-project-setup" title="Restored Project & Setup">
${wcFiles
  .map(
    (f) => `<nowgaiAction type="file" filePath="${f.path}">
${f.content}
</nowgaiAction>`
  )
  .join("\n")}
${commandActionsString}
</nowgaiArtifact>
      `.trim();

      await parseAndExecuteActions(syntheticContent, {
        onFileAction: async (action: any) => {
          const wcPath = files.normalizeFilePath(action.filePath, true);
          await saveFile(wcPath, action.content);
        },
        onShellAction: async (action: any) => {
          const command = action.command || action.content?.trim();
          if (!command) return;

          // Check if this is an npm install command
          const isNpmInstall =
            command.includes("npm install") ||
            command.includes("npm i ") ||
            command === "npm i";

          // Modify npm install command based on cache status
          let finalCommand = command;
          if (isNpmInstall) {
            if (restoredFromCache) {
              // Use --prefer-offline since most deps are already restored from cache
              finalCommand = "npm install --prefer-offline --legacy-peer-deps --no-audit --no-fund";
              appendTerminalLine("📦 Installing any additional dependencies...");
            } else if (nodeModulesExisted) {
              // node_modules existed, run quick update
              finalCommand = "npm install --legacy-peer-deps --no-audit --no-fund";
              appendTerminalLine("📦 Updating dependencies...");
            } else {
              appendTerminalLine("📦 Installing dependencies...");
            }
          }

          // Run the command
          setIsTerminalRunning(true);
          appendTerminalLine(`$ ${finalCommand}`);

          await runShellCommand(finalCommand, (line: string) => {
            // Clean and display output in terminal
            const cleaned = line
              .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
              .replace(/\r/g, "");
            if (cleaned) appendTerminalLine(cleaned);
          });

          setIsTerminalRunning(false);

          if (isNpmInstall) {
            appendTerminalLine("✅ Dependencies installed!");
          }

          // Add a small delay between commands
          await new Promise((resolve) => setTimeout(resolve, 1000));
        },
      });
    }

    // Save snapshot to IndexedDB for fast future restore
    if (conversationId && wcFiles.length > 0) {
      const snapshot = filesToSnapshot(
        wcFiles.map((f) => ({ path: f.path, content: f.content }))
      );
      await saveSnapshot(conversationId, snapshot);
    }
  } catch (error) {
    console.error("Failed to reconstruct files from conversation:", error);
    // Don't throw the error to prevent breaking the initialization
  }
}

export function useWorkspaceInit({
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
  searchParams,
  location,
  selectedModel,
  files,
  saveFile,
  runLinear,
  designScheme,
  beforeInitialPrompt,
}: InitDeps) {
  const initialSendRef = useRef(false);
  const isInitializingRef = useRef(false);
  const lastConversationIdRef = useRef<string | null>(null);
  const lastChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initializeWorkspace = async () => {
      // Debug: Log at the very start
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "debug",
          debug: `initializeWorkspace START: urlConversationId=${urlConversationId}, initialPrompt=${!!initialPrompt}, isInitializingRef=${isInitializingRef.current}`,
        }),
      }).catch(() => {});
      
      if (model) setSelectedModel(model || OPENROUTER_MODELS[0].id);

      try {
        // Check if this is the same conversation using module-level variable
        // This persists across component unmounts (e.g., navigating away and back)
        const previousConversationId = lastActiveConversationId;
        const isSameConversation =
          previousConversationId !== null &&
          urlConversationId !== null &&
          previousConversationId === urlConversationId;

        // Get current chatId
        const currentChatId = searchParams?.get("chatId") || null;
        const isChatChange = lastChatIdRef.current !== currentChatId && isSameConversation;

        // Reset initialization flag if conversation changed
        if (previousConversationId !== urlConversationId) {
          isInitializingRef.current = false;
        }

        // Update BOTH the ref (for component-level) and module-level variable
        lastConversationIdRef.current = urlConversationId;
        lastActiveConversationId = urlConversationId;
        lastChatIdRef.current = currentChatId;

        // Prevent multiple initializations for the same conversation (unless chat changed)
        if (isInitializingRef.current && !isChatChange) {
          fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "debug",
              debug: `EARLY RETURN: isInitializingRef=${isInitializingRef.current}, isChatChange=${isChatChange}`,
            }),
          }).catch(() => {});
          return;
        }

        isInitializingRef.current = true;

        // Clear any existing messages to prevent duplicates
        chat.setMessages([]);

        // Only kill processes when switching to a DIFFERENT conversation
        // When switching between chats in the same conversation, preserve WebContainer state and preview
        if (!isSameConversation) {
          // Clear terminal when switching conversations
          const { clearTerminal, setIsTerminalRunning } =
            useWorkspaceStore.getState() as any;
          clearTerminal();
          setIsTerminalRunning(false);

          // Kill all running processes only when switching to different conversation
          try {
            await killAllProcesses();
          } catch (error) {
            // Ignore
          }
        } else if (isChatChange) {
          // When switching between chats in the same conversation, preserve WebContainer state
          // Don't kill processes or clear terminal - keep the preview running
        }

        if (urlConversationId) {
          setConversationId(urlConversationId);

          // First, try to load the existing conversation to get its title and messages
          let conversationData: any = null;
          try {
            const chatId = searchParams?.get("chatId") || null;
            conversationData = await loadConversation(urlConversationId, chatId);
            setSelectedModel(conversationData.conversation?.model || selectedModel);
            setConversationTitle(conversationData.conversation?.title || null);
          } catch (error) {
            // Failed to load existing conversation, will create new one
          }

          // Debug: Log the branch decision
          fetch("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "debug",
              debug: `Branch decision: initialPrompt=${!!initialPrompt}, initialSendRef=${initialSendRef.current}`,
            }),
          }).catch(() => {});

          if (initialPrompt && !initialSendRef.current) {
            initialSendRef.current = true;

            // Check if the conversation already has an AI response (assistant message)
            // If it only has user message, we still need to get AI response
            const hasAssistantMessage =
              conversationData &&
              conversationData.messages &&
              conversationData.messages.some(
                (m: any) => m.role === "assistant"
              );

            if (hasAssistantMessage) {
              // Conversation already has AI response, just load it
              const uiMessages = convertToUIMessages(conversationData.messages);
              chat.setMessages(uiMessages);
              setHasHandledInitialPrompt(true);

              // Clean up uploaded files from IndexedDB since they're already in database
              try {
                const fileStorageService = createClientFileStorageService();
                await fileStorageService.deleteFilesForConversation(
                  urlConversationId
                );
              } catch (error) {
                console.error("Error cleaning up IndexedDB files:", error);
              }
              
              // IMPORTANT: Also restore files when reloading a conversation that was initially created with initialPrompt
              // This ensures files appear in the file tree on page reload
              if (uiMessages && uiMessages.length > 0) {
                try {
                  const { setIsReconstructingFiles } = useWorkspaceStore.getState() as any;
                  setIsReconstructingFiles(true);
                  
                  // Try R2 restore first - it has the authoritative latest state
                  const r2Restored = await restoreFilesFromR2(
                    urlConversationId,
                    files,
                    saveFile,
                    runLinear
                  );
                  
                  if (!r2Restored) {
                    // Fall back to snapshot
                    const snapshotRestored = await restoreFilesFromSnapshot(
                      urlConversationId,
                      uiMessages,
                      files,
                      saveFile,
                      runLinear
                    );
                    
                    if (!snapshotRestored) {
                      // Fall back to message reconstruction
                      await reconstructFilesFromMessages(
                        uiMessages,
                        files,
                        saveFile,
                        runLinear,
                        urlConversationId
                      );
                    }
                  }
                  
                  setIsReconstructingFiles(false);
                } catch (restoreError) {
                  console.error("[File Restore] Error restoring files:", restoreError);
                  const { setIsReconstructingFiles } = useWorkspaceStore.getState() as any;
                  setIsReconstructingFiles(false);
                }
              }
            } else {
              // No AI response yet, send the initial prompt to get AI response
              setHasHandledInitialPrompt(false);

              if (model) setSelectedModel(model);
              if (!importedFiles || importedFiles.length === 0)
                setInput(initialPrompt);
              if (importedFiles && importedFiles.length > 0)
                await handleTemplateFiles(importedFiles);

              // DON'T restore files from database or send them again
              // The user message with files already exists in DB from home route
              // We just need to send the prompt to get the AI response
              // The server will already have access to the files from the existing message

              // Load and display the existing messages with files in the UI
              if (
                conversationData &&
                conversationData.messages &&
                conversationData.messages.length > 0
              ) {
                const uiMessages = convertToUIMessages(
                  conversationData.messages
                );
                chat.setMessages(uiMessages);
              }

              if (beforeInitialPrompt) {
                try {
                  await beforeInitialPrompt(urlConversationId);
                } catch (e) {}
              }
              await handleInitialPrompt(
                initialPrompt,
                urlConversationId,
                isSystemPrompt ? displayMessage : undefined
              );
              setHasHandledInitialPrompt(true);
            }
          } else if (!initialPrompt) {
            try {
              // Get chatId from searchParams if available
              const chatId = searchParams?.get("chatId") || null;
              const data = await loadConversation(urlConversationId, chatId);
              setSelectedModel(data.conversation?.model || selectedModel);
              setConversationTitle(data.conversation?.title || null);
              
              // Ensure messages is always an array - empty chats should show empty, not conversation messages
              const messages = Array.isArray(data.messages) ? data.messages : [];
              const uiMessages = convertToUIMessages(messages);
              
              // Always set messages, even if empty (this ensures empty chats show empty, not cached messages)
              chat.setMessages(uiMessages);

              // Debug: log which branch we're taking
              fetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  action: "debug",
                  debug: `Branch check: chatId=${chatId || 'null'}, messages.length=${messages?.length || 0}`,
                }),
              }).catch(() => {});

              // If viewing a chat (chatId is present)
              if (chatId) {
                // Check if we need to restore files for this chat
                // IMPORTANT: When switching chats within the same conversation, DON'T restore files
                // The WebContainer already has the files and dev server running
                // Only restore files when:
                // 1. Direct navigation to chat URL (fresh page load) - !isSameConversation && !hasActivePreview
                // 2. WebContainer is empty (no active preview) AND it's a different conversation
                const hasActivePreview = !!getPreviewUrl();
                const shouldRestoreFiles = !isSameConversation && !hasActivePreview;
                
                if (shouldRestoreFiles) {
                  // Direct navigation to chat URL (fresh page load) - restore files from main conversation so tools can work
                  // Prefer R2 restore first (has latest files from all chats), then snapshot, then message reconstruction
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  try {
                    const { setIsReconstructingFiles } = useWorkspaceStore.getState() as any;
                    setIsReconstructingFiles(true);

                    // Try R2 restore first - it has the authoritative latest state from all chats
                    const r2Restored = await restoreFilesFromR2(
                      urlConversationId,
                      files,
                      saveFile,
                      runLinear
                    );

                    if (!r2Restored) {
                      // If R2 restore failed, try snapshot (fast fallback)
                      const snapshotRestored = await restoreFilesFromSnapshot(
                        urlConversationId,
                        [],
                        files,
                        saveFile,
                        runLinear
                      );

                      if (!snapshotRestored) {
                        // If snapshot also failed, fall back to message reconstruction (legacy)
                        // Get all messages from main conversation for reconstruction
                        const mainData = await loadConversation(urlConversationId, null);
                        const mainMessages = convertToUIMessages(mainData.messages || []);
                        await reconstructFilesFromMessages(
                          mainMessages,
                          files,
                          saveFile,
                          runLinear,
                          urlConversationId
                        );
                      }
                    }

                    setIsReconstructingFiles(false);
                  } catch (restoreError) {
                    console.error("[R2 Restore] Error restoring files for chat:", restoreError);
                    const { setIsReconstructingFiles } = useWorkspaceStore.getState() as any;
                    setIsReconstructingFiles(false);
                  }
                } else {
                  // Switching between chats in the same conversation OR WebContainer already has files
                  // Preserve WebContainer state and preview - don't restore files
                  console.log("[useWorkspaceInit] Skipping file restoration for chat - preserving WebContainer state");
                }
                setHasHandledInitialPrompt(true);
              } else {
                // Only restore files for main conversation (not chats)
                // Skip file restoration if returning to same conversation with WebContainer still running
                // This keeps the dev server alive and avoids re-running npm install

                const hasActivePreview = !!getPreviewUrl();
                
                // Also log to server for debugging
                fetch("/api/conversations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    action: "debug",
                    debug: `Main conv branch: isSameConversation=${isSameConversation}, hasActivePreview=${hasActivePreview}, uiMessages=${uiMessages?.length || 0}`,
                  }),
                }).catch(() => {});

                if (isSameConversation && hasActivePreview) {
                  // Just restore UI state from the files we already have
                  // The WebContainer still has all the files and dev server running
                  console.log("[useWorkspaceInit] Skipping restoration - same conversation with active preview");
                } else if (uiMessages && uiMessages.length > 0) {
                  // Restore files - prefer R2 restore first (has latest files from all chats),
                  // then snapshot (fast fallback), then message reconstruction (legacy)
                  // Add a small delay to prevent layout shift
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  try {
                    // Set loading state to prevent layout shift
                    const { setIsReconstructingFiles } =
                      useWorkspaceStore.getState() as any;
                    setIsReconstructingFiles(true);

                    // Try R2 restore first - it has the authoritative latest state from all chats
                    // This ensures files modified in chats are reflected in main conversation
                    console.log("[File Restore] Trying R2 restore first (has latest files from all chats)...");
                    const r2Restored = await restoreFilesFromR2(
                      urlConversationId,
                      files,
                      saveFile,
                      runLinear
                    );

                    // If R2 restore failed, try snapshot (fast fallback)
                    if (!r2Restored) {
                      console.log("[File Restore] R2 restore failed, trying snapshot...");
                      const snapshotRestored = await restoreFilesFromSnapshot(
                        urlConversationId,
                        uiMessages,
                        files,
                        saveFile,
                        runLinear
                      );

                      // If snapshot also failed, fall back to message reconstruction (legacy)
                      if (!snapshotRestored) {
                        await reconstructFilesFromMessages(
                          uiMessages,
                          files,
                          saveFile,
                          runLinear,
                          urlConversationId
                        );
                      }
                    }

                    setIsReconstructingFiles(false);
                  } catch (reconstructError) {
                    console.error(
                      "Failed to restore files:",
                      reconstructError
                    );
                    const { setIsReconstructingFiles } =
                      useWorkspaceStore.getState() as any;
                    setIsReconstructingFiles(false);
                    // Don't fail the entire conversation load if file restoration fails
                  }
                }

                // If conversation has no messages, allow initial prompt handler to run
                if (uiMessages && uiMessages.length === 0) {
                  setHasHandledInitialPrompt(false);
                } else {
                  setHasHandledInitialPrompt(true);
                }
              }
            } catch (loadError) {
              console.error("Failed to load conversation:", loadError);
              setHasHandledInitialPrompt(false);
            }
          } else {
            setHasHandledInitialPrompt(false);
          }
        } else {
          const newConversationId = await createConversation(
            initialPrompt || "New Chat",
            model || selectedModel || OPENROUTER_MODELS[0].id
          );
          setConversationId(newConversationId);
          updateConversationUrl(newConversationId, searchParams, location);
          setHasHandledInitialPrompt(false);

          // Load the conversation to get the generated title
          try {
            const data = await loadConversation(newConversationId);
            setConversationTitle(data.conversation.title);
          } catch (error) {
            console.error("Failed to load new conversation title:", error);
          }

          if (initialPrompt && !initialSendRef.current) {
            initialSendRef.current = true;
            if (importedFiles && importedFiles.length > 0)
              await handleTemplateFiles(importedFiles);
            if (beforeInitialPrompt) {
              try {
                await beforeInitialPrompt(newConversationId);
              } catch (e) {}
            }
            await handleInitialPrompt(
              initialPrompt,
              newConversationId,
              isSystemPrompt ? displayMessage : undefined
            );
            setHasHandledInitialPrompt(true);
          }
        }
      } catch (error) {
        console.error("Failed to initialize workspace:", error);
        console.error("Error details:", {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          urlConversationId,
          initialPrompt: !!initialPrompt,
        });
        chat.setError(
          `Failed to initialize workspace: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeWorkspace();
  }, [urlConversationId, initialPrompt, searchParams?.get("chatId")]);

  // Separate effect to reload messages when chatId changes (but conversation stays the same)
  useEffect(() => {
    // Only reload if conversationId exists and we're not handling initial prompt
    if (!urlConversationId || initialPrompt) return;
    
    const chatId = searchParams?.get("chatId") || null;
    
    // Skip if this is the initial load (handled by main effect)
    // Only reload if chatId actually changed
    if (lastChatIdRef.current === chatId) return;
    
    const reloadChatMessages = async () => {
      try {
        console.log(`[useWorkspaceInit] Reloading chat messages - chatId: ${chatId}`);
        
        // Clear messages first to prevent showing old messages
        chat.setMessages([]);
        
        const data = await loadConversation(urlConversationId, chatId);
        
        console.log(`[useWorkspaceInit] Loaded data - messages count: ${data.messages?.length || 0}`);
        
        // Ensure messages is always an array - empty chats should show empty
        const messages = Array.isArray(data.messages) ? data.messages : [];
        
        // Debug log raw messages before conversion
        messages.forEach((msg: any, idx: number) => {
          console.log(`[useWorkspaceInit] Raw message ${idx} - id: ${msg.id}, role: ${msg.role}, toolCalls: ${msg.toolCalls?.length || 0}`);
        });
        
        const uiMessages = convertToUIMessages(messages);
        
        console.log(`[useWorkspaceInit] Converted UI messages count: ${uiMessages.length}`);
        
        // Debug log UI messages
        uiMessages.forEach((msg: any, idx: number) => {
          console.log(`[useWorkspaceInit] UI message ${idx} - id: ${msg.id}, role: ${msg.role}, toolCalls: ${msg.toolCalls?.length || 0}`);
        });
        
        // Always set messages, even if empty (this ensures empty chats show empty)
        chat.setMessages(uiMessages);
        
        // When switching chats, don't restore files - chats are conversation-only
        // The main conversation files remain in WebContainer
        
        // Update the ref to track current chatId
        lastChatIdRef.current = chatId;
      } catch (error) {
        console.error("Failed to reload chat messages:", error);
      }
    };

    reloadChatMessages();
  }, [searchParams?.get("chatId"), urlConversationId, initialPrompt, loadConversation, convertToUIMessages, chat]); // Watch chatId changes

  return null;
}
