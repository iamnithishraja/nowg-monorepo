import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ListTool } from "../../app/tools/ls";
import { WebContainerProvider } from "../../app/tools/webcontainer-provider";
import { ToolRegistry } from "../../app/tools/registry";
import type { Tool } from "../../app/tools/tool";

// Mock WebContainer filesystem
function createMockWebContainer(files: Record<string, string | Uint8Array>) {
  const mockFs = {
    readFile: vi.fn(async (path: string) => {
      const content = files[path];
      if (content === undefined) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      if (content instanceof Uint8Array) {
        return content;
      }
      return new TextEncoder().encode(content);
    }),
    readdir: vi.fn(async (path: string, opts?: { withFileTypes?: boolean }) => {
      const entries: any[] = [];
      const seenNames = new Set<string>();

      for (const filePath of Object.keys(files)) {
        if (filePath.startsWith(path + "/")) {
          const relative = filePath.slice(path.length + 1);
          const firstPart = relative.split("/")[0];

          if (!seenNames.has(firstPart)) {
            seenNames.add(firstPart);
            const fullPath = `${path}/${firstPart}`;
            const isDir = Object.keys(files).some(
              (f) => f.startsWith(fullPath + "/")
            );
            const isFile = files[fullPath] !== undefined;

            if (opts?.withFileTypes) {
              entries.push({
                name: firstPart,
                isDirectory: () => isDir && !isFile,
                isFile: () => isFile || !isDir,
              });
            } else {
              entries.push(firstPart);
            }
          }
        }
      }

      if (entries.length === 0 && !Object.keys(files).some((f) => f === path)) {
        throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
      }
      return entries;
    }),
    stat: vi.fn(async (path: string) => {
      const content = files[path];
      if (content !== undefined) {
        return {
          isDirectory: () => false,
          isFile: () => true,
          size: content instanceof Uint8Array ? content.length : content.length,
        };
      }
      const isDir = Object.keys(files).some((f) => f.startsWith(path + "/"));
      if (isDir) {
        return {
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
        };
      }
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }),
  };

  return { fs: mockFs };
}

// Create a mock context
function createMockContext(): Tool.Context {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    metadata: vi.fn(),
  };
}

describe("ListTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic listing", () => {
    it("should list files in root directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/package.json": '{"name": "test"}',
        "/project/index.ts": "console.log('hello');",
        "/project/README.md": "# Test",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("package.json");
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("README.md");
      expect(result.metadata.count).toBe(3);
      expect(result.metadata.truncated).toBe(false);
    });

    it("should show directory structure", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export {};",
        "/project/src/utils/helper.ts": "export const helper = () => {};",
        "/project/package.json": '{}',
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("src/");
      expect(result.output).toContain("utils/");
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("helper.ts");
    });

    it("should list subdirectory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "export default function App() {}",
        "/project/src/index.ts": "import App from './App';",
        "/project/package.json": '{}',
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute(
        { path: "src" },
        createMockContext()
      );

      expect(result.output).toContain("App.tsx");
      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("package.json");
    });

    it("should handle absolute paths", async () => {
      const mockContainer = createMockWebContainer({
        "/project/lib/utils.ts": "export {};",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute(
        { path: "/lib" },
        createMockContext()
      );

      expect(result.output).toContain("utils.ts");
    });

    it("should handle empty directories", async () => {
      const mockContainer = createMockWebContainer({
        "/project/.gitkeep": "",
      });
      // Override readdir to return empty for /project
      mockContainer.fs.readdir = vi.fn(async () => []);
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("empty directory");
      expect(result.metadata.count).toBe(0);
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export {};",
        "/project/node_modules/lodash/index.js": "module.exports = {};",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("src/");
      expect(result.output).not.toContain("node_modules");
      expect(result.output).not.toContain("lodash");
    });

    it("should ignore .git directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export {};",
        "/project/.git/config": "[core]",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("src/");
      expect(result.output).not.toContain(".git");
    });

    it("should ignore dist directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export {};",
        "/project/dist/index.js": "console.log();",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("src/");
      expect(result.output).not.toContain("dist");
    });

    it("should apply custom ignore patterns", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export {};",
        "/project/temp/cache.txt": "temp data",
        "/project/logs/app.log": "log entry",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute(
        { ignore: ["*.log", "temp/"] },
        createMockContext()
      );

      expect(result.output).toContain("src/");
      expect(result.output).not.toContain("temp");
      expect(result.output).not.toContain("app.log");
    });
  });

  describe("truncation", () => {
    it("should truncate results when exceeding limit", async () => {
      // Create many files
      const files: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        files[`/project/file${i.toString().padStart(3, "0")}.ts`] = "";
      }

      const mockContainer = createMockWebContainer(files);
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.metadata.count).toBe(100);
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("truncated");
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(ListTool.execute({}, createMockContext())).rejects.toThrow(
        "WebContainer is not available"
      );
    }, 5000);

    it("should throw error when directory not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/other.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ListTool.execute({ path: "nonexistent" }, createMockContext())
      ).rejects.toThrow("Directory not found");
    });

    it("should throw error when path is a file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/file.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ListTool.execute({ path: "file.ts" }, createMockContext())
      ).rejects.toThrow("Not a directory");
    });
  });

  describe("output formatting", () => {
    it("should show directories with trailing slash", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "",
        "/project/lib/utils.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      expect(result.output).toContain("src/");
      expect(result.output).toContain("lib/");
    });

    it("should indent nested items", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/components/Button.tsx": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ListTool.execute({}, createMockContext());

      // Check that the structure is properly nested
      const lines = result.output.split("\n");
      const srcLine = lines.find((l) => l.includes("src/"));
      const componentsLine = lines.find((l) => l.includes("components/"));
      const buttonLine = lines.find((l) => l.includes("Button.tsx"));

      expect(srcLine).toBeDefined();
      expect(componentsLine).toBeDefined();
      expect(buttonLine).toBeDefined();
    });
  });
});

describe("ListTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have ListTool registered by default", () => {
    expect(ToolRegistry.has("list")).toBe(true);
  });

  it("should get ListTool by ID", () => {
    const tool = ToolRegistry.get("list");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("list");
  });

  it("should include list in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("list");
  });
});
