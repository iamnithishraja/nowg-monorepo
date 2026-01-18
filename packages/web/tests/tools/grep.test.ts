import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GrepTool } from "../../app/tools/grep";
import { WebContainerProvider } from "../../app/tools/webcontainer-provider";
import { ToolRegistry } from "../../app/tools/registry";
import type { Tool } from "../../app/tools/tool";

// Mock WebContainer filesystem
function createMockWebContainer(
  files: Record<string, string | Uint8Array>,
  options: { withFileTypes?: boolean } = {}
) {
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
            // Check if there are any files under this path (making it a directory)
            const isDir = Object.keys(files).some(
              (f) => f.startsWith(fullPath + "/")
            );
            // It's a file if it exists directly in files and there's no deeper path
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

describe("GrepTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic pattern matching", () => {
    it("should find a simple pattern in a file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';\nconst foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.output).toContain("Found");
      expect(result.output).toContain("test.ts");
      expect(result.output).toContain("hello");
      expect(result.metadata.matches).toBe(1);
      expect(result.metadata.truncated).toBe(false);
    });

    it("should find multiple matches in a file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts":
          "const hello = 1;\nconst hello2 = 2;\nconst hello3 = 3;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(3);
      expect(result.output).toContain("Line 1");
      expect(result.output).toContain("Line 2");
      expect(result.output).toContain("Line 3");
    });

    it("should find matches across multiple files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'a';",
        "/project/src/b.ts": "const hello = 'b';",
        "/project/src/c.ts": "const goodbye = 'c';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(2);
      expect(result.output).toContain("a.ts");
      expect(result.output).toContain("b.ts");
      expect(result.output).not.toContain("c.ts");
    });

    it("should return no matches message when pattern not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.output).toBe("No matches found");
      expect(result.metadata.matches).toBe(0);
      expect(result.metadata.truncated).toBe(false);
    });
  });

  describe("regex patterns", () => {
    it("should support regex patterns", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts":
          "const hello123 = 1;\nconst hello456 = 2;\nconst goodbye = 3;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello\\d+" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(2);
      expect(result.output).toContain("hello123");
      expect(result.output).toContain("hello456");
    });

    it("should throw error for invalid regex", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        GrepTool.execute({ pattern: "[invalid" }, createMockContext())
      ).rejects.toThrow("Invalid regex pattern");
    });

    it("should support complex regex patterns", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts":
          "function myFunc() {}\nconst arrow = () => {};\nasync function asyncFunc() {}",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "function\\s+\\w+" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(2);
      expect(result.output).toContain("myFunc");
      expect(result.output).toContain("asyncFunc");
    });
  });

  describe("path parameter", () => {
    it("should search in specified subdirectory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'src';",
        "/project/lib/b.ts": "const hello = 'lib';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello", path: "src" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
      expect(result.output).toContain("a.ts");
      expect(result.output).not.toContain("b.ts");
    });

    it("should handle absolute paths", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/deep/file.ts": "const match = true;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "match", path: "/src/deep" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
    });
  });

  describe("include parameter", () => {
    it("should filter by file extension", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'ts';",
        "/project/src/b.js": "const hello = 'js';",
        "/project/src/c.css": ".hello { }",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello", include: "*.ts" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
      expect(result.output).toContain("a.ts");
      expect(result.output).not.toContain("b.js");
      expect(result.output).not.toContain("c.css");
    });

    it("should support brace expansion", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'ts';",
        "/project/src/b.tsx": "const hello = 'tsx';",
        "/project/src/c.js": "const hello = 'js';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello", include: "*.{ts,tsx}" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(2);
      expect(result.output).toContain("a.ts");
      expect(result.output).toContain("b.tsx");
      expect(result.output).not.toContain("c.js");
    });
  });

  describe("truncation", () => {
    it("should truncate results when exceeding limit", async () => {
      // Create many files with matches
      const files: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        files[`/project/file${i}.ts`] = `const match${i} = true;`;
      }

      const mockContainer = createMockWebContainer(files);
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "match" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(100);
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("truncated");
    });

    it("should truncate long lines", async () => {
      const longLine = "x".repeat(3000);
      const mockContainer = createMockWebContainer({
        "/project/test.ts": `const hello = "${longLine}";`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.output).toContain("...");
      expect(result.output.length).toBeLessThan(3000);
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'src';",
        "/project/node_modules/pkg/index.js": "const hello = 'node_modules';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
      expect(result.output).toContain("a.ts");
      expect(result.output).not.toContain("node_modules");
    });

    it("should ignore .git directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/a.ts": "const hello = 'src';",
        "/project/.git/config": "hello = world",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
      expect(result.output).not.toContain(".git");
    });
  });

  describe("binary files", () => {
    it("should skip binary files", async () => {
      const binaryContent = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x00, 0x68, 0x65, 0x6c, 0x6c, 0x6f,
      ]); // Contains "hello" but also null bytes

      const mockContainer = createMockWebContainer({
        "/project/text.ts": "const hello = 'text';",
        "/project/binary.dat": binaryContent,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await GrepTool.execute(
        { pattern: "hello" },
        createMockContext()
      );

      expect(result.metadata.matches).toBe(1);
      expect(result.output).toContain("text.ts");
      expect(result.output).not.toContain("binary.dat");
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        GrepTool.execute({ pattern: "test" }, createMockContext())
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error when pattern is empty", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        GrepTool.execute({ pattern: "" }, createMockContext())
      ).rejects.toThrow();
    });
  });
});

describe("GrepTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have GrepTool registered by default", () => {
    expect(ToolRegistry.has("grep")).toBe(true);
  });

  it("should get GrepTool by ID", () => {
    const tool = ToolRegistry.get("grep");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("grep");
  });

  it("should include grep in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("grep");
  });
});
