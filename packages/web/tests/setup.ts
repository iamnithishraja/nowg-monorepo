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

// Global test setup
beforeAll(() => {
  // Reset any global state before all tests
});

afterAll(() => {
  // Cleanup after all tests
});
