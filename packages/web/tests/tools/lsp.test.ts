import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LspTool } from "../../app/tools/lsp";
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

      if (entries.length === 0 && !Object.keys(files).some((f) => f === path)) {
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

describe("LspTool", () => {
  beforeEach(() => {
    WebContainerProvider.resetInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    WebContainerProvider.resetInstance();
  });

  describe("documentSymbol operation", () => {
    it("should find function declarations", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": `
function add(a: number, b: number): number {
  return a + b;
}

async function fetchData(url: string) {
  return fetch(url);
}

export function multiply(x: number, y: number) {
  return x * y;
}
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "utils.ts" },
        createMockContext()
      );

      expect(result.output).toContain("add");
      expect(result.output).toContain("fetchData");
      expect(result.output).toContain("multiply");
      expect(result.output).toContain("Function");
      expect(result.metadata.results.length).toBeGreaterThanOrEqual(3);
    });

    it("should find class declarations", async () => {
      const mockContainer = createMockWebContainer({
        "/project/models.ts": `
class User {
  constructor(public name: string) {}
  
  greet() {
    return \`Hello, \${this.name}\`;
  }
}

export class Admin extends User {
  role: string;
}

abstract class BaseModel {
  id: number;
}
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "models.ts" },
        createMockContext()
      );

      expect(result.output).toContain("User");
      expect(result.output).toContain("Admin");
      expect(result.output).toContain("BaseModel");
      expect(result.output).toContain("Class");
    });

    it("should find interfaces and types", async () => {
      const mockContainer = createMockWebContainer({
        "/project/types.ts": `
interface User {
  id: number;
  name: string;
}

export interface Product {
  sku: string;
  price: number;
}

type Status = 'pending' | 'completed';

export type Response<T> = {
  data: T;
  error?: string;
};
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "types.ts" },
        createMockContext()
      );

      expect(result.output).toContain("User");
      expect(result.output).toContain("Product");
      expect(result.output).toContain("Status");
      expect(result.output).toContain("Response");
      expect(result.output).toContain("Interface");
    });

    it("should find constants and variables", async () => {
      const mockContainer = createMockWebContainer({
        "/project/config.ts": `
const MAX_RETRIES = 3;
const API_URL = "https://api.example.com";

let counter = 0;

export const config = {
  timeout: 5000,
};
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "config.ts" },
        createMockContext()
      );

      expect(result.output).toContain("MAX_RETRIES");
      expect(result.output).toContain("API_URL");
      expect(result.output).toContain("Constant");
    });

    it("should find enums", async () => {
      const mockContainer = createMockWebContainer({
        "/project/enums.ts": `
enum Status {
  Pending,
  Active,
  Completed,
}

export const enum Direction {
  North,
  South,
  East,
  West,
}
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "enums.ts" },
        createMockContext()
      );

      expect(result.output).toContain("Status");
      expect(result.output).toContain("Direction");
      expect(result.output).toContain("Enum");
    });

    it("should return empty for files with no symbols", async () => {
      const mockContainer = createMockWebContainer({
        "/project/empty.ts": "// Just a comment\n",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "empty.ts" },
        createMockContext()
      );

      expect(result.output).toContain("No symbols found");
      expect(result.metadata.results).toHaveLength(0);
    });
  });

  describe("findReferences operation", () => {
    it("should find references to a symbol", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": `
export function formatDate(date: Date): string {
  return date.toISOString();
}
`,
        "/project/app.ts": `
import { formatDate } from './utils';

const today = new Date();
console.log(formatDate(today));

const result = formatDate(new Date('2024-01-01'));
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "findReferences",
          filePath: "utils.ts",
          symbolName: "formatDate",
        },
        createMockContext()
      );

      expect(result.output).toContain("formatDate");
      expect(result.metadata.results.length).toBeGreaterThanOrEqual(3);
    });

    it("should find references across multiple files", async () => {
      const mockContainer = createMockWebContainer({
        "/project/shared.ts": "export const API_URL = 'http://api.example.com';",
        "/project/service1.ts": `
import { API_URL } from './shared';
fetch(API_URL);
`,
        "/project/service2.ts": `
import { API_URL } from './shared';
const url = API_URL + '/users';
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "findReferences",
          filePath: "shared.ts",
          symbolName: "API_URL",
        },
        createMockContext()
      );

      expect(result.output).toContain("shared.ts");
      expect(result.output).toContain("service1.ts");
      expect(result.output).toContain("service2.ts");
    });

    it("should return no references message when symbol not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": "const foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "findReferences",
          filePath: "utils.ts",
          symbolName: "nonexistent",
        },
        createMockContext()
      );

      expect(result.output).toContain("No references found");
    });

    it("should throw error when symbolName is missing", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": "const foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          { operation: "findReferences", filePath: "utils.ts" },
          createMockContext()
        )
      ).rejects.toThrow("symbolName is required");
    });
  });

  describe("goToDefinition operation", () => {
    it("should find function definition", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": `
function helper() {
  return true;
}

const result = helper();
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "goToDefinition",
          filePath: "utils.ts",
          line: 6,
          character: 16,
        },
        createMockContext()
      );

      expect(result.output).toContain("Definition of");
      expect(result.output).toContain("helper");
    });

    it("should find definition in another file", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": `
export function formatDate(date: Date) {
  return date.toISOString();
}
`,
        "/project/app.ts": `
import { formatDate } from './utils';
formatDate(new Date());
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "goToDefinition",
          filePath: "app.ts",
          line: 3,
          character: 1,
        },
        createMockContext()
      );

      expect(result.output).toContain("Definition of");
      expect(result.output).toContain("formatDate");
      expect(result.output).toContain("utils.ts");
    });

    it("should return no definition found for unknown symbols", async () => {
      const mockContainer = createMockWebContainer({
        "/project/app.ts": "unknownFunction();",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "goToDefinition",
          filePath: "app.ts",
          line: 1,
          character: 1,
        },
        createMockContext()
      );

      expect(result.output).toContain("No definition found");
    });

    it("should throw error when line/character are missing", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": "const foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          { operation: "goToDefinition", filePath: "utils.ts" },
          createMockContext()
        )
      ).rejects.toThrow("line and character are required");
    });
  });

  describe("hover operation", () => {
    it("should return hover info for a symbol", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": `
function processData(input: string) {
  return input.trim();
}

const result = processData("hello");
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "hover",
          filePath: "utils.ts",
          line: 2,
          character: 10,
        },
        createMockContext()
      );

      expect(result.output).toContain("processData");
      expect(result.output).toContain("Function");
    });

    it("should return hover info for any word", async () => {
      const mockContainer = createMockWebContainer({
        "/project/app.ts": "const myVariable = 'test';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        {
          operation: "hover",
          filePath: "app.ts",
          line: 1,
          character: 10,
        },
        createMockContext()
      );

      expect(result.output).toContain("myVariable");
    });

    it("should throw error when line/character are missing", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": "const foo = 'bar';",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          { operation: "hover", filePath: "utils.ts" },
          createMockContext()
        )
      ).rejects.toThrow("line and character are required");
    });
  });

  describe("error handling", () => {
    it("should throw error when WebContainer is not available", async () => {
      await expect(
        LspTool.execute(
          { operation: "documentSymbol", filePath: "test.ts" },
          createMockContext()
        )
      ).rejects.toThrow("WebContainer is not available");
    }, 5000);

    it("should throw error when file not found", async () => {
      const mockContainer = createMockWebContainer({
        "/project/other.ts": "const x = 1;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          { operation: "documentSymbol", filePath: "nonexistent.ts" },
          createMockContext()
        )
      ).rejects.toThrow("File not found");
    });

    it("should throw error when trying to analyze a directory", async () => {
      const mockContainer = createMockWebContainer({
        "/project/src/index.ts": "export const x = 1;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          { operation: "documentSymbol", filePath: "src" },
          createMockContext()
        )
      ).rejects.toThrow("Cannot analyze directory");
    });

    it("should throw error for invalid line number", async () => {
      const mockContainer = createMockWebContainer({
        "/project/utils.ts": "const x = 1;",
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      await expect(
        LspTool.execute(
          {
            operation: "goToDefinition",
            filePath: "utils.ts",
            line: 100,
            character: 1,
          },
          createMockContext()
        )
      ).rejects.toThrow("Invalid line number");
    });
  });

  describe("React/JSX support", () => {
    it("should find React components", async () => {
      const mockContainer = createMockWebContainer({
        "/project/App.tsx": `
import React from 'react';

function Header() {
  return <h1>Header</h1>;
}

const Footer = () => {
  return <footer>Footer</footer>;
};

export default function App() {
  return (
    <div>
      <Header />
      <Footer />
    </div>
  );
}
`,
      });
      WebContainerProvider.getInstance().setContainer(mockContainer as any);

      const result = await LspTool.execute(
        { operation: "documentSymbol", filePath: "App.tsx" },
        createMockContext()
      );

      expect(result.output).toContain("Header");
      expect(result.output).toContain("Footer");
      expect(result.output).toContain("App");
    });
  });
});

describe("LspTool Registry", () => {
  beforeEach(() => {
    ToolRegistry.reset();
  });

  it("should have LspTool registered by default", () => {
    expect(ToolRegistry.has("lsp")).toBe(true);
  });

  it("should get LspTool by ID", () => {
    const tool = ToolRegistry.get("lsp");
    expect(tool).toBeDefined();
    expect(tool?.id).toBe("lsp");
  });

  it("should include lsp in tool IDs", () => {
    const ids = ToolRegistry.getIds();
    expect(ids).toContain("lsp");
  });
});
