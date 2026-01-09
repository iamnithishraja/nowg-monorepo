import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { dracula } from "thememirror";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { classNames } from "../lib/classNames";

export type CodeEditorHandle = { openSearch: () => void };

interface CodeEditorProps {
  filePath?: string;
  files?: Array<{ name: string; path: string; content: string }>;
  onChangeContent?: (path: string, content: string) => void;
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function CodeEditor(
    { filePath, files = [], onChangeContent }: CodeEditorProps,
    ref
  ) {
    const file = files.find((f) => f.path === filePath) || null;
    const title = file?.path || "No file selected";
    const [draft, setDraft] = useState<string>(file?.content || "");
    const [showRawContent, setShowRawContent] = useState(false);
    const viewRef = useRef<EditorView | null>(null);

    useImperativeHandle(ref, () => ({
      openSearch: () => {
        if (viewRef.current) {
          openSearchPanel(viewRef.current);
        }
      },
    }));

    useEffect(() => {
      setDraft(file?.content || "");
      setShowRawContent(false);
    }, [file?.path]);

    // Check if this is an image file
    const isImageFile =
      file && /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i.test(file.path);
    const isValidImageData = draft && draft.startsWith("data:image");

    const extensions = useMemo(() => {
      const p = (file?.path || "").toLowerCase();
      const langExtensions: any[] = [];

      // Add language support
      // Add language support
      if (p.endsWith(".ts") || p.endsWith(".tsx"))
        langExtensions.push(
          javascript({ typescript: true, jsx: p.endsWith(".tsx") })
        );
      else if (p.endsWith(".js") || p.endsWith(".jsx"))
        langExtensions.push(javascript({ jsx: p.endsWith(".jsx") }));
      else if (p.endsWith(".html"))
        langExtensions.push(html());
      else if (p.endsWith(".css")) langExtensions.push(css());
      else if (p.endsWith(".json")) langExtensions.push(json());

      // Add line wrapping and horizontal scroll handling
      langExtensions.push(
        EditorView.lineWrapping,
        EditorView.theme({
          "&": { maxWidth: "100%" },
          ".cm-editor": { maxWidth: "100%" },
          ".cm-scroller": { overflow: "auto", maxWidth: "100%" },
          ".cm-content": {
            padding: "10px",
            minHeight: "100%",
            maxWidth: "100%",
          },
          ".cm-line": { maxWidth: "100%", wordBreak: "break-word" },
        })
      );

      return langExtensions;
    }, [file?.path]);

    // removed Mod-s mapping; we autosave onChange

    return (
      <div className="bg-background text-foreground h-full flex flex-col overflow-hidden">
        {file ? (
          <div className="h-full flex flex-col">
            {isImageFile && isValidImageData && !showRawContent ? (
              <div className="h-full flex flex-col overflow-auto">
                <div
                  className={classNames(
                    "px-4 py-3 border-b border-border",
                    "flex justify-between items-center",
                    "bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm"
                  )}
                >
                  <span className="text-sm font-mono text-muted-foreground truncate max-w-[60%]">
                    {file.path}
                  </span>
                  <button
                    onClick={() => setShowRawContent(true)}
                    className={classNames(
                      "text-xs px-3 py-1.5 rounded-md font-medium",
                      "bg-primary/10 hover:bg-primary/20 text-primary",
                      "transition-all duration-200 hover:scale-105 active:scale-95",
                      "border border-primary/20"
                    )}
                  >
                    Show Base64
                  </button>
                </div>
                <div className="flex-1 p-8 flex items-center justify-center bg-gradient-to-br from-muted/5 via-transparent to-muted/5">
                  <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50 shadow-lg">
                    <img
                      src={draft}
                      alt={file.name}
                      className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl border border-border"
                      onError={() => setShowRawContent(true)}
                    />
                    <div className="text-sm font-medium text-muted-foreground px-4 py-2 bg-muted/50 rounded-md">
                      {file.name}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {isImageFile && isValidImageData && (
                  <div
                    className={classNames(
                      "px-4 py-2.5 border-b border-border",
                      "flex justify-end",
                      "bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm"
                    )}
                  >
                    <button
                      onClick={() => setShowRawContent(false)}
                      className={classNames(
                        "text-xs px-3 py-1.5 rounded-md font-medium",
                        "bg-primary/10 hover:bg-primary/20 text-primary",
                        "transition-all duration-200 hover:scale-105 active:scale-95",
                        "border border-primary/20"
                      )}
                    >
                      Show Image Preview
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <CodeMirror
                    value={draft}
                    width="100%"
                    height="100%"
                    theme={dracula}
                    onUpdate={(update) => {
                      // capture the view instance for imperative commands
                      // set once; but it's fine to set repeatedly
                      if (update.view)
                        viewRef.current = update.view as EditorView;
                    }}
                    extensions={extensions}
                    onChange={(value) => {
                      setDraft(value);
                      if (file && onChangeContent)
                        onChangeContent(file.path, value);
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      maxHeight: "100%",
                      maxWidth: "100%",
                      overflow: "hidden",
                    }}
                    basicSetup={{
                      // Visuals / gutters
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      foldGutter: true,
                      // Editing UX
                      history: true,
                      drawSelection: true,
                      dropCursor: true,
                      indentOnInput: true,
                      bracketMatching: true,
                      closeBrackets: true,
                      autocompletion: true,
                      rectangularSelection: true,
                      highlightActiveLine: true,
                      highlightSelectionMatches: true,
                      // Keymaps
                      closeBracketsKeymap: true,
                      searchKeymap: true,
                      foldKeymap: true,
                      completionKeymap: true,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center bg-gradient-to-br from-card via-card to-muted/20">
            <div className="text-center space-y-3 p-8">
              <div className="text-6xl text-muted-foreground/20">📄</div>
              <div className="space-y-1">
                <p className="text-foreground font-semibold">
                  No File Selected
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Select a file from the file tree to view or edit its contents
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default CodeEditor;
