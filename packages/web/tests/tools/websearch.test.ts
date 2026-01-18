import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSearchTool } from "../../app/tools/websearch";
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

describe("WebSearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ToolRegistry.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe("basic search functionality", () => {
    it("should perform a search and return results", async () => {
      const searchResults = "Result 1: Example\nResult 2: Test content";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse(searchResults)),
      });

      const result = await WebSearchTool.execute(
        { query: "test query" },
        createMockContext()
      );

      expect(result.output).toBe(searchResults);
      expect(result.title).toContain("Web search: test query");
      expect(result.metadata.query).toBe("test query");
    });

    it("should use default parameters", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test query" },
        createMockContext()
      );

      expect(result.metadata.numResults).toBe(8);
      expect(result.metadata.type).toBe("auto");
      expect(result.metadata.livecrawl).toBe("fallback");
    });

    it("should pass custom numResults parameter", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test query", numResults: 15 },
        createMockContext()
      );

      expect(result.metadata.numResults).toBe(15);

      // Verify the API was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"numResults":15'),
        })
      );
    });
  });

  describe("search type options", () => {
    it("should use auto search type by default", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await WebSearchTool.execute({ query: "test" }, createMockContext());

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"type":"auto"'),
        })
      );
    });

    it("should support fast search type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test", type: "fast" },
        createMockContext()
      );

      expect(result.metadata.type).toBe("fast");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"type":"fast"'),
        })
      );
    });

    it("should support deep search type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test", type: "deep" },
        createMockContext()
      );

      expect(result.metadata.type).toBe("deep");
    });
  });

  describe("livecrawl options", () => {
    it("should use fallback livecrawl by default", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test" },
        createMockContext()
      );

      expect(result.metadata.livecrawl).toBe("fallback");
    });

    it("should support preferred livecrawl mode", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      const result = await WebSearchTool.execute(
        { query: "test", livecrawl: "preferred" },
        createMockContext()
      );

      expect(result.metadata.livecrawl).toBe("preferred");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"livecrawl":"preferred"'),
        })
      );
    });
  });

  describe("no results handling", () => {
    it("should return appropriate message when no results found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("data: {}\n"),
      });

      const result = await WebSearchTool.execute(
        { query: "very obscure query with no results" },
        createMockContext()
      );

      expect(result.output).toContain("No search results found");
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

      const result = await WebSearchTool.execute(
        { query: "test" },
        createMockContext()
      );

      expect(result.output).toContain("No search results found");
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
        WebSearchTool.execute({ query: "test" }, createMockContext())
      ).rejects.toThrow("Search error (500)");
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      await expect(
        WebSearchTool.execute({ query: "test" }, createMockContext())
      ).rejects.toThrow("Network failure");
    });

    it("should handle timeout errors", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        WebSearchTool.execute({ query: "test" }, createMockContext())
      ).rejects.toThrow("Search request timed out");
    });

    it("should handle malformed SSE response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve("data: not-valid-json\n"),
      });

      const result = await WebSearchTool.execute(
        { query: "test" },
        createMockContext()
      );

      // Should gracefully handle and return no results message
      expect(result.output).toContain("No search results found");
    });
  });

  describe("API request format", () => {
    it("should send correct JSON-RPC request format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await WebSearchTool.execute({ query: "test query" }, createMockContext());

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("tools/call");
      expect(body.params.name).toBe("web_search_exa");
      expect(body.params.arguments.query).toBe("test query");
    });

    it("should use correct API endpoint", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await WebSearchTool.execute({ query: "test" }, createMockContext());

      expect(global.fetch).toHaveBeenCalledWith(
        "https://mcp.exa.ai/mcp",
        expect.anything()
      );
    });

    it("should set correct content-type header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await WebSearchTool.execute({ query: "test" }, createMockContext());

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "content-type": "application/json",
          }),
        })
      );
    });
  });

  describe("contextMaxCharacters option", () => {
    it("should pass contextMaxCharacters when provided", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(createMockSSEResponse("results")),
      });

      await WebSearchTool.execute(
        { query: "test", contextMaxCharacters: 5000 },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"contextMaxCharacters":5000'),
        })
      );
    });
  });
});

describe("ToolRegistry - WebSearchTool", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have WebSearchTool registered", () => {
    expect(ToolRegistry.has("websearch")).toBe(true);
  });

  it("should get WebSearchTool by ID", () => {
    const tool = ToolRegistry.get("websearch");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("websearch");
  });

  it("should include websearch in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("websearch");
  });
});
