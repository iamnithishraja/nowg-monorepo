import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebFetchTool } from "../../app/tools/webfetch";
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

// Mock fetch globally
const originalFetch = global.fetch;

describe("WebFetchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ToolRegistry.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  describe("basic URL fetching", () => {
    it("should fetch a URL and return content", async () => {
      const mockHtml = "<html><body><h1>Hello World</h1></body></html>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "html" },
        createMockContext()
      );

      expect(result.output).toContain("<h1>Hello World</h1>");
      expect(result.metadata.url).toBe("https://example.com");
      expect(result.metadata.format).toBe("html");
    });

    it("should convert HTML to markdown by default", async () => {
      const mockHtml =
        "<html><body><h1>Title</h1><p>Paragraph text</p></body></html>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).toContain("# Title");
      expect(result.output).toContain("Paragraph text");
      expect(result.metadata.format).toBe("markdown");
    });

    it("should extract text from HTML", async () => {
      const mockHtml =
        "<html><body><h1>Title</h1><script>alert('test')</script><p>Text content</p></body></html>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(result.output).toContain("Title");
      expect(result.output).toContain("Text content");
      expect(result.output).not.toContain("alert");
      expect(result.metadata.format).toBe("text");
    });
  });

  describe("URL validation", () => {
    it("should reject invalid URLs without protocol", async () => {
      await expect(
        WebFetchTool.execute(
          { url: "example.com", format: "markdown" },
          createMockContext()
        )
      ).rejects.toThrow("URL must start with http:// or https://");
    });

    it("should accept http:// URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode("content").buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "http://example.com", format: "text" },
        createMockContext()
      );

      expect(result.metadata.url).toBe("http://example.com");
    });

    it("should accept https:// URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode("content").buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(result.metadata.url).toBe("https://example.com");
    });
  });

  describe("error handling", () => {
    it("should throw error for failed requests", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({}),
      });

      await expect(
        WebFetchTool.execute(
          { url: "https://example.com/notfound", format: "text" },
          createMockContext()
        )
      ).rejects.toThrow("Request failed with status code: 404");
    });

    it("should throw error for network failures", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await expect(
        WebFetchTool.execute(
          { url: "https://example.com", format: "text" },
          createMockContext()
        )
      ).rejects.toThrow("Failed to fetch URL: Network error");
    });

    it("should handle timeout errors", async () => {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      global.fetch = vi.fn().mockRejectedValue(abortError);

      await expect(
        WebFetchTool.execute(
          { url: "https://example.com", format: "text", timeout: 1 },
          createMockContext()
        )
      ).rejects.toThrow("Request timed out");
    });

    it("should reject responses that are too large", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/html",
          "content-length": "10000000", // 10MB
        }),
      });

      await expect(
        WebFetchTool.execute(
          { url: "https://example.com", format: "text" },
          createMockContext()
        )
      ).rejects.toThrow("Response too large");
    });
  });

  describe("HTML conversion", () => {
    it("should convert headings to markdown", async () => {
      const mockHtml = "<h2>Subheading</h2><h3>Section</h3>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).toContain("## Subheading");
      expect(result.output).toContain("### Section");
    });

    it("should convert links to markdown", async () => {
      const mockHtml = '<a href="https://test.com">Link Text</a>';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).toContain("[Link Text](https://test.com)");
    });

    it("should convert bold and italic text", async () => {
      const mockHtml = "<strong>Bold</strong> and <em>italic</em>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).toContain("**Bold**");
      expect(result.output).toContain("*italic*");
    });

    it("should convert code blocks", async () => {
      const mockHtml = "<code>inline code</code>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).toContain("`inline code`");
    });

    it("should remove script and style elements", async () => {
      const mockHtml =
        "<script>alert('hack')</script><style>.bad{}</style><p>Safe content</p>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(result.output).not.toContain("alert");
      expect(result.output).not.toContain(".bad");
      expect(result.output).toContain("Safe content");
    });

    it("should decode HTML entities", async () => {
      const mockHtml = "<p>&amp; &lt; &gt; &quot;</p>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(mockHtml).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(result.output).toContain("& < > \"");
    });
  });

  describe("content truncation", () => {
    it("should truncate very long content", async () => {
      const longContent = "x".repeat(150000);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(longContent).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(result.output.length).toBeLessThan(150000);
      expect(result.output).toContain("(Content truncated)");
      expect(result.metadata.truncated).toBe(true);
    });

    it("should not truncate small content", async () => {
      const smallContent = "small content";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(smallContent).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(result.output).toBe("small content");
      expect(result.metadata.truncated).toBe(false);
    });
  });

  describe("format handling", () => {
    it("should return plain text as-is when format is text", async () => {
      const plainText = "Plain text content";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/plain" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(plainText).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://example.com/file.txt", format: "text" },
        createMockContext()
      );

      expect(result.output).toBe("Plain text content");
    });

    it("should return JSON content as-is", async () => {
      const jsonContent = '{"key": "value"}';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(jsonContent).buffer),
      });

      const result = await WebFetchTool.execute(
        { url: "https://api.example.com/data", format: "text" },
        createMockContext()
      );

      expect(result.output).toBe('{"key": "value"}');
    });
  });

  describe("request headers", () => {
    it("should send appropriate headers for markdown format", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode("<html></html>").buffer),
      });

      await WebFetchTool.execute(
        { url: "https://example.com", format: "markdown" },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: expect.stringContaining("text/markdown"),
          }),
        })
      );
    });

    it("should include User-Agent header", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode("<html></html>").buffer),
      });

      await WebFetchTool.execute(
        { url: "https://example.com", format: "text" },
        createMockContext()
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://example.com",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("Mozilla"),
          }),
        })
      );
    });
  });
});

describe("ToolRegistry - WebFetchTool", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have WebFetchTool registered", () => {
    expect(ToolRegistry.has("webfetch")).toBe(true);
  });

  it("should get WebFetchTool by ID", () => {
    const tool = ToolRegistry.get("webfetch");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("webfetch");
  });

  it("should include webfetch in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("webfetch");
  });
});
