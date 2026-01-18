# Tests

## Running Tests

```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## Structure

```
tests/
├── setup.ts              # Global test setup & mocks
└── tools/
    ├── read.test.ts      # ReadTool tests
    ├── grep.test.ts      # GrepTool tests
    ├── bash.test.ts      # BashTool tests
    ├── lsp.test.ts       # LspTool tests
    ├── ls.test.ts        # ListTool tests
    ├── glob.test.ts      # GlobTool tests
    ├── batch.test.ts     # BatchTool tests
    ├── edit.test.ts      # EditTool tests
    ├── write.test.ts     # WriteTool tests
    ├── multiedit.test.ts # MultiEditTool tests
    ├── webfetch.test.ts  # WebFetchTool tests
    ├── websearch.test.ts # WebSearchTool tests
    └── codesearch.test.ts# CodeSearchTool tests
```

## Writing Tests

Tests use [Vitest](https://vitest.dev/) with mocked WebContainer:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ReadTool } from "../../app/tools/read";
import { WebContainerProvider } from "../../app/tools/webcontainer-provider";

// Mock WebContainer filesystem
const mockContainer = {
  fs: {
    readFile: vi.fn(async () => new TextEncoder().encode("content")),
    readdir: vi.fn(async () => ["file.txt"]),
    stat: vi.fn(async () => ({ isDirectory: () => false, isFile: () => true })),
  },
};

// Set mock before test
WebContainerProvider.getInstance().setContainer(mockContainer as any);

// Reset after test
WebContainerProvider.resetInstance();
```

### Mocking Network Tools

For network-based tools (webfetch, websearch, codesearch), mock the global fetch:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

it("should fetch content", async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "text/html" }),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode("<html></html>").buffer),
  });

  // ... test code
});
```

## Test Coverage

### Tools

| Tool | Tests | Description |
|------|-------|-------------|
| **ReadTool** | 32 | File reading, truncation, images, binary detection, error handling |
| **GrepTool** | 21 | Pattern matching, regex, file filtering, ignore patterns |
| **BashTool** | 21 | Command execution, timeout, abort handling, output streaming |
| **LspTool** | 25 | Document symbols, references, definitions, hover info |
| **ListTool** | 18 | Directory listing, tree structure, ignore patterns |
| **GlobTool** | 21 | Glob pattern matching, brace expansion, file discovery |
| **BatchTool** | 17 | Parallel tool execution, partial failures, batch limits |
| **EditTool** | 22 | String replacement, fuzzy matching, file creation, replaceAll |
| **WriteTool** | 18 | File writing, directory creation, overwriting, diff generation |
| **MultiEditTool** | 24 | Sequential edits, atomic operations, file creation |
| **WebFetchTool** | 24 | URL fetching, HTML to markdown conversion, text extraction, error handling |
| **WebSearchTool** | 19 | Web search via Exa AI, SSE parsing, search options, error handling |
| **CodeSearchTool** | 21 | Code context search, token limits, API format, error handling |

**Total: 283 tests**

### Infrastructure

- **ToolRegistry**: Registration, lookup, execution, reset
- **WebContainerProvider**: Singleton pattern, subscriptions, timeouts, availability
