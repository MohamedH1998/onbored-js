# Onbored SDK

A powerful, instance-based JavaScript SDK for capturing onboarding events, user journeys, and flow analytics. Designed for multi-tenant B2B SaaS products to improve user activation and reduce churn.

## ✨ Features

- **Instance-Based Architecture** - Support for multiple teams/projects
- **React Integration** - Hooks and providers for seamless React integration
- **Flow Tracking** - Complete flow lifecycle management (start, step, skip, complete)
- **Session Management** - Auto-generated sessions with timeout handling
- **Offline Support** - Event queuing with retry logic and exponential backoff
- **Type Safety** - Full TypeScript support with Zod validation
- **Development Mode** - Mock mode for local development
- **Multi-Tenant Ready** - Isolated instances for different teams

## 🚀 Quick Start

### Installation

```bash
npm install @onbored/sdk
# or
yarn add @onbored/sdk
# or
pnpm add @onbored/sdk
```

### Basic Usage

```typescript
import { Onbored } from "@onbored/sdk";

// Create an instance
const onbored = new Onbored({
  projectKey: <your-product-key>,
  userId: "user_123",
  traits: { plan: "premium", team: "engineering" },
  debug: true,
  env: "production",
});

// Track a flow
onbored.flow("welcome-flow");
onbored.step("profile-setup", { funnelSlug: "welcome-flow", method: "email" });
onbored.completed({ funnelSlug: "welcome-flow", result: "success" });
```

### React Integration

```tsx
import { OnBoredProvider, useFlow } from "@onbored/sdk/react";

function App() {
  return (
    <OnBoredProvider
      config={{
        projectKey: <your-product-key>,
        userId: "user_123",
        debug: true,
        env: "production",
      }}
    >
      <WelcomeFlow />
    </OnBoredProvider>
  );
}

function WelcomeFlow() {
  const { step, skip, complete, isReady } = useFlow("welcome-flow");

  if (!isReady) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => step("button-clicked")}>Get Started</button>
      <button onClick={() => skip("team-invite", { reason: "solo-user" })}>
        Skip Team Setup
      </button>
      <button onClick={() => complete({ result: "success" })}>
        Complete Setup
      </button>
    </div>
  );
}
```

## 📚 API Reference

### Core SDK

#### `new Onbored(config: OnboredConfig)`

Creates a new Onbored instance.

```typescript
interface OnboredConfig {
  projectKey: string; // Required: Your project key
  userId?: string; // Optional: User identifier
  traits?: Record<string, any>; // Optional: User metadata
  debug?: boolean; // Optional: Enable debug mode
  env?: "development" | "production"; // Optional: Environment
  flushInterval?: number; // Optional: Flush interval (default: 5000ms)
  maxQueueSize?: number; // Optional: Max queue size (default: 1000)
  maxRetries?: number; // Optional: Max retries (default: 5)
  retryIntervalMs?: number; // Optional: Retry interval (default: 5000ms)
  sessionTimeoutMs?: number; // Optional: Session timeout (default: 30min)
}
```

#### Instance Methods

| Method                        | Description              | Example                                                                       |
| ----------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `flow(funnelSlug: string)`    | Start a new flow         | `onbored.flow('welcome-flow')`                                                |
| `step(name: string, options)` | Record a step completion | `onbored.step('profile-setup', { funnelSlug: 'welcome-flow' })`               |
| `skip(name: string, options)` | Record a skipped step    | `onbored.skip('team-invite', { funnelSlug: 'welcome-flow', reason: 'solo' })` |
| `completed(options)`          | Mark flow as completed   | `onbored.completed({ funnelSlug: 'welcome-flow', result: 'success' })`        |
| `capture(eventType, data)`    | Capture custom events    | `onbored.capture('Button Click', { options: { button: 'cta' } })`             |
| `context(traits)`             | Update user context      | `onbored.context({ plan: 'pro', role: 'admin' })`                             |
| `reset()`                     | Reset session and traits | `onbored.reset()`                                                             |
| `destroy()`                   | Clean up instance        | `onbored.destroy()`                                                           |

### React Components & Hooks

#### `<OnBoredProvider>`

Provides Onbored context to your React app.

```tsx
<OnBoredProvider config={onboredConfig}>
  <YourApp />
</OnBoredProvider>
```

#### `useFlow(funnelSlug: string)`

Hook for managing flow lifecycle.

