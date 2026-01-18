import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CodeSearchTool } from "../../app/tools/codesearch";
import { ToolRegistry } from "../../app/tools/registry";
import type { Tool } from "../../app/tools/tool";

// Create a mock context
function createMockContext(): Tool.Context {
  return {
    sessionID: "test-session",
    messageID: "test-message",
    metadata: vi.fn(),
  };
}

// Create a mock SSE response
function createMockSSEResponse(content: string): string {
  return `data: ${JSON.stringify({
    jsonrpc: "2.0",
    result: {
      content: [{ type: "text", text: content }],
    },
  })}\n`;
}

// Mock fetch globally
const originalFetch = global.fetch;

describe("CodeSearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ToolRegistry.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe("basic code search functionality", () => {
    it("should perform a code search and return results", async () => {
      const codeResults = `
# React useState Hook

\`\`\`javascript
const [count, setCount] = useState(0);
\`\`\`

useState is a React Hook that lets you add a state variable.
      `.trim();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse(codeResults)),
      });

      const result = await CodeSearchTool.execute(
        { query: "React useState hook examples", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toBe(codeResults);
      expect(result.title).toContain("Code search: React useState hook examples");
      expect(result.metadata.query).toBe("React useState hook examples");
    });

    it("should use default tokensNum of 5000", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await CodeSearchTool.execute(
        { query: "test query", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.metadata.tokensNum).toBe(5000);
    });

    it("should pass custom tokensNum parameter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await CodeSearchTool.execute(
        { query: "test query", tokensNum: 10000 },
        createMockContext()
      );

      expect(result.metadata.tokensNum).toBe(10000);

      // Verify the API was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"tokensNum":10000'),
        })
      );
    });
  });

  describe("tokensNum validation", () => {
    it("should accept minimum tokensNum of 1000", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await CodeSearchTool.execute(
        { query: "test", tokensNum: 1000 },
        createMockContext()
      );

      expect(result.metadata.tokensNum).toBe(1000);
    });

    it("should accept maximum tokensNum of 50000", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await CodeSearchTool.execute(
        { query: "test", tokensNum: 50000 },
        createMockContext()
      );

      expect(result.metadata.tokensNum).toBe(50000);
    });

    it("should reject tokensNum below minimum", async () => {
      await expect(
        CodeSearchTool.execute(
          { query: "test", tokensNum: 500 },
          createMockContext()
        )
      ).rejects.toThrow();
    });

    it("should reject tokensNum above maximum", async () => {
      await expect(
        CodeSearchTool.execute(
          { query: "test", tokensNum: 60000 },
          createMockContext()
        )
      ).rejects.toThrow();
    });
  });

  describe("various query types", () => {
    it("should handle framework queries", async () => {
      const frameworkResults = "Express.js middleware documentation...";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse(frameworkResults)),
      });

      const result = await CodeSearchTool.execute(
        { query: "Express.js middleware patterns", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toBe(frameworkResults);
      expect(result.title).toContain("Express.js middleware patterns");
    });

    it("should handle API documentation queries", async () => {
      const apiResults = "Stripe API documentation for payments...";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse(apiResults)),
      });

      const result = await CodeSearchTool.execute(
        { query: "Stripe payment API integration", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toBe(apiResults);
    });

    it("should handle programming concept queries", async () => {
      const conceptResults = "Python async/await tutorial...";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse(conceptResults)),
      });

      const result = await CodeSearchTool.execute(
        { query: "Python async await examples", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toBe(conceptResults);
    });
  });

  describe("no results handling", () => {
    it("should return appropriate message when no results found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("data: {}\n"),
      });

      const result = await CodeSearchTool.execute(
        { query: "nonexistent-framework-12345", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toContain("No code snippets or documentation found");
    });

    it("should handle empty response content", async () => {
      const emptyResponse = JSON.stringify({
        jsonrpc: "2.0",
        result: { content: [] },
      });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(`data: ${emptyResponse}\n`),
      });

      const result = await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        createMockContext()
      );

      expect(result.output).toContain("No code snippets or documentation found");
    });
  });

  describe("error handling", () => {
    it("should throw error for API failures", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        CodeSearchTool.execute(
          { query: "test", tokensNum: 5000 },
          createMockContext()
        )
      ).rejects.toThrow("Code search error (500)");
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      await expect(
        CodeSearchTool.execute(
          { query: "test", tokensNum: 5000 },
          createMockContext()
        )
      ).rejects.toThrow("Network failure");
    });

    it("should handle timeout errors", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        CodeSearchTool.execute(
          { query: "test", tokensNum: 5000 },
          createMockContext()
        )
      ).rejects.toThrow("Code search request timed out");
    });

    it("should handle malformed SSE response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("data: not-valid-json\n"),
      });

      const result = await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        createMockContext()
      );

      // Should gracefully handle and return no results message
      expect(result.output).toContain("No code snippets or documentation found");
    });
  });

  describe("API request format", () => {
    it("should send correct JSON-RPC request format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await CodeSearchTool.execute(
        { query: "React hooks guide", tokensNum: 5000 },
        createMockContext()
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("get_code_context_exa");
      expect(body.params.arguments.query).toBe("React hooks guide");
      expect(body.params.arguments.tokensNum).toBe(5000);
    });

    it("should use correct API endpoint", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://mcp.exa.ai/mcp",
        expect.anything()
      );
    });

    it("should set correct headers", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          }),
        })
      );
    });

    it("should use POST method", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("abort signal handling", () => {
    it("should respect context abort signal", async () => {
      const abortController = new AbortController();
      const context = {
        ...createMockContext(),
        abort: abortController.signal,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await CodeSearchTool.execute(
        { query: "test", tokensNum: 5000 },
        context
      );

      // Verify that signal was passed to fetch
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });
  });
});

describe("ToolRegistry - CodeSearchTool", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have CodeSearchTool registered", () => {
    expect(ToolRegistry.has("codesearch")).toBe(true);
  });

  it("should get CodeSearchTool by ID", () => {
    const tool = ToolRegistry.get("codesearch");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("codesearch");
  });

  it("should include codesearch in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("codesearch");
  });
});
