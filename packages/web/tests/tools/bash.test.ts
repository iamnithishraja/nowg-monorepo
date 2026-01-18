import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BashTool } from "../../app/tools/bash";
import { WebContainerProvider } from "../../app/tools/webcontainer-provider";
import { ToolRegistry } from "../../app/tools/registry";
import type { Tool } from "../../app/tools/tool";

// Mock process output
interface MockProcess {
  output: ReadableStream<Uint8Array>;
  exit: Promise<number>;
  kill: () => void;
}

// Helper to create a mock ReadableStream
function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;
  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// Create a mock WebContainer that can spawn processes
function createMockWebContainer(
  spawnBehavior: (
    cmd: string,
    args: string[],
    opts: { cwd: string; env: Record<string, string> }
  ) => {
    output: string[];
    exitCode: number;
    delay?: number;
  }
) {
  const mockSpawn = vi.fn(
    async (
      cmd: string,
      args: string[],
      opts: { cwd: string; env: Record<string, string> }
    ): Promise<MockProcess> => {
      const behavior = spawnBehavior(cmd, args, opts);
      let killed = false;

      return {
        output: createMockStream(behavior.output),
        exit: new Promise<number>((resolve) => {
          const delay = behavior.delay || 10;
          setTimeout(() => {
            resolve(killed ? 137 : behavior.exitCode);
          }, delay);
        }),
        kill: () => {
          killed = true;
        },
      };
    }
  );

  return {
    spawn: mockSpawn,
    fs: {
      readdir: vi.fn(async () => []),
      stat: vi.fn(async () => ({
        isDirectory: () => true,
        isFile: () => false,
      })),
    },
  };
}

// Create a mock context
function createMockContext(options?: { abort?: AbortController }): Tool.Context {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    metadata: vi.fn(),
    abort: options?.abort?.signal,
  };
}

