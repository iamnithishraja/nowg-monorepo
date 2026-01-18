import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BatchTool } from "../../app/tools/batch";
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

describe("BatchTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
    ToolRegistry.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic batch execution", () => {
    it("should execute multiple read calls in parallel", async () => {
      const mockContainer = createMockWebContainer({
        "/project/file1.ts": "content1",
        "/project/file2.ts": "content2",
        "/project/file3.ts": "content3",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "file1.ts" } },
            { tool: "read", parameters: { filePath: "file2.ts" } },
            { tool: "read", parameters: { filePath: "file3.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.totalCalls).toBe(3);
      expect(result.metadata.successful).toBe(3);
      expect(result.metadata.failed).toBe(0);
      expect(result.output).toContain("All 3 tools executed successfully");
    });

    it("should execute different tools in parallel", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "const hello = 'world';",
        "/project/package.json": '{"name": "test"}',
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "package.json" } },
            { tool: "glob", parameters: { pattern: "**/*.ts" } },
            { tool: "list", parameters: {} },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.totalCalls).toBe(3);
      expect(result.metadata.successful).toBe(3);
      expect(result.metadata.tools).toContain("read");
      expect(result.metadata.tools).toContain("glob");
      expect(result.metadata.tools).toContain("list");
    });

    it("should handle single tool call", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [{ tool: "read", parameters: { filePath: "test.ts" } }],
        },
        createMockContext()
      );

      expect(result.metadata.totalCalls).toBe(1);
      expect(result.metadata.successful).toBe(1);
    });
  });

  describe("error handling", () => {
    it("should handle partial failures", async () => {
      const mockContainer = createMockWebContainer({
        "/project/exists.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "exists.ts" } },
            { tool: "read", parameters: { filePath: "nonexistent.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.totalCalls).toBe(2);
      expect(result.metadata.successful).toBe(1);
      expect(result.metadata.failed).toBe(1);
      expect(result.output).toContain("1/2 tools successfully");
      expect(result.output).toContain("Failed calls:");
    });

    it("should handle all failures", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "file1.ts" } },
            { tool: "read", parameters: { filePath: "file2.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.successful).toBe(0);
      expect(result.metadata.failed).toBe(2);
    });

    it("should reject unknown tools", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "unknown_tool", parameters: {} },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.failed).toBe(1);
      expect(result.output).toContain("not found");
    });

    it("should reject batch tool within batch", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            {
              tool: "batch",
              parameters: {
                tool_calls: [{ tool: "read", parameters: { filePath: "test.ts" } }],
              },
            },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.failed).toBe(1);
      expect(result.output).toContain("not allowed in batch");
    });
  });

  describe("batch size limits", () => {
    it("should limit to 10 tool calls", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 15; i++) {
        files[`/project/file${i}.ts`] = `content${i}`;
      }

      const mockContainer = createMockWebContainer(files);
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const toolCalls = Array.from({ length: 15 }, (_, i) => ({
        tool: "read",
        parameters: { filePath: `file${i}.ts` },
      }));

      const result = await BatchTool.execute(
        { tool_calls: toolCalls },
        createMockContext()
      );

      // 10 should succeed, 5 should fail due to limit
      expect(result.metadata.totalCalls).toBe(15);
      expect(result.metadata.successful).toBe(10);
      expect(result.metadata.failed).toBe(5);
      expect(result.output).toContain("Maximum of 10 tools allowed");
    });

    it("should execute exactly 10 calls when at limit", async () => {
      const files: Record<string, string> = {};
      for (let i = 0; i < 10; i++) {
        files[`/project/file${i}.ts`] = `content${i}`;
      }

      const mockContainer = createMockWebContainer(files);
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const toolCalls = Array.from({ length: 10 }, (_, i) => ({
        tool: "read",
        parameters: { filePath: `file${i}.ts` },
      }));

      const result = await BatchTool.execute(
        { tool_calls: toolCalls },
        createMockContext()
      );

      expect(result.metadata.totalCalls).toBe(10);
      expect(result.metadata.successful).toBe(10);
      expect(result.metadata.failed).toBe(0);
    });
  });

  describe("execution timing", () => {
    it("should report execution times for each call", async () => {
      const mockContainer = createMockWebContainer({
        "/project/file1.ts": "content1",
        "/project/file2.ts": "content2",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "file1.ts" } },
            { tool: "read", parameters: { filePath: "file2.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.output).toContain("Execution times:");
      expect(result.metadata.details[0].duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.details[1].duration).toBeGreaterThanOrEqual(0);
    });

    it("should show success/failure indicators", async () => {
      const mockContainer = createMockWebContainer({
        "/project/exists.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "exists.ts" } },
            { tool: "read", parameters: { filePath: "missing.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.output).toContain("✓");
      expect(result.output).toContain("✗");
    });
  });

  describe("metadata", () => {
    it("should include all tool names in metadata", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "test.ts" } },
            { tool: "list", parameters: {} },
            { tool: "glob", parameters: { pattern: "*.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.tools).toEqual(["read", "list", "glob"]);
    });

    it("should include details for each call", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BatchTool.execute(
        {
          tool_calls: [
            { tool: "read", parameters: { filePath: "test.ts" } },
            { tool: "read", parameters: { filePath: "missing.ts" } },
          ],
        },
        createMockContext()
      );

      expect(result.metadata.details).toHaveLength(2);
      expect(result.metadata.details[0].tool).toBe("read");
      expect(result.metadata.details[0].success).toBe(true);
      expect(result.metadata.details[1].tool).toBe("read");
      expect(result.metadata.details[1].success).toBe(false);
      expect(result.metadata.details[1].error).toBeDefined();
    });
  });

  describe("validation", () => {
    it("should require at least one tool call", async () => {
      const mockContainer = createMockWebContainer({});
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        BatchTool.execute({ tool_calls: [] }, createMockContext())
      ).rejects.toThrow();
    });
  });
});

describe("BatchTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have BatchTool registered by default", () => {
    expect(ToolRegistry.has("batch")).toBe(true);
  });

  it("should get BatchTool by ID", () => {
    const tool = ToolRegistry.get("batch");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("batch");
  });

  it("should include batch in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("batch");
  });
});
