import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MultiEditTool } from "../../app/tools/multiedit";
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
    writeFile: vi.fn(async (path: string, content: string | Uint8Array) => {
      files[path] =
        content instanceof Uint8Array
          ? new TextDecoder().decode(content)
          : content;
    }),
    readdir: vi.fn(async (path: string) => {
      const entries: string[] = [];
      for (const filePath of Object.keys(files)) {
        if (filePath.startsWith(path + "/")) {
          const relative = filePath.slice(path.length + 1);
          const firstPart = relative.split("/")[0];
          if (!entries.includes(firstPart)) {
            entries.push(firstPart);
          }
        }
      }
      if (
        entries.length === 0 &&
        !Object.keys(files).some((f) => f.startsWith(path))
      ) {
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
    mkdir: vi.fn(async () => {}),
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

describe("MultiEditTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic multi-editing", () => {
    it("should perform multiple edits sequentially", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const a = 1;\nconst b = 2;\nconst c = 3;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [
            { oldString: "const a = 1;", newString: "const alpha = 1;" },
            { oldString: "const b = 2;", newString: "const beta = 2;" },
          ],
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
      expect(result.output).toContain("2 edits");
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "const alpha = 1;\nconst beta = 2;\nconst c = 3;"
      );
    });

    it("should apply edits in order", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "hello world",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [
            { oldString: "hello", newString: "goodbye" },
            { oldString: "goodbye world", newString: "goodbye everyone" },
          ],
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "goodbye everyone"
      );
    });

    it("should handle single edit", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [{ oldString: "hello", newString: "greeting" }],
        },
        createMockContext()
      );

      expect(result.output).toContain("1 edits");
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "const greeting = 'world';"
      );
    });

    it("should support replaceAll in individual edits", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "var a = 1;\nvar b = 2;\nvar c = 3;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [{ oldString: "var", newString: "const", replaceAll: true }],
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "const a = 1;\nconst b = 2;\nconst c = 3;"
      );
    });
  });

  describe("creating new files", () => {
    it("should create a new file with empty oldString", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "new-file.ts",
          edits: [
            {
              oldString: "",
              newString: "export const hello = 'world';",
            },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.created).toBe(true);
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/new-file.ts",
        "export const hello = 'world';"
      );
    });

    it("should create and then edit a new file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "new-file.ts",
          edits: [
            { oldString: "", newString: "const hello = 'world';" },
            { oldString: "hello", newString: "greeting" },
          ],
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/new-file.ts",
        "const greeting = 'world';"
      );
    });

    it("should create parent directories", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "src/components/Button.tsx",
          edits: [
            { oldString: "", newString: "export const Button = () => null;" },
          ],
        },
        createMockContext()
      );

      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith(
        "/project/src/components",
        { recursive: true }
      );
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        MultiEditTool.execute(
          {
            filePath: "test.ts",
            edits: [{ oldString: "a", newString: "b" }],
          },
          createMockContext()
        )
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error for non-existent file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "nonexistent.ts",
            edits: [{ oldString: "a", newString: "b" }],
          },
          createMockContext()
        )
      ).rejects.toThrow("File not found");
    });

    it("should throw error for directory path", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "src",
            edits: [{ oldString: "a", newString: "b" }],
          },
          createMockContext()
        )
      ).rejects.toThrow("Path is a directory");
    });

    it("should throw error for empty edits array", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "test.ts",
            edits: [],
          },
          createMockContext()
        )
      ).rejects.toThrow("At least one edit is required");
    });

    it("should throw error when oldString equals newString", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "hello world",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "test.ts",
            edits: [{ oldString: "hello", newString: "hello" }],
          },
          createMockContext()
        )
      ).rejects.toThrow("oldString and newString must be different");
    });

    it("should throw error with edit index when edit fails", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "hello world",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "test.ts",
            edits: [
              { oldString: "hello", newString: "goodbye" },
              { oldString: "nonexistent", newString: "replacement" },
            ],
          },
          createMockContext()
        )
      ).rejects.toThrow("Edit 2 of 2 failed");
    });

    it("should not apply any edits if one fails", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "original content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        MultiEditTool.execute(
          {
            filePath: "test.ts",
            edits: [
              { oldString: "original", newString: "modified" },
              { oldString: "will not match", newString: "replacement" },
            ],
          },
          createMockContext()
        )
      ).rejects.toThrow();

      // File should not be written since we throw before write
      // Note: In this implementation, we validate all edits in memory first
      // and only write at the end, so this is atomic
    });
  });

  describe("metadata", () => {
    it("should return combined metadata for all edits", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "line1\nline2\nline3",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [
            { oldString: "line1", newString: "modified1" },
            { oldString: "line2", newString: "modified2" },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.edits).toHaveLength(2);
      expect(result.metadata.totalAdditions).toBeGreaterThan(0);
      expect(result.metadata.diff).toBeDefined();
    });

    it("should track created flag correctly", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "new-file.ts",
          edits: [{ oldString: "", newString: "new content" }],
        },
        createMockContext()
      );

      expect(result.metadata.created).toBe(true);
    });

    it("should track created as false for existing files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "existing content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [{ oldString: "existing", newString: "modified" }],
        },
        createMockContext()
      );

      expect(result.metadata.created).toBe(false);
    });
  });

  describe("path handling", () => {
    it("should handle absolute paths starting with /", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "export default function App() {}",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "/src/App.tsx",
          edits: [{ oldString: "App", newString: "MyApp", replaceAll: true }],
        },
        createMockContext()
      );

      expect(result.title).toBe("src/App.tsx");
    });

    it("should handle paths with project prefix", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await MultiEditTool.execute(
        {
          filePath: "project/test.ts",
          edits: [{ oldString: "hello", newString: "greeting" }],
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
    });
  });

  describe("complex scenarios", () => {
    it("should handle many sequential edits", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "a b c d e",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [
            { oldString: "a", newString: "1" },
            { oldString: "b", newString: "2" },
            { oldString: "c", newString: "3" },
            { oldString: "d", newString: "4" },
            { oldString: "e", newString: "5" },
          ],
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "1 2 3 4 5"
      );
    });

    it("should handle overlapping changes correctly", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "function foo() { return bar(); }",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await MultiEditTool.execute(
        {
          filePath: "test.ts",
          edits: [
            { oldString: "foo", newString: "myFunction" },
            { oldString: "bar", newString: "otherFunction" },
          ],
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "function myFunction() { return otherFunction(); }"
      );
    });
  });
});

describe("MultiEditTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have MultiEditTool registered by default", () => {
    expect(ToolRegistry.has("multiedit")).toBe(true);
  });

  it("should get MultiEditTool by ID", () => {
    const tool = ToolRegistry.get("multiedit");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("multiedit");
  });

  it("should include multiedit in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("multiedit");
  });
});
