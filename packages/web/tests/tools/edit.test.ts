import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EditTool, replace } from "../../app/tools/edit";
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

describe("EditTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic editing", () => {
    it("should replace a simple string", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await EditTool.execute(
        {
          filePath: "test.ts",
          oldString: "hello",
          newString: "greeting",
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
      expect(result.metadata.diff).toContain("-");
      expect(result.metadata.diff).toContain("+");
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "const greeting = 'world';"
      );
    });

    it("should replace multi-line content", async () => {
      const original = `function foo() {
  console.log("hello");
  return true;
}`;
      const mockContainer = createMockWebContainer({
        "/project/test.ts": original,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await EditTool.execute(
        {
          filePath: "test.ts",
          oldString: 'console.log("hello");',
          newString: 'console.log("world");',
        },
        createMockContext()
      );

      expect(result.metadata.additions).toBeGreaterThan(0);
    });

    it("should handle replaceAll option", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const a = 1;\nconst b = 1;\nconst c = 1;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await EditTool.execute(
        {
          filePath: "test.ts",
          oldString: "const",
          newString: "let",
          replaceAll: true,
        },
        createMockContext()
      );

      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "let a = 1;\nlet b = 1;\nlet c = 1;"
      );
    });
  });

  describe("creating new files", () => {
    it("should create a new file with empty oldString", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await EditTool.execute(
        {
          filePath: "new-file.ts",
          oldString: "",
          newString: "export const hello = 'world';",
        },
        createMockContext()
      );

      expect(result.title).toBe("new-file.ts");
      expect(result.output).toContain("Created new file");
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/new-file.ts",
        "export const hello = 'world';"
      );
    });

    it("should create parent directories when creating new file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await EditTool.execute(
        {
          filePath: "src/components/Button.tsx",
          oldString: "",
          newString: "export const Button = () => <button />;",
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
    it("should throw error when oldString not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        EditTool.execute(
          {
            filePath: "test.ts",
            oldString: "nonexistent",
            newString: "replacement",
          },
          createMockContext()
        )
      ).rejects.toThrow("oldString not found");
    });

    it("should throw error when oldString equals newString", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const hello = 'world';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        EditTool.execute(
          {
            filePath: "test.ts",
            oldString: "hello",
            newString: "hello",
          },
          createMockContext()
        )
      ).rejects.toThrow("oldString and newString must be different");
    });

    it("should throw error for non-existent file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        EditTool.execute(
          {
            filePath: "nonexistent.ts",
            oldString: "hello",
            newString: "world",
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
        EditTool.execute(
          {
            filePath: "src",
            oldString: "hello",
            newString: "world",
          },
          createMockContext()
        )
      ).rejects.toThrow("Path is a directory");
    });

    it("should throw error when WebContainer is not available", async () => {
      await expect(
        EditTool.execute(
          {
            filePath: "test.ts",
            oldString: "hello",
            newString: "world",
          },
          createMockContext()
        )
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error for multiple matches without replaceAll", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const a = 1;\nconst b = 1;\nconst c = 1;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        EditTool.execute(
          {
            filePath: "test.ts",
            oldString: "const",
            newString: "let",
          },
          createMockContext()
        )
      ).rejects.toThrow("multiple matches");
    });
  });

  describe("path handling", () => {
    it("should handle absolute paths starting with /", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "export default function App() {}",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await EditTool.execute(
        {
          filePath: "/src/App.tsx",
          oldString: "App",
          newString: "MyApp",
          replaceAll: true,
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

      const result = await EditTool.execute(
        {
          filePath: "project/test.ts",
          oldString: "hello",
          newString: "greeting",
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
    });
  });
});

describe("replace function", () => {
  it("should perform simple replacement", () => {
    const result = replace("hello world", "hello", "goodbye");
    expect(result).toBe("goodbye world");
  });

  it("should handle whitespace-normalized matching", () => {
    const content = "const   hello   =   'world';";
    const result = replace(content, "const hello = 'world';", "const greeting = 'world';");
    // Should still work with whitespace differences
    expect(result).toContain("greeting");
  });

  it("should handle trimmed matching", () => {
    const content = "  hello world  ";
    const result = replace(content, "hello world", "goodbye world");
    expect(result).toBe("  goodbye world  ");
  });

  it("should throw error when not found", () => {
    expect(() => replace("hello", "goodbye", "hi")).toThrow(
      "oldString not found"
    );
  });

  it("should throw error when oldString equals newString", () => {
    expect(() => replace("hello", "hello", "hello")).toThrow(
      "oldString and newString must be different"
    );
  });

  it("should replace all occurrences with replaceAll", () => {
    const result = replace("a b a b a", "a", "x", true);
    expect(result).toBe("x b x b x");
  });
});

describe("EditTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have EditTool registered by default", () => {
    expect(ToolRegistry.has("edit")).toBe(true);
  });

  it("should get EditTool by ID", () => {
    const tool = ToolRegistry.get("edit");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("edit");
  });

  it("should include edit in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("edit");
  });
});
