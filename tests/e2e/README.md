# E2E Tests

Playwright end-to-end tests for the OnBored SDK.

## Setup

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install

# Build the SDK
pnpm build
```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode
pnpm test:e2e:ui

# Run tests in headed mode (visible browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug

# Run specific test file
pnpm test:e2e tests/e2e/sdk-initialization.spec.ts

# Run tests in specific browser
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
```

## Test Structure

- `sdk-initialization.spec.ts` - SDK initialization tests
- `flow-management.spec.ts` - Flow creation and management tests
- `event-capture.spec.ts` - Event capture and tracking tests
- `session-replay.spec.ts` - Session replay functionality tests
- `cross-browser.spec.ts` - Cross-browser compatibility tests
- `performance.spec.ts` - Performance and load tests

## Test Coverage

Core SDK functionality:
- ✅ SDK initialization
- ✅ Flow management (create, complete, skip)
- ✅ Step tracking
- ✅ Event capture
- ✅ Session replay
- ✅ Cross-browser support
- ✅ Performance benchmarks

## Debugging

```bash
# Run with trace on failure
pnpm test:e2e --trace=on

# View test report
npx playwright show-report

# Open last trace
npx playwright show-trace
```