describe("BashTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("basic command execution", () => {
    it("should execute a simple command", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: ["hello world\n"],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "echo hello world", description: "Prints hello world" },
        createMockContext()
      );

      expect(result.title).toBe("Prints hello world");
      expect(result.output).toContain("hello world");
      expect(result.metadata.exit).toBe(0);
    });

    it("should capture command output", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: ["line1\n", "line2\n", "line3\n"],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "cat file.txt", description: "Reads file content" },
        createMockContext()
      );

      expect(result.output).toContain("line1");
      expect(result.output).toContain("line2");
      expect(result.output).toContain("line3");
    });

    it("should return exit code on failure", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: ["command not found: nonexistent\n"],
        exitCode: 127,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "nonexistent", description: "Runs nonexistent command" },
        createMockContext()
      );

      expect(result.metadata.exit).toBe(127);
      expect(result.output).toContain("command not found");
    });
  });

  describe("working directory", () => {
    it("should use project root by default", async () => {
      let capturedOpts: any;
      const mockContainer = createMockWebContainer((cmd, args, opts) => {
        capturedOpts = opts;
        return { output: ["ok\n"], exitCode: 0 };
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await BashTool.execute(
        { command: "pwd", description: "Shows current directory" },
        createMockContext()
      );

      expect(capturedOpts.cwd).toBe("/project");
    });

    it("should use specified workdir", async () => {
      let capturedOpts: any;
      const mockContainer = createMockWebContainer((cmd, args, opts) => {
        capturedOpts = opts;
        return { output: ["ok\n"], exitCode: 0 };
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await BashTool.execute(
        {
          command: "ls",
          workdir: "src/components",
          description: "Lists components directory",
        },
        createMockContext()
      );

      expect(capturedOpts.cwd).toBe("/project/src/components");
    });

    it("should handle absolute paths in workdir", async () => {
      let capturedOpts: any;
      const mockContainer = createMockWebContainer((cmd, args, opts) => {
        capturedOpts = opts;
        return { output: ["ok\n"], exitCode: 0 };
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await BashTool.execute(
        {
          command: "ls",
          workdir: "/src",
          description: "Lists src directory",
        },
        createMockContext()
      );

      expect(capturedOpts.cwd).toBe("/project/src");
    });
  });

  describe("timeout handling", () => {
    it("should terminate command on timeout", async () => {
      let killed = false;
      const mockContainer = {
        spawn: vi.fn(async () => ({
          output: createMockStream([]),
          exit: new Promise<number>((resolve) => {
            // Never resolves naturally - will be killed
            setTimeout(() => resolve(killed ? 137 : 0), 60000);
          }),
          kill: () => {
            killed = true;
          },
        })),
        fs: { readdir: vi.fn(), stat: vi.fn() },
      };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        {
          command: "sleep 60",
          timeout: 100,
          description: "Sleeps for 60 seconds",
        },
        createMockContext()
      );

      expect(result.output).toContain("timeout");
      expect(killed).toBe(true);
    }, 10000);

    it("should use default timeout when not specified", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: ["done\n"],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      // This should not throw since the command completes quickly
      const result = await BashTool.execute(
        { command: "echo done", description: "Quick echo" },
        createMockContext()
      );

      expect(result.metadata.exit).toBe(0);
    });

    it("should throw error for negative timeout", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: [],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        BashTool.execute(
          {
            command: "echo test",
            timeout: -100,
            description: "Test with negative timeout",
          },
          createMockContext()
        )
      ).rejects.toThrow("Invalid timeout value");
    });
  });

  describe("abort handling", () => {
    it("should abort command when signal is triggered", async () => {
      let killed = false;
      const abortController = new AbortController();
      
      const mockContainer = {
        spawn: vi.fn(async () => ({
          output: createMockStream([]),
          exit: new Promise<number>((resolve) => {
            setTimeout(() => resolve(killed ? 137 : 0), 5000);
          }),
          kill: () => {
            killed = true;
          },
        })),
        fs: { readdir: vi.fn(), stat: vi.fn() },
      };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      // Abort shortly after starting
      setTimeout(() => abortController.abort(), 50);

      const result = await BashTool.execute(
        { command: "sleep 10", description: "Long sleep" },
        createMockContext({ abort: abortController })
      );

      expect(result.output).toContain("aborted");
      expect(killed).toBe(true);
    }, 10000);

    it("should handle already aborted signal", async () => {
      let killed = false;
      const abortController = new AbortController();
      abortController.abort(); // Abort before starting

      const mockContainer = {
        spawn: vi.fn(async () => ({
          output: createMockStream([]),
          exit: new Promise<number>((resolve) => {
            setTimeout(() => resolve(killed ? 137 : 0), 100);
          }),
          kill: () => {
            killed = true;
          },
        })),
        fs: { readdir: vi.fn(), stat: vi.fn() },
      };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "echo test", description: "Test command" },
        createMockContext({ abort: abortController })
      );

      expect(result.output).toContain("aborted");
      expect(killed).toBe(true);
    });
  });

  describe("output handling", () => {
    it("should update metadata during execution", async () => {
      const metadataFn = vi.fn();
      const mockContainer = createMockWebContainer(() => ({
        output: ["chunk1\n", "chunk2\n", "chunk3\n"],
        exitCode: 0,
        delay: 50,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await BashTool.execute(
        { command: "cat large-file.txt", description: "Reads large file" },
        {
          sessionID: "test-session",
          messageID: "test-message",
          metadata: metadataFn,
        }
      );

      // Metadata should be called multiple times during streaming
      expect(metadataFn).toHaveBeenCalled();
    });

    it("should truncate very long output", async () => {
      const longOutput = "x".repeat(60000);
      const mockContainer = createMockWebContainer(() => ({
        output: [longOutput],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "cat huge-file.txt", description: "Reads huge file" },
        createMockContext()
      );

      expect(result.output).toContain("truncated");
      expect(result.output.length).toBeLessThan(60000);
    });
  });

  describe("shell command handling", () => {
    it("should execute command through sh -c", async () => {
      let capturedArgs: string[] = [];
      const mockContainer = {
        spawn: vi.fn(async (cmd: string, args: string[]) => {
          capturedArgs = args;
          return {
            output: createMockStream(["ok\n"]),
            exit: Promise.resolve(0),
            kill: () => {},
          };
        }),
        fs: { readdir: vi.fn(), stat: vi.fn() },
      };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await BashTool.execute(
        { command: "ls -la && echo done", description: "Lists and echoes" },
        createMockContext()
      );

      expect(mockContainer.spawn).toHaveBeenCalledWith(
        "sh",
        ["-c", "ls -la && echo done"],
        expect.any(Object)
      );
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        BashTool.execute(
          { command: "echo test", description: "Test command" },
          createMockContext()
        )
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error when command is empty", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: [],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        BashTool.execute({ command: "", description: "Empty command" }, createMockContext())
      ).rejects.toThrow();
    });

    it("should handle spawn errors gracefully", async () => {
      const mockContainer = {
        spawn: vi.fn(async () => {
          throw new Error("Spawn failed");
        }),
        fs: { readdir: vi.fn(), stat: vi.fn() },
      };
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "failing-command", description: "Failing command" },
        createMockContext()
      );

      expect(result.output).toContain("Error");
      expect(result.metadata.exit).toBe(1);
    });
  });

  describe("description parameter", () => {
    it("should use description as title", async () => {
      const mockContainer = createMockWebContainer(() => ({
        output: ["result\n"],
        exitCode: 0,
      }));
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await BashTool.execute(
        { command: "npm install", description: "Installs dependencies" },
        createMockContext()
      );

      expect(result.title).toBe("Installs dependencies");
      expect(result.metadata.description).toBe("Installs dependencies");
    });
  });
});

describe("BashTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have BashTool registered by default", () => {
    expect(ToolRegistry.has("bash")).toBe(true);
  });

  it("should get BashTool by ID", () => {
    const tool = ToolRegistry.get("bash");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("bash");
  });

  it("should include bash in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("bash");
  });
});
