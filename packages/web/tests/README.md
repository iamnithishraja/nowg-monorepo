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
    └── batch.test.ts     # BatchTool tests
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

**Total: 155 tests**

### Infrastructure

- **ToolRegistry**: Registration, lookup, execution, reset
- **WebContainerProvider**: Singleton pattern, subscriptions, timeouts, availability
