import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WriteTool } from "../../app/tools/write";
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

describe("WriteTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("creating new files", () => {
    it("should create a new file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "export const hello = 'world';",
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
      expect(result.output).toContain("Created");
      expect(result.metadata.existed).toBe(false);
      expect(result.metadata.totalLines).toBe(1);
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "export const hello = 'world';"
      );
    });

    it("should create parent directories when needed", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await WriteTool.execute(
        {
          filePath: "src/components/Button.tsx",
          content: "export const Button = () => <button />;",
        },
        createMockContext()
      );

      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith(
        "/project/src/components",
        { recursive: true }
      );
    });

    it("should handle multi-line content", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const content = `function foo() {
  console.log("hello");
  return true;
}`;

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content,
        },
        createMockContext()
      );

      expect(result.metadata.totalLines).toBe(4);
      expect(result.metadata.additions).toBe(4);
    });

    it("should handle empty content", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "empty.txt",
          content: "",
        },
        createMockContext()
      );

      expect(result.metadata.totalLines).toBe(1); // Empty string split produces [""]
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/empty.txt",
        ""
      );
    });
  });

  describe("overwriting existing files", () => {
    it("should overwrite existing file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "const old = 'content';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "const new_content = 'updated';",
        },
        createMockContext()
      );

      expect(result.output).toContain("Updated");
      expect(result.metadata.existed).toBe(true);
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/test.ts",
        "const new_content = 'updated';"
      );
    });

    it("should calculate diff for overwritten file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "line1\nline2\nline3",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "line1\nmodified\nline3",
        },
        createMockContext()
      );

      expect(result.metadata.diff).toContain("-");
      expect(result.metadata.diff).toContain("+");
      expect(result.metadata.additions).toBeGreaterThan(0);
      expect(result.metadata.deletions).toBeGreaterThan(0);
    });

    it("should handle complete file replacement", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "completely different content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "brand new content",
        },
        createMockContext()
      );

      expect(result.metadata.existed).toBe(true);
      expect(result.metadata.additions).toBeGreaterThan(0);
      expect(result.metadata.deletions).toBeGreaterThan(0);
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        WriteTool.execute(
          {
            filePath: "test.ts",
            content: "content",
          },
          createMockContext()
        )
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error when trying to write to a directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        WriteTool.execute(
          {
            filePath: "src",
            content: "content",
          },
          createMockContext()
        )
      ).rejects.toThrow("Cannot write to directory");
    });

    it("should throw error when filePath is missing", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        WriteTool.execute(
          {
            filePath: "",
            content: "content",
          },
          createMockContext()
        )
      ).rejects.toThrow("filePath is required");
    });
  });

  describe("path handling", () => {
    it("should handle absolute paths starting with /", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "/src/App.tsx",
          content: "export default function App() {}",
        },
        createMockContext()
      );

      expect(result.title).toBe("src/App.tsx");
      expect(mockContainer.fs.writeFile).toHaveBeenCalledWith(
        "/project/src/App.tsx",
        "export default function App() {}"
      );
    });

    it("should handle paths with project prefix", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "project/test.ts",
          content: "content",
        },
        createMockContext()
      );

      expect(result.title).toBe("test.ts");
    });

    it("should handle nested paths", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await WriteTool.execute(
        {
          filePath: "deep/nested/path/file.ts",
          content: "content",
        },
        createMockContext()
      );

      expect(mockContainer.fs.mkdir).toHaveBeenCalledWith(
        "/project/deep/nested/path",
        { recursive: true }
      );
    });
  });

  describe("metadata", () => {
    it("should return correct metadata for new file", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "line1\nline2\nline3",
        },
        createMockContext()
      );

      expect(result.metadata.existed).toBe(false);
      expect(result.metadata.totalLines).toBe(3);
      expect(result.metadata.additions).toBe(3);
      expect(result.metadata.deletions).toBe(0);
    });

    it("should return correct metadata for updated file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "old1\nold2",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await WriteTool.execute(
        {
          filePath: "test.ts",
          content: "new1\nnew2\nnew3",
        },
        createMockContext()
      );

      expect(result.metadata.existed).toBe(true);
      expect(result.metadata.totalLines).toBe(3);
    });
  });
});

describe("WriteTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have WriteTool registered by default", () => {
    expect(ToolRegistry.has("write")).toBe(true);
  });

  it("should get WriteTool by ID", () => {
    const tool = ToolRegistry.get("write");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("write");
  });

  it("should include write in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("write");
  });
});
