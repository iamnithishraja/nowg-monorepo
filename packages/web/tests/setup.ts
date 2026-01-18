import { beforeAll, afterAll, vi } from "vitest";

// Mock for ?raw imports (Vite-specific)
vi.mock("../app/tools/read.txt?raw", () => ({
  default: `Reads a file from the WebContainer virtual filesystem. You can access any file in the project workspace using this tool.

Usage:
- The filePath parameter should be relative to the project root
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit
`,
}));

vi.mock("../app/tools/webfetch.txt?raw", () => ({
  default: `Fetches content from a specified URL. Takes a URL and optional format as input, fetches the URL content, and converts to the requested format (markdown by default).

Usage:
- The URL must be a fully-formed valid URL starting with http:// or https://
- Format options: "markdown" (default), "text", or "html"
`,
}));

vi.mock("../app/tools/websearch.txt?raw", () => ({
  default: `Search the web using Exa AI - performs real-time web searches and can scrape content from specific URLs. Provides up-to-date information for current events and recent data.

Usage:
- Provide a search query to find relevant web results
- Supports configurable result counts (default: 8)
`,
}));

vi.mock("../app/tools/codesearch.txt?raw", () => ({
  default: `Search and get relevant context for any programming task using Exa Code API. Provides the highest quality and freshest context for libraries, SDKs, and APIs.

Usage:
- Provide a search query about programming concepts, APIs, or libraries
- Adjustable token count (1000-50000, default: 5000)
`,
}));

// Global test setup
beforeAll(() => {
  // Reset any global state before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
