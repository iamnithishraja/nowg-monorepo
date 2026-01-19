import { WebContainer } from "@webcontainer/api";
import { WORK_DIR, WORK_DIR_NAME } from "../utils/constants";
import { connectWebContainerToProvider, disconnectWebContainerFromProvider } from "../tools/webcontainer-provider";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite raw import for bundling inspector script content
import inspectorScriptRaw from "../inspector-script.js?raw";

// HMR preservation - keep WebContainer instance across hot reloads (like bolt.diy)
interface WebContainerContext {
  container: WebContainer | null;
  previewUrl: string | null;
  currentDevProcess: any;
  currentShellProcess: any;
}

const context: WebContainerContext = (import.meta.hot?.data?.webcontainerContext as WebContainerContext) ?? {
  container: null,
  previewUrl: null,
  currentDevProcess: null,
  currentShellProcess: null,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = context;
}

let webContainer: WebContainer | null = context.container;
let previewUrl: string | null = context.previewUrl;
let currentDevProcess: any = context.currentDevProcess;
let currentShellProcess: any = context.currentShellProcess;
const previewUrlListeners: Array<(url: string | null) => void> = [];

// Boot lock to prevent concurrent WebContainer boot attempts
let bootPromise: Promise<WebContainer> | null = null;

// Sync context on changes
function updateContext() {
  context.container = webContainer;
  context.previewUrl = previewUrl;
  context.currentDevProcess = currentDevProcess;
  context.currentShellProcess = currentShellProcess;
}

function notifyPreviewUrl(url: string | null) {
  for (const l of previewUrlListeners) {
    try {
      l(url);
    } catch {}
  }
}

// Ensure WebContainer is booted (with lock to prevent concurrent boots)
async function ensureWebContainerBooted(): Promise<WebContainer> {
  // If already booted, return immediately
  if (webContainer) {
    return webContainer;
  }

  // If boot is in progress, wait for it
  if (bootPromise) {
    return bootPromise;
  }

  // Start boot process
  bootPromise = (async () => {
    try {
      console.log("[WebContainer] 🚀 Booting WebContainer...");
      const container = await WebContainer.boot({
        coep: "credentialless",
        workdirName: WORK_DIR_NAME,
      });
      await container.mount({});
      webContainer = container;
      updateContext();
      
      // Connect to WebContainerProvider for tool execution
      connectWebContainerToProvider(container);
      console.log("[WebContainer] ✅ WebContainer booted and connected to provider");

      // Set up event listeners
      container.on("server-ready", (port, url) => {
        console.log("[WebContainer] 🌐 Server ready:", port, url);
        previewUrl = url;
        updateContext();
        notifyPreviewUrl(previewUrl);
      });

      // Track preview URLs via 'port' events
      const openPorts = new Map<number, string>();
      container.on("port", (port: number, type: string, url: string) => {
        if (type === "close") {
          openPorts.delete(port);
          return;
        }

        // type === 'open'
        openPorts.set(port, url);
        // Prefer the lowest port if multiple open
        const sorted = [...openPorts.entries()].sort((a, b) => a[0] - b[0]);
        const firstUrl = sorted[0]?.[1];
        if (!previewUrl && firstUrl) {
          previewUrl = firstUrl;
          updateContext();
          notifyPreviewUrl(previewUrl);
        }
      });

      return container;
    } finally {
      // Clear boot promise after boot completes (success or failure)
      bootPromise = null;
    }
  })();

  return bootPromise;
}

// Helper function to convert base64 data URL to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

  // Decode base64 to binary string
  const binaryString = atob(base64Data);

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

// Check if content is a base64 data URL (for images, etc.)
function isBase64DataUrl(content: string): boolean {
  return content.startsWith("data:") && content.includes("base64,");
}

export function onPreviewUrl(
  listener: (url: string | null) => void
): () => void {
  previewUrlListeners.push(listener);
  // If we already have a URL when subscribing, notify immediately
  if (previewUrl) listener(previewUrl);
  return () => {
    const idx = previewUrlListeners.indexOf(listener);
    if (idx >= 0) previewUrlListeners.splice(idx, 1);
  };
}

