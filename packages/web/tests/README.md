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
├── setup.ts          # Global test setup & mocks
└── tools/
    └── read.test.ts  # ReadTool, ToolRegistry, WebContainerProvider tests
```

## Writing Tests

Tests use [Vitest](https://vitest.dev/) with mocked WebContainer:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ReadTool } from "../../app/tools/read";
import { WebContainerProvider } from "../../app/tools/webcontainer-provider";

// Mock WebContainer
const mockContainer = {
  fs: {
    readFile: vi.fn(async () => new TextEncoder().encode("content")),
    readdir: vi.fn(async () => ["file.txt"]),
    stat: vi.fn(async () => ({ isDirectory: () => false })),
  },
};

// Set mock before test
WebContainerProvider.getInstance().setContainer(mockContainer as any);

// Reset after test
WebContainerProvider.resetInstance();
```

## Test Coverage

- **ReadTool**: File reading, truncation, images, binary detection, error handling
- **ToolRegistry**: Registration, lookup, execution
- **WebContainerProvider**: Singleton, subscriptions, timeouts