```tsx
const { step, skip, complete, isReady } = useFlow("welcome-flow");

// Returns:
// - step(name, options): Record step completion
// - skip(name, options): Record step skip
// - complete(options): Mark flow complete
// - isReady: boolean - Whether client is initialized
```

#### `useOnboredClient()`

Hook for direct client access and advanced operations.

```tsx
const { client, capture, context, reset, flush, isReady } = useOnboredClient();

// Returns:
// - client: Onbored instance
// - capture(eventType, data): Capture custom events
// - context(traits): Update user context
// - reset(): Reset session
// - flush(): Manually flush events
// - isReady: boolean
```

#### `usePageView(options?)`

Hook for tracking page views.

```tsx
usePageView({
  path: "/dashboard",
  title: "Dashboard",
  funnelSlug: "welcome-flow",
  additionalData: { section: "main" },
});
```

## 🔧 Configuration

### Environment Modes

#### Production Mode

```typescript
const onbored = new Onbored({
  projectKey: "pk_live_123",
  env: "production",
});
```

#### Development Mode

```typescript
const onbored = new Onbored({
  projectKey: "pk_live_123",
  env: "development",
  debug: true,
});
// Events are logged but not sent to server
```

### Multi-Tenant Setup

```typescript
// Team 1 instance
const team1Onbored = new Onbored({
  projectKey: "team1_project_key",
  debug: true,
});

// Team 2 instance
const team2Onbored = new Onbored({
  projectKey: "team2_project_key",
  debug: false,
});

// React multi-tenant
function MultiTenantApp({ teamId }: { teamId: string }) {
  const configs = {
    team1: { projectKey: "team1_key", debug: true },
    team2: { projectKey: "team2_key", debug: false },
  };

  return (
    <OnBoredProvider config={configs[teamId]}>
      <TeamApp />
    </OnBoredProvider>
  );
}
```

## 📊 Event Schema

All events follow this schema:

```typescript
interface EventPayload {
  eventType: string; // Event type (e.g., "Flow Started", "Step Completed")
  flowId?: string; // Internal flow ID (auto-generated)
  funnelSlug?: string; // User-provided funnel slug
  step?: string; // Step name (for step events)
  options: Record<string, any>; // Event-specific data
  result?: string; // Result/outcome
  traits?: Record<string, any>; // User traits
  sessionId: string; // Session identifier
  timestamp: string; // ISO 8601 timestamp
  projectKey: string; // Project key
  url: string; // Current URL
  referrer?: string; // Referrer URL
}
```

## 🔄 Event Lifecycle

1. **Capture** - Events are captured and validated
2. **Queue** - Events are queued in memory
3. **Flush** - Events are sent every 5 seconds or on page unload
4. **Retry** - Failed events are retried with exponential backoff
5. **Drop** - Events are dropped after 5 failed attempts

## 🛡️ Error Handling

The SDK includes comprehensive error handling:

- **Validation Errors** - Invalid payloads are logged and dropped
- **Network Errors** - Failed requests are retried automatically
- **Offline Support** - Events are queued when offline
- **Graceful Degradation** - SDK continues working even with errors

## 🧪 Testing

### Unit Testing

```typescript
import { Onbored } from "@onbored/sdk";

// Create instance in development mode
const onbored = new Onbored({
  projectKey: "test_key",
  env: "development",
});

// Events are logged but not sent
onbored.flow("test-flow");
onbored.step("test-step", { funnelSlug: "test-flow" });
```

### Integration Testing

```typescript
// Mock the fetch API
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: "success" }),
  })
) as jest.Mock;

const onbored = new Onbored({
  projectKey: "test_key",
  env: "production",
});
```

## 🔍 Debugging

### Debug Mode

```typescript
const onbored = new Onbored({
  projectKey: "pk_live_123",
  debug: true,
});

// Console output:
// [Onbored] Initialized
// [Onbored] Flow registered { status: "success", flowId: "..." }
// [Onbored] Captured: { eventType: "Flow Started", ... }
```

### Global Flush Function

```typescript
// Access flush function globally for debugging
window.__onboredFlush_pk_live_123();
```

### React Debug

```tsx
<OnBoredProvider
  config={{
    projectKey: "pk_live_123",
    debug: true,
  }}
>
  <App />
</OnBoredProvider>
```

## 📦 Bundle Size

- **Core SDK**: ??
- **React Integration**: ??
- **Tree-shakeable**: ??