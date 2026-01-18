import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReadTool } from "../../app/tools/read";
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
      if (entries.length === 0 && !Object.keys(files).some(f => f.startsWith(path))) {
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
      // Check if it's a directory
      const isDir = Object.keys(files).some(f => f.startsWith(path + "/"));
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

describe("ReadTool", () => {
  beforeEach(() => {
    // Reset the provider before each test
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic file reading", () => {
    it("should read a simple text file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/test.txt": "hello world",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "test.txt" },
        createMockContext()
      );

      expect(result.title).toBe("test.txt");
      expect(result.output).toContain("hello world");
      expect(result.output).toContain("<file>");
      expect(result.output).toContain("</file>");
      expect(result.metadata.truncated).toBe(false);
    });

    it("should read a file with line numbers", async () => {
      const content = "line1\nline2\nline3";
      const mockContainer = createMockWebContainer({
        "/project/multi.txt": content,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "multi.txt" },
        createMockContext()
      );

      expect(result.output).toContain("00001| line1");
      expect(result.output).toContain("00002| line2");
      expect(result.output).toContain("00003| line3");
      expect(result.metadata.totalLines).toBe(3);
    });

    it("should handle absolute paths starting with /", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/App.tsx": "export default function App() {}",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "/src/App.tsx" },
        createMockContext()
      );

      expect(result.title).toBe("src/App.tsx");
      expect(result.output).toContain("export default function App()");
    });

    it("should handle empty files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/empty.txt": "",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "empty.txt" },
        createMockContext()
      );

      expect(result.output).toContain("File is empty");
      expect(result.metadata.truncated).toBe(false);
    });
  });

  describe("offset and limit", () => {
    it("should respect the offset parameter", async () => {
      const lines = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n");
      const mockContainer = createMockWebContainer({
        "/project/lines.txt": lines,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "lines.txt", offset: 10, limit: 5 },
        createMockContext()
      );

      expect(result.output).toContain("line10");
      expect(result.output).toContain("line14");
      expect(result.output).not.toContain("00001|");
      expect(result.output).not.toContain("line15");
    });

    it("should respect the limit parameter", async () => {
      const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join("\n");
      const mockContainer = createMockWebContainer({
        "/project/many.txt": lines,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "many.txt", limit: 10 },
        createMockContext()
      );

      expect(result.output).toContain("line0");
      expect(result.output).toContain("line9");
      expect(result.output).not.toContain("line10");
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("File has more lines");
    });
  });

  describe("truncation", () => {
    it("should truncate long lines", async () => {
      const longLine = "x".repeat(3000);
      const mockContainer = createMockWebContainer({
        "/project/long-line.txt": longLine,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "long-line.txt" },
        createMockContext()
      );

      expect(result.output).toContain("...");
      expect(result.output.length).toBeLessThan(3000);
    });

    it("should truncate output when exceeding byte limit", async () => {
      // Create a file that will exceed 50KB
      const lines = Array.from({ length: 10000 }, (_, i) => `line ${i}: ${"x".repeat(50)}`).join("\n");
      const mockContainer = createMockWebContainer({
        "/project/large.txt": lines,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "large.txt" },
        createMockContext()
      );

      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("Output truncated at");
    });

    it("should set truncated to false for small files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/small.txt": "hello",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "small.txt" },
        createMockContext()
      );

      expect(result.metadata.truncated).toBe(false);
      expect(result.output).toContain("End of file");
    });
  });

  describe("error handling", () => {
    it("should throw error for non-existent file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/other.txt": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ReadTool.execute({ filePath: "nonexistent.txt" }, createMockContext())
      ).rejects.toThrow("File not found: nonexistent.txt");
    });

    it("should suggest similar files when file not found", async () => {
      // Create a mock with files - the suggestion algorithm checks for substring matches
      // So we need "app" to be a substring of "App.tsx" (case-insensitive)
      const files = {
        "/project/App.tsx": "content",
        "/project/AppConfig.ts": "content",
        "/project/main.ts": "content",
      };
      
      const mockFs = {
        readFile: vi.fn(async (path: string) => {
          const content = files[path as keyof typeof files];
          if (content === undefined) {
            throw new Error(`ENOENT: no such file or directory, open '${path}'`);
          }
          return new TextEncoder().encode(content);
        }),
        readdir: vi.fn(async (dirPath: string) => {
          // For the /project directory, return the file names
          if (dirPath === "/project") {
            return ["App.tsx", "AppConfig.ts", "main.ts"];
          }
          throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
        }),
        stat: vi.fn(async (path: string) => {
          if (files[path as keyof typeof files] !== undefined) {
            return { isDirectory: () => false, isFile: () => true };
          }
          throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
        }),
      };
      
      const mockContainer = { fs: mockFs };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      // Search for "app.ts" - should suggest "App.tsx" and "AppConfig.ts" since they contain "app"
      await expect(
        ReadTool.execute({ filePath: "app.ts" }, createMockContext())
      ).rejects.toThrow("Did you mean");
    });

    it("should throw error for directories", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ReadTool.execute({ filePath: "src" }, createMockContext())
      ).rejects.toThrow("Cannot read directory");
    });

    it("should throw error for binary files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/file.exe": "binary content",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ReadTool.execute({ filePath: "file.exe" }, createMockContext())
      ).rejects.toThrow("Cannot read binary file");
    });

    it("should throw error when WebContainer is not available", async () => {
      // Don't set a container - ReadTool now has a 1 second timeout
      // which is acceptable for this test

      await expect(
        ReadTool.execute({ filePath: "test.txt" }, createMockContext())
      ).rejects.toThrow("WebContainer is not available");
    }, 5000); // 5 second test timeout to allow for the 1 second container wait
  });

  describe("image files", () => {
    it("should handle PNG files as attachments", async () => {
      // 1x1 red PNG
      const pngData = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        ),
        (c) => c.charCodeAt(0)
      );

      const mockContainer = createMockWebContainer({
        "/project/image.png": pngData,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "image.png" },
        createMockContext()
      );

      expect(result.output).toBe("Image read successfully");
      expect(result.metadata.truncated).toBe(false);
      expect(result.attachments).toBeDefined();
      expect(result.attachments?.length).toBe(1);
      expect(result.attachments?.[0].type).toBe("file");
      expect(result.attachments?.[0].mime).toBe("image/png");
      expect(result.attachments?.[0].url).toMatch(/^data:image\/png;base64,/);
    });

    it("should handle JPEG files as attachments", async () => {
      // Minimal JPEG
      const jpegData = new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);

      const mockContainer = createMockWebContainer({
        "/project/photo.jpg": jpegData,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await ReadTool.execute(
        { filePath: "photo.jpg" },
        createMockContext()
      );

      expect(result.attachments?.[0].mime).toBe("image/jpeg");
    });
  });

  describe("binary content detection", () => {
    it("should detect binary content with null bytes", async () => {
      const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x00]);

      const mockContainer = createMockWebContainer({
        "/project/binary.dat": binaryContent,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        ReadTool.execute({ filePath: "binary.dat" }, createMockContext())
      ).rejects.toThrow("Cannot read binary file");
    });
  });
});

describe("ToolRegistry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have ReadTool registered by default", () => {
    expect(ToolRegistry.has("read")).toBe(true);
  });

  it("should get ReadTool by ID", () => {
    const tool = ToolRegistry.get("read");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("read");
  });

  it("should return all tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("read");
  });

  it("should register a custom tool", () => {
    const customTool = {
      id: "custom",
      description: "A custom tool",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    };

    ToolRegistry.register(customTool);
    expect(ToolRegistry.has("custom")).toBe(true);
    expect(ToolRegistry.get("custom")).toBe(customTool);
  });

  it("should throw when registering duplicate tool without force", () => {
    const tool1 = {
      id: "duplicate",
      description: "First",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    };
    const tool2 = {
      id: "duplicate",
      description: "Second",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    };

    ToolRegistry.register(tool1);
    expect(() => ToolRegistry.register(tool2)).toThrow("already exists");
  });

  it("should allow force override of existing tool", () => {
    const tool1 = {
      id: "override",
      description: "First",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    };
    const tool2 = {
      id: "override",
      description: "Second",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    };

    ToolRegistry.register(tool1);
    ToolRegistry.register(tool2, true);
    expect(ToolRegistry.get("override")?.description).toBe("Second");
  });

  it("should unregister a tool", () => {
    ToolRegistry.register({
      id: "temp",
      description: "Temporary",
      parameters: {} as any,
      execute: async () => ({ title: "", output: "", metadata: {} }),
    });

    expect(ToolRegistry.has("temp")).toBe(true);
    ToolRegistry.unregister("temp");
    expect(ToolRegistry.has("temp")).toBe(false);
  });
});

describe("WebContainerProvider", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    WebContainerProvider.resetInstance();
  });

  it("should be a singleton", () => {
    const instance1 = WebContainerProvider.getInstance();
    const instance2 = WebContainerProvider.getInstance();
    expect(instance1).toBe(instance2);
  });

  it("should start without a container", () => {
    const provider = WebContainerProvider.getInstance();
    expect(provider.isAvailable()).toBe(false);
    expect(provider.getContainerSync()).toBeNull();
  });

  it("should set and get container", () => {
    const provider = WebContainerProvider.getInstance();
    const mockContainer = { fs: {} } as any;

    provider.setContainer(mockContainer);

    expect(provider.isAvailable()).toBe(true);
    expect(provider.getContainerSync()).toBe(mockContainer);
  });

  it("should notify listeners when container changes", () => {
    const provider = WebContainerProvider.getInstance();
    const listener = vi.fn();
    const mockContainer = { fs: {} } as any;

    provider.subscribe(listener);
    provider.setContainer(mockContainer);

    expect(listener).toHaveBeenCalledWith(mockContainer);
  });

  it("should unsubscribe listeners", () => {
    const provider = WebContainerProvider.getInstance();
    const listener = vi.fn();
    const mockContainer = { fs: {} } as any;

    const unsubscribe = provider.subscribe(listener);
    unsubscribe();
    provider.setContainer(mockContainer);

    // Listener should not be called after unsubscribe
    expect(listener).not.toHaveBeenCalledWith(mockContainer);
  });

  it("should wait for container with timeout", async () => {
    const provider = WebContainerProvider.getInstance();
    const mockContainer = { fs: {} } as any;

    // Set container after a delay
    setTimeout(() => {
      provider.setContainer(mockContainer);
    }, 100);

    const container = await provider.getContainer(5000);
    expect(container).toBe(mockContainer);
  });

  it("should return null on timeout", async () => {
    const provider = WebContainerProvider.getInstance();

    const container = await provider.getContainer(100);
    expect(container).toBeNull();
  });

  it("should reset instance properly", () => {
    const provider1 = WebContainerProvider.getInstance();
    provider1.setContainer({ fs: {} } as any);

    WebContainerProvider.resetInstance();

    const provider2 = WebContainerProvider.getInstance();
    expect(provider2).not.toBe(provider1);
    expect(provider2.isAvailable()).toBe(false);
  });
});
