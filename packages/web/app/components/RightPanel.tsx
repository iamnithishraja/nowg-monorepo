import {
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CaretUp,
  File,
  Plus,
  Terminal as TerminalIcon,
  X
} from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { downloadCodebaseAsZip, getProjectName } from "../lib/downloadCodebase";
import { attachInteractiveShell } from "../lib/webcontainer";
import CodeEditor from "./CodeEditor";
import FileSearchPane from "./FileSearchPane";
import FileTree from "./FileTree";
import PreviewPanel from "./Preview";
import { Terminal, type TerminalRef } from "./Terminal";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";
import { Button } from "./ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

type TabType = "files" | "preview";

interface FileItem {
  name: string;
  path: string;
  content: string;
}

interface RightPanelProps {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  templateFilesState: FileItem[];
  selectedPath: string;
  setSelectedPath: (p: string) => void;
  saveFile: (path: string, content: string) => void;
  previewUrl: string | null | undefined;
  terminalLines?: string[];
  isTerminalRunning?: boolean;
  isLoading?: boolean;
  conversationTitle?: string;
  conversationId?: string;
  onElementSelected?: (info: any) => void;
  onInspectorEnable?: () => void;
}

function RightPanelComponent({
  activeTab,
  setActiveTab,
  templateFilesState,
  selectedPath,
  setSelectedPath,
  saveFile,
  previewUrl,
  terminalLines = [],
  isTerminalRunning = false,
  isLoading = false,
  conversationTitle,
  conversationId,
  onElementSelected,
  onInspectorEnable,
}: RightPanelProps) {
  const [leftPane, setLeftPane] = useState<"files" | "search">("files");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const editorRef = useRef<import("./CodeEditor").CodeEditorHandle>(null);

  // Multiple terminals support
  const [activeTerminalId, setActiveTerminalId] = useState(0);
  const [terminalCount, setTerminalCount] = useState(1);
  const terminalRefs = useRef<Map<number, TerminalRef>>(new Map());
  const lastLineIndexRefs = useRef<Map<number, number>>(new Map());
  const terminalCleanups = useRef<Map<number, () => void>>(new Map());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setLeftPane("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Write terminal lines to XTerm in real-time (to active terminal)
  useEffect(() => {
    const lastLineIndex = lastLineIndexRefs.current.get(activeTerminalId) || 0;

    if (terminalLines.length > lastLineIndex) {
      // Get only new lines
      const newLines = terminalLines.slice(lastLineIndex);
      const terminalRef = terminalRefs.current.get(activeTerminalId);

      newLines.forEach((line) => {
        try {
          const terminal = terminalRef?.getTerminal();
          if (terminal) {
            terminal.write(line + "\r\n");
          }
        } catch (e) {
          console.error("Terminal write error:", e);
        }
      });
      lastLineIndexRefs.current.set(activeTerminalId, terminalLines.length);
    } else if (terminalLines.length === 0) {
      // Terminal was cleared
      lastLineIndexRefs.current.set(activeTerminalId, 0);
    }
  }, [terminalLines, activeTerminalId]);

  const addTerminal = () => {
    if (terminalCount < 3) {
      // Max 3 terminals
      setTerminalCount(terminalCount + 1);
      setActiveTerminalId(terminalCount);
    }
  };

  const closeTerminal = useCallback((id: number) => {
    if (id === 0) return; // Can't close first terminal

    // Cleanup shell connection
    const cleanup = terminalCleanups.current.get(id);
    if (cleanup) {
      cleanup();
      terminalCleanups.current.delete(id);
    }

    terminalRefs.current.delete(id);
    lastLineIndexRefs.current.delete(id);
    setTerminalCount((prev) => prev - 1);

    setActiveTerminalId((currentActive) => {
      if (currentActive === id) {
        return Math.max(0, id - 1);
      } else if (currentActive > id) {
        return currentActive - 1;
      }
      return currentActive;
    });
  }, []);

  const handleDownloadCodebase = useCallback(async () => {
    if (templateFilesState.length === 0) {
      alert("No files to download. Create some files first!");
      return;
    }

    try {
      setIsDownloading(true);
      const projectName = getProjectName(conversationTitle);
      await downloadCodebaseAsZip(templateFilesState, projectName);
    } catch (error) {
      console.error("Download failed:", error);
      alert(
        error instanceof Error ? error.message : "Failed to download codebase"
      );
    } finally {
      setIsDownloading(false);
    }
  }, [templateFilesState, conversationTitle]);

  return (
    <div className="h-full min-h-0 max-h-full flex flex-col border">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className="h-full min-h-0 max-h-full flex flex-col transition-all duration-200 ease-out"
      >
        {/* Content Area - Takes full height (controls are in main header) */}
        <div className="flex-1 h-full min-h-0 max-h-full overflow-hidden rounded-lg">
          <TabsContent
            value="files"
            className="h-full m-0 min-h-0 max-h-full flex flex-col rounded-lg overflow-hidden"
          >
            {/* Main Content Area with Resizable Panels */}
            <ResizablePanelGroup direction="vertical" className="flex-1">
              {/* File Tree and Editor */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <ResizablePanelGroup direction="horizontal">
                  {/* File Explorer */}
                  <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
                    <div className="bg-surface-1 border-r border-border/30 h-full flex flex-col">
                      {/* Left Pane Header Tabs */}
                      <div className="px-3 py-2 border-b border-border/30 shrink-0">
                        <Tabs
                          value={leftPane}
                          onValueChange={(v) =>
                            setLeftPane(v as "files" | "search")
                          }
                        >
                          <TabsList className="bg-surface-2/50 h-8 rounded-lg border border-border/30 p-0.5 gap-1">
                            <TabsTrigger
                              value="files"
                              className="px-3 py-1 text-xs rounded-md data-[state=active]:bg-surface-3 data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <File className="w-3.5 h-3.5" />
                                Files
                              </span>
                            </TabsTrigger>
                            <TabsTrigger
                              value="search"
                              className="px-3 py-1 text-xs rounded-md data-[state=active]:bg-surface-3 data-[state=active]:text-foreground text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5">
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
                                Search
                              </span>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      {/* Left Pane Content */}
                      <div className="flex-1 min-h-0 overflow-auto">
                        <Tabs
                          value={leftPane}
                          onValueChange={(v) =>
                            setLeftPane(v as "files" | "search")
                          }
                          className="h-full flex flex-col"
                        >
                          <TabsContent
                            value="files"
                            className="m-0 h-full flex flex-col"
                          >
                            <div className="flex-1 min-h-0 overflow-auto">
                              <FileTree
                                files={templateFilesState}
                                selectedPath={selectedPath}
                                onSelect={setSelectedPath}
                                hideHeader
                              />
                            </div>
                            <div className="p-3 text-[11px] text-muted-foreground/60 border-t border-border/30 shrink-0">
                              Tip: Press{" "}
                              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 text-foreground/80">
                                Ctrl/Cmd+K
                              </kbd>{" "}
                              to search files
                            </div>
                          </TabsContent>
                          <TabsContent
                            value="search"
                            className="m-0 h-full flex flex-col"
                          >
                            <div className="flex-1 min-h-0 overflow-auto">
                              <FileSearchPane
                                files={templateFilesState}
                                onSelect={(path) => {
                                  setSelectedPath(path);
                                  setLeftPane("files");
                                }}
                                onClose={() => setLeftPane("files")}
                                hideHeader
                              />
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>
                  </ResizablePanel>

                  <ResizableHandle className="w-[1px] bg-border/30 hover:bg-primary/50 transition-colors" />

                  {/* Code Editor */}
                  <ResizablePanel defaultSize={75}>
                    <div className="flex flex-col h-full">
                      {/* Editor Header - Fixed height */}
                      <div className="h-12 bg-surface-1 border-b border-border/30 flex items-center px-4 shrink-0">
                        {selectedPath ? (
                          <Breadcrumb>
                            <BreadcrumbList>
                              <BreadcrumbItem>
                                <BreadcrumbPage className="text-muted-foreground/60 text-sm">
                                  src
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                              <BreadcrumbSeparator>
                                <CaretRight className="w-4 h-4 text-muted-foreground/40" />
                              </BreadcrumbSeparator>
                              <BreadcrumbItem>
                                <BreadcrumbPage className="text-foreground text-sm flex items-center gap-2">
                                  <File className="w-4 h-4 text-muted-foreground" />
                                  {selectedPath.split("/").pop()}
                                </BreadcrumbPage>
                              </BreadcrumbItem>
                            </BreadcrumbList>
                          </Breadcrumb>
                        ) : (
                          <div className="text-muted-foreground/60 text-sm">
                            No file selected
                          </div>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border/30 bg-surface-2/50 hover:bg-surface-3 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => editorRef.current?.openSearch()}
                            title="Search in file (Ctrl/Cmd+F)"
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
                            Search
                          </button>
                        </div>
                      </div>

                      {/* Editor Content - Takes remaining height with scroll */}
                      <div className="flex-1 bg-background overflow-auto min-w-0">
                        <div className="h-full w-full overflow-auto">
                          <CodeEditor
                            ref={editorRef}
                            filePath={selectedPath}
                            files={templateFilesState}
                            onChangeContent={(path, content) => {
                              saveFile(path, content);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>

              {/* Terminal - Collapsible */}
              {!isTerminalCollapsed && (
                <>
                  <ResizableHandle className="h-[1px] bg-border/30 hover:bg-primary/50 transition-colors" />
                  <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                    <div className="border-t border-border/30 flex flex-col h-full bg-surface-1">
                      {/* Terminal Header - Tabs */}
                      <div className="h-10 bg-surface-2/50 border-b border-border/30 flex items-center px-3 flex-shrink-0 gap-2">
                        {/* Terminal Tabs */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: terminalCount }, (_, index) => {
                            const isActive = activeTerminalId === index;
                            return (
                              <button
                                key={index}
                                onClick={() => setActiveTerminalId(index)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                                  isActive
                                    ? "bg-surface-3 text-foreground"
                                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                                }`}
                              >
                                <TerminalIcon className="w-3.5 h-3.5" />
                                <span className="font-medium">
                                  {index === 0
                                    ? "Terminal"
                                    : `Terminal ${index + 1}`}
                                </span>
                                {isTerminalRunning && isActive && (
                                  <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                                )}
                                {index > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      closeTerminal(index);
                                    }}
                                    className="ml-0.5 hover:text-foreground"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </button>
                            );
                          })}

                          {/* Add Terminal Button */}
                          {terminalCount < 3 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={addTerminal}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Add Terminal</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="ml-auto flex items-center gap-1">
                          {/* Collapse Terminal Button */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => setIsTerminalCollapsed(true)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                >
                                  <CaretDown className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Collapse Terminal</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => {
                                    const terminalRef =
                                      terminalRefs.current.get(
                                        activeTerminalId
                                      );
                                    terminalRef?.clear();
                                    lastLineIndexRefs.current.set(
                                      activeTerminalId,
                                      0
                                    );
                                  }}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2"
                                >
                                  <ArrowsClockwise className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Clear Terminal</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Terminal Content - Multiple XTerms */}
                      <div className="flex-1 bg-[#1e1e1e] overflow-hidden relative">
                        {Array.from({ length: terminalCount }, (_, index) => {
                          const isActive = activeTerminalId === index;
                          return (
                            <div
                              key={index}
                              className={`absolute inset-0 ${
                                !isActive ? "hidden" : ""
                              }`}
                            >
                              <Terminal
                                ref={(ref) => {
                                  if (ref) {
                                    terminalRefs.current.set(index, ref);
                                  }
                                }}
                                id={`terminal-${index}`}
                                className="h-full w-full"
                                readonly={false}
                                onTerminalReady={async (terminal) => {
                                  setTimeout(async () => {
                                    try {
                                      terminal.writeln(
                                        "\x1b[1;36mWelcome to NowgAI Terminal\x1b[0m"
                                      );
                                      terminal.writeln("");

                                      // Write existing terminal lines for terminal 0
                                      if (
                                        index === 0 &&
                                        terminalLines &&
                                        terminalLines.length > 0
                                      ) {
                                        terminalLines.forEach((line) => {
                                          terminal.writeln(line);
                                        });
                                        lastLineIndexRefs.current.set(
                                          index,
                                          terminalLines.length
                                        );
                                      } else {
                                        lastLineIndexRefs.current.set(index, 0);
                                      }

                                      // For terminals > 0, attach interactive shell
                                      if (index > 0) {
                                        try {
                                          const cleanup =
                                            await attachInteractiveShell(
                                              terminal
                                            );
                                          terminalCleanups.current.set(
                                            index,
                                            cleanup
                                          );
                                        } catch (e: any) {
                                          console.error(
                                            `[Terminal ${index}] Failed to attach shell:`,
                                            e
                                          );
                                          terminal.writeln(
                                            "\x1b[1;31mFailed to start interactive shell\x1b[0m"
                                          );
                                          if (
                                            e.message?.includes(
                                              "not initialized"
                                            )
                                          ) {
                                            terminal.writeln(
                                              "\x1b[33mPlease run a command in Terminal 0 first to initialize WebContainer.\x1b[0m"
                                            );
                                          } else if (e.message) {
                                            terminal.writeln(
                                              `\x1b[33mError: ${e.message}\x1b[0m`
                                            );
                                          }
                                        }
                                      }
                                    } catch (e) {
                                      console.error("Terminal init error:", e);
                                    }
                                  }, 150);
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </ResizablePanel>
                </>
              )}

              {/* Show expand button when terminal is collapsed */}
              {isTerminalCollapsed && (
                <div className="border-t border-border/30 bg-surface-2/30">
                  <Button
                    onClick={() => setIsTerminalCollapsed(false)}
                    size="sm"
                    variant="ghost"
                    className="w-full h-8 rounded-none text-muted-foreground hover:text-foreground hover:bg-surface-2"
                  >
                    <CaretUp className="w-3.5 h-3.5 mr-1" />
                    <span className="text-xs">Show Terminal</span>
                  </Button>
                </div>
              )}
            </ResizablePanelGroup>
          </TabsContent>

          <TabsContent
            value="preview"
            forceMount
            className={`h-full m-0 min-h-0 max-h-full flex flex-col ${
              activeTab !== "preview" ? "hidden" : ""
            }`}
          >
            <div className="flex-1 min-h-0 rounded-lg overflow-hidden">
              <PreviewPanel
                previewUrl={previewUrl}
                isLoading={isLoading || !previewUrl}
                terminalLines={terminalLines}
                onElementSelected={onElementSelected}
                onInspectorEnable={onInspectorEnable}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// Export memoized component
const RightPanel = memo(RightPanelComponent);
export default RightPanel;