export async function runWebContainer(
  files: Array<{ path: string; content: string }>
): Promise<string | null> {
  // Ensure WebContainer is booted (with lock to prevent concurrent boots)
  await ensureWebContainerBooted();

  // Don't reset preview URL if WebContainer already exists and has a preview
  // This prevents breaking existing previews when running commands
  if (previewUrl) {
    return previewUrl;
  }

  // Reset preview URL for new runs (only when WebContainer is newly created)
  previewUrl = null;
  notifyPreviewUrl(previewUrl);

  // Ensure working directory exists even if there are no files
  try {
    await (webContainer!.fs as any).mkdir(WORK_DIR, { recursive: true });
  } catch {}

  // Do not auto-bootstrap demo files; we only run what the user provided

  const ensureDir = async (dirPath: string) => {
    if (!dirPath || dirPath === "." || dirPath === "/") return;
    try {
      await (webContainer!.fs as any).mkdir(dirPath, { recursive: true });
    } catch {}
  };

  // Write files under WORK_DIR
  for (const f of files) {
    const relPath = f.path.replace(/^\/+/, "");
    const fullPath = `${WORK_DIR}/${relPath}`;
    const parts = fullPath.split("/").filter(Boolean);
    const dir = parts.slice(0, -1).join("/");
    if (dir) await ensureDir(`/${dir}`);

    // Inject a lightweight console proxy into index.html to forward client errors to parent via postMessage
    // Inject console proxy and inspector script into index.html served by WebContainer
    if (f.path.toLowerCase().endsWith("index.html")) {
      let content = f.content;
      // Console proxy (once)
      if (!content.includes("__PREVIEW_CONSOLE_PROXY__")) {
        const proxy = `\n<!-- __PREVIEW_CONSOLE_PROXY__ -->\n<script>(function(){\n  try{\n    var send=function(level,args){\n      try{parent&&parent.postMessage({type:'preview-console',level:level,args:Array.from(args).map(function(a){try{return typeof a==='string'?a:JSON.stringify(a);}catch(e){return String(a);}})},'*');}catch(e){}\n    };\n    var origLog=console.log, origWarn=console.warn, origErr=console.error;\n    console.log=function(){send('log',arguments); origLog&&origLog.apply(console,arguments)};\n    console.warn=function(){send('warn',arguments); origWarn&&origWarn.apply(console,arguments)};\n    console.error=function(){send('error',arguments); origErr&&origErr.apply(console,arguments)};\n    window.addEventListener('error',function(e){send('error',[e.message+' at '+(e.filename||'')+':'+(e.lineno||'')])});\n    window.addEventListener('unhandledrejection',function(e){send('error',['Unhandled Promise rejection: '+(e.reason&&e.reason.message||e.reason||'')])});\n  }catch(e){}\n})();</script>\n`;
        if (content.includes("</body>"))
          content = content.replace("</body>", proxy + "</body>");
        else content += proxy;
      }
      // Inspector script (inline, once)
      if (!content.includes("__INSPECTOR_SCRIPT__")) {
        try {
          const escaped = (inspectorScriptRaw as string).replace(
            /<\/?script>/gi,
            function (match) {
              return match.replace(/\//g, "\\/");
            }
          );
          const inspector = `\n<!-- __INSPECTOR_SCRIPT__ -->\n<script>${escaped}</script>\n`;
          if (content.includes("</body>"))
            content = content.replace("</body>", inspector + "</body>");
          else content += inspector;
        } catch (e) {

        }
      }
      await webContainer!.fs.writeFile(fullPath, content);
      continue;
    }

    // Handle binary files (base64 data URLs)
    if (isBase64DataUrl(f.content)) {

      const uint8Array = base64ToUint8Array(f.content);
      await webContainer!.fs.writeFile(fullPath, uint8Array);
    } else {
      await webContainer!.fs.writeFile(fullPath, f.content);
    }
  }

  // Skip npm install during initial streaming to avoid blocking UX
  // Installation will occur implicitly when a shell action streams a command

  // Kill existing dev process if running
  if (currentDevProcess) {
    try {
      currentDevProcess.kill();
      currentDevProcess = null;
      updateContext();
    } catch (e) {
      // Ignore
    }
  }

  // Do not start the dev server automatically. It will be started by a streamed shell action.
  return null;
}

export async function runShellCommand(
  command: string,
  onOutput?: (line: string) => void
): Promise<number> {
  console.log("[WebContainer] 🐚 Running shell command:", command);
  
  // Ensure WebContainer is booted (with lock to prevent concurrent boots)
  await ensureWebContainerBooted();

  // Kill previous shell process if any
  if (currentShellProcess) {
    try {
      currentShellProcess.kill();
    } catch {}
    currentShellProcess = null;
    updateContext();
  }

  // Execute via a real shell so operators like &&, |, ; work
  const runViaShell = async (shellBin: string) => {
    const env = {
      HOST: "0.0.0.0",
      PORT: "5173",
      NODE_ENV: "development",
      PATH: "/usr/local/bin:/usr/bin:/bin",
    } as Record<string, string>;
    const proc = await webContainer!.spawn(shellBin, ["-lc", command], {
      cwd: WORK_DIR,
      env,
    });
    currentShellProcess = proc;
    updateContext();

    const decoder = new TextDecoder();
    (proc.output as any)
      .pipeTo(
        new WritableStream<any>({
          write(chunk) {
            try {
              const text = decoder.decode(chunk, { stream: true });
              if (text) onOutput?.(text);
            } catch {
              onOutput?.(String(chunk));
            }
          },
        })
      )
      .catch(() => {});

    const exitCode = await proc.exit;
    currentShellProcess = null;
    updateContext();
    console.log("[WebContainer] ✅ Shell command completed with exit code:", exitCode);
    return exitCode;
  };

  try {
    return await runViaShell("bash");
  } catch {
    // Fallback to sh if bash is unavailable (use -c)
    const env = {
      HOST: "0.0.0.0",
      PORT: "5173",
      NODE_ENV: "development",
      PATH: "/usr/local/bin:/usr/bin:/bin",
    } as Record<string, string>;
    const proc = await webContainer!.spawn("sh", ["-c", command], {
      cwd: WORK_DIR,
      env,
    });
    currentShellProcess = proc;
    const decoder = new TextDecoder();
    (proc.output as any)
      .pipeTo(
        new WritableStream<any>({
          write(chunk) {
            try {
              const text = decoder.decode(chunk, { stream: true });
              if (text) onOutput?.(text);
            } catch {
              onOutput?.(String(chunk));
            }
          },
        })
      )
      .catch(() => {});
    const exitCode = await proc.exit;
    currentShellProcess = null;
    return exitCode;
  }
}

export async function runShellCommandBackground(
  command: string,
  onOutput?: (line: string) => void,
  onExit?: (code: number) => void
): Promise<void> {
  console.log("[WebContainer] 🐚 Running background shell command:", command);
  
  // Ensure WebContainer is booted (with lock to prevent concurrent boots)
  await ensureWebContainerBooted();

  const startWithShell = async (shellBin: string, shellArgs: string[]) => {
    const env = {
      HOST: "0.0.0.0",
      PORT: "5173",
      NODE_ENV: "development",
      PATH: "/usr/local/bin:/usr/bin:/bin",
    } as Record<string, string>;
    const proc = await webContainer!.spawn(shellBin, shellArgs, {
      cwd: WORK_DIR,
      env,
    });
    currentShellProcess = proc;
    updateContext();
    
    const decoder = new TextDecoder();
    (proc.output as any)
      .pipeTo(
        new WritableStream<any>({
          write(chunk) {
            try {
              const text = decoder.decode(chunk, { stream: true });
              if (text) onOutput?.(text);
            } catch {
              onOutput?.(String(chunk));
            }
          },
        })
      )
      .catch(() => {});
    proc.exit
      .then((code: number) => {
        currentShellProcess = null;
        updateContext();
        console.log("[WebContainer] ✅ Background command completed with exit code:", code);
        onExit?.(code);
      })
      .catch(() => {
        currentShellProcess = null;
        updateContext();
        onExit?.(-1);
      });
  };

  try {
    await startWithShell("bash", ["-lc", command]);
  } catch {
    await startWithShell("sh", ["-c", command]);
  }
}

// Add utility functions
export function getPreviewUrl(): string | null {
  return previewUrl;
}

export async function getWebContainer(): Promise<WebContainer | null> {
  return webContainer;
}

export async function stopDevServer(): Promise<void> {
  if (currentDevProcess) {
    try {
      currentDevProcess.kill();
      currentDevProcess = null;
      updateContext();
    } catch (e) {
      // Ignore
    }
  }
}

export async function killAllProcesses(): Promise<void> {
  try {
    if (currentShellProcess) {
      try {
        currentShellProcess.kill();
      } catch {}
      currentShellProcess = null;
    }
    if (currentDevProcess) {
      try {
        currentDevProcess.kill();
      } catch {}
      currentDevProcess = null;
    }
    previewUrl = null;
    updateContext();
    notifyPreviewUrl(previewUrl);
    console.log("[WebContainer] 🛑 All processes killed");
  } catch (e) {
    console.error("[WebContainer] Error killing processes:", e);
  }
}

// Minimal save utility: write a single file into the running WebContainer FS
export async function writeWebContainerFile(
  path: string,
  content: string
): Promise<void> {
  if (!webContainer) return;
  try {
    const rel = path.replace(/^\/+/, "");
    const fullPath = `${WORK_DIR}/${rel}`;
    const parts = fullPath.split("/").filter(Boolean);
    const dir = parts.slice(0, -1).join("/");
    if (dir) {
      try {
        await (webContainer.fs as any).mkdir(`/${dir}`, { recursive: true });
      } catch {}
    }

    // Check if this is binary data (base64 data URL)
    if (isBase64DataUrl(content)) {

      const uint8Array = base64ToUint8Array(content);
      await webContainer.fs.writeFile(fullPath, uint8Array);

    } else {
      await webContainer.fs.writeFile(fullPath, content);

    }
  } catch (e) {

  }
}

// Recursively delete the project directory to reset state
export async function resetProjectDirectory(
  projectRoot: string = "/home/project"
): Promise<void> {
  if (!webContainer) return;
  const fs: any = webContainer.fs as any;

  const rmRecursive = async (target: string) => {
    try {
      const stat = await fs.stat(target).catch(() => null);
      if (!stat) return;
      if (stat.isFile()) {
        await fs.unlink(target).catch(() => {});
        return;
      }
      if (stat.isDirectory()) {
        const entries: string[] = await fs.readdir(target).catch(() => []);
        for (const name of entries) {
          await rmRecursive(`${target}/${name}`);
        }
        await fs.rmdir(target).catch(() => {});
        return;
      }
    } catch {}
  };

  try {
    await rmRecursive(projectRoot);
    await fs.mkdir(projectRoot, { recursive: true }).catch(() => {});

  } catch (e) {

  }
}

/**
 * Attach an interactive shell to an xterm terminal
 */
export async function attachInteractiveShell(
  terminal: any
): Promise<() => void> {

  // WebContainer should already be running from Terminal 0
  if (!webContainer) {
    throw new Error(
      "WebContainer not initialized. Please run a command in Terminal 0 first."
    );
  }

  

  const env = {
    HOST: "0.0.0.0",
    PORT: "5173",
    NODE_ENV: "development",
    PATH: "/usr/local/bin:/usr/bin:/bin",
  } as Record<string, string>;

  // Instead of interactive shell, let's just show a prompt and handle commands
  terminal.writeln("\x1b[1;32mInteractive Terminal Ready\x1b[0m");
  terminal.writeln(
    "\x1b[33mType commands and press Enter to execute them.\x1b[0m"
  );
  terminal.writeln("");

  // Show a prompt
  terminal.write("\x1b[1;36m$ \x1b[0m");

  // Handle terminal input - collect commands and execute them
  let currentCommand = "";
  const onDataDisposable = terminal.onData((data: string) => {
    if (data === "\r" || data === "\n") {
      // Execute command when Enter is pressed
      if (currentCommand.trim()) {
        terminal.writeln(""); // New line after command
        executeCommand(currentCommand.trim(), terminal);
        currentCommand = "";
        terminal.write("\x1b[1;36m$ \x1b[0m"); // Show new prompt
      } else {
        terminal.writeln(""); // Just new line for empty command
        terminal.write("\x1b[1;36m$ \x1b[0m"); // Show new prompt
      }
    } else if (data === "\u007f" || data === "\b") {
      // Handle backspace
      if (currentCommand.length > 0) {
        currentCommand = currentCommand.slice(0, -1);
        terminal.write("\b \b"); // Move cursor back, write space, move back
      }
    } else if (data.length === 1 && data >= " ") {
      // Handle regular characters
      currentCommand += data;
      terminal.write(data);
    }
  });

  

  // Return cleanup function
  return () => {
    onDataDisposable.dispose();
  };
}

// Helper function to execute commands
async function executeCommand(command: string, terminal: any) {
  try {
    terminal.writeln(`\x1b[33mExecuting: ${command}\x1b[0m`);

    // Use the existing runShellCommand function
    await runShellCommand(command, (line: string) => {
      terminal.writeln(line);
    });

    terminal.writeln(`\x1b[32mCommand completed.\x1b[0m`);
  } catch (e) {
    terminal.writeln(`\x1b[31mError: ${e}\x1b[0m`);
  }
}
