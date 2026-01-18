import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GlobTool } from "../../app/tools/glob";
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
          mtimeMs: Date.now(),
        };
      }
      const isDir = Object.keys(files).some((f) => f.startsWith(path + "/"));
      if (isDir) {
        return {
          isDirectory: () => true,
          isFile: () => false,
          size: 0,
          mtimeMs: Date.now(),
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

describe("GlobTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic glob patterns", () => {
    it("should find files with simple extension pattern", async () => {
      const mockContainer = createMockWebContainer({
        "/project/index.ts": "",
        "/project/app.ts": "",
        "/project/style.css": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "*.ts" },
        createMockContext()
      );

      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("app.ts");
      expect(result.output).not.toContain("style.css");
      expect(result.metadata.count).toBe(2);
    });

    it("should find files with ** pattern (any depth)", async () => {
      const mockContainer = createMockWebContainer({
        "/project/index.ts": "",
        "/project/src/app.ts": "",
        "/project/src/utils/helper.ts": "",
        "/project/README.md": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.ts" },
        createMockContext()
      );

      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("app.ts");
      expect(result.output).toContain("helper.ts");
      expect(result.output).not.toContain("README.md");
      expect(result.metadata.count).toBe(3);
    });

    it("should find files in specific directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "",
        "/project/src/index.ts": "",
        "/project/lib/utils.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "src/*" },
        createMockContext()
      );

      expect(result.output).toContain("App.tsx");
      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("utils.ts");
    });

    it("should return no files message when no matches", async () => {
      const mockContainer = createMockWebContainer({
        "/project/index.js": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "*.ts" },
        createMockContext()
      );

      expect(result.output).toBe("No files found");
      expect(result.metadata.count).toBe(0);
    });
  });

  describe("brace expansion", () => {
    it("should support brace expansion for extensions", async () => {
      const mockContainer = createMockWebContainer({
        "/project/App.tsx": "",
        "/project/utils.ts": "",
        "/project/helper.js": "",
        "/project/style.css": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "*.{ts,tsx}" },
        createMockContext()
      );

      expect(result.output).toContain("App.tsx");
      expect(result.output).toContain("utils.ts");
      expect(result.output).not.toContain("helper.js");
      expect(result.output).not.toContain("style.css");
    });

    it("should support brace expansion with **", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "",
        "/project/src/utils/helper.ts": "",
        "/project/tests/test.spec.ts": "",
        "/project/config.json": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.{ts,tsx}" },
        createMockContext()
      );

      expect(result.output).toContain("App.tsx");
      expect(result.output).toContain("helper.ts");
      expect(result.output).toContain("test.spec.ts");
      expect(result.output).not.toContain("config.json");
    });
  });

  describe("path parameter", () => {
    it("should search in specified directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "",
        "/project/lib/utils.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "*.tsx", path: "src" },
        createMockContext()
      );

      expect(result.output).toContain("App.tsx");
      expect(result.output).not.toContain("utils.ts");
    });

    it("should handle absolute path", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/deep/Component.tsx": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.tsx", path: "/src" },
        createMockContext()
      );

      expect(result.output).toContain("Component.tsx");
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "",
        "/project/node_modules/lodash/index.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.ts" },
        createMockContext()
      );

      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("lodash");
      expect(result.metadata.count).toBe(1);
    });

    it("should ignore .git directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "",
        "/project/.git/config.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.ts" },
        createMockContext()
      );

      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("config.ts");
    });

    it("should ignore dist directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "",
        "/project/dist/bundle.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.ts" },
        createMockContext()
      );

      expect(result.output).toContain("index.ts");
      expect(result.output).not.toContain("bundle.ts");
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

      const result = await GlobTool.execute(
        { pattern: "*.ts" },
        createMockContext()
      );

      expect(result.metadata.count).toBe(100);
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("truncated");
    });
  });

  describe("specific file patterns", () => {
    it("should find package.json files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/package.json": "{}",
        "/project/packages/a/package.json": "{}",
        "/project/packages/b/package.json": "{}",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/package.json" },
        createMockContext()
      );

      expect(result.metadata.count).toBe(3);
    });

    it("should find test files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "",
        "/project/src/App.test.tsx": "",
        "/project/src/utils.ts": "",
        "/project/src/utils.test.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GlobTool.execute(
        { pattern: "**/*.test.{ts,tsx}" },
        createMockContext()
      );

      expect(result.output).toContain("App.test.tsx");
      expect(result.output).toContain("utils.test.ts");
      expect(result.output).not.toContain("App.tsx");
      expect(result.output).not.toContain("utils.ts");
      expect(result.metadata.count).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        GlobTool.execute({ pattern: "*.ts" }, createMockContext())
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error when pattern is empty", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        GlobTool.execute({ pattern: "" }, createMockContext())
      ).rejects.toThrow();
    });

    it("should throw error when directory not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/other.ts": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        GlobTool.execute(
          { pattern: "*.ts", path: "nonexistent" },
          createMockContext()
        )
      ).rejects.toThrow("Directory not found");
    });

    it("should throw error when path is a file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/file.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        GlobTool.execute(
          { pattern: "*.ts", path: "file.ts" },
          createMockContext()
        )
      ).rejects.toThrow("Not a directory");
    });
  });
});

describe("GlobTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have GlobTool registered by default", () => {
    expect(ToolRegistry.has("glob")).toBe(true);
  });

  it("should get GlobTool by ID", () => {
    const tool = ToolRegistry.get("glob");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("glob");
  });

  it("should include glob in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("glob");
  });
});
