# Onbored SDK Documentation

The Onbored SDK is a plug-and-play JavaScript library for capturing onboarding events, user journeys, and flow analytics. It's designed to help B2B SaaS products improve user activation and reduce churn with minimal setup.

---

## Overview

The SDK allows you to:

- Track onboarding flows, steps, skips, and completions
- Auto-generate and manage sessions
- Queue and retry events with offline support
- Initialize quickly with a project key
- Use React hooks and provider for seamless integration

---

## Installation

```bash
# npm
npm install @onbored/sdk

# yarn
yarn add @onbored/sdk

# pnpm
pnpm add @onbored/sdk
```

---

## Quick Start

### Initialize the SDK

```typescript
import onbored from "@onbored/sdk";

onbored.init({
  projectKey: "pk_live_1234567890abcdef",
  user_id: "user_123",
  user_metadata: { plan: "premium" },
  debug: true,
});
```

**Initialization Options:**

| Option           | Type                            | Description                               |
| ---------------- | ------------------------------- | ----------------------------------------- |
| `projectKey`     | `string`                        | Required project key                      |
| `user_id`        | `string`                        | Optional user identifier                  |
| `user_metadata`  | `Record<string, any>`           | Optional user metadata (e.g., plan, role) |
| `traits`         | `Record<string, any>`           | Optional user traits                      |
| `debug`          | `boolean`                       | Enables debug mode                        |
| `env`            | `"development" \| "production"` | Enables development mode behavior         |
| `storage`        | `Storage`                       | Custom storage configuration              |
| `global`         | `GlobalOptions`                 | Custom fetch and headers                  |

### Tracking Flows and Events

```typescript
// Start a flow
onbored.flow("Onboarding");

// Track step completion
onbored.step("Invite Team", { slug: "Onboarding" });

// Record a skipped step
onbored.skip("Billing Info", { slug: "Onboarding" });

// Mark flow as completed
onbored.completed({ slug: "Onboarding" });
```

---

## React Integration

### Using the Provider

The `OnboredProvider` automatically initializes the SDK and provides context to child components:

```tsx
import { OnboredProvider } from "@onbored/sdk/react";

function App() {
  return (
    <OnboredProvider
      config={{
        projectKey: "pk_live_1234567890abcdef",
        user_id: "user_123",
        user_metadata: { plan: "premium" },
        debug: true,
      }}
    >
      <YourApp />
    </OnboredProvider>
  );
}
```

### useFlow Hook

The `useFlow` hook provides a convenient way to track flow events within React components:

```tsx
import { useFlow } from "@onbored/sdk/react";

function OnboardingFlow() {
  const { step, skip, complete } = useFlow("Onboarding");

  const handleProfileComplete = () => {
    step("Complete Profile", { method: "email" });
  };

  const handleSkipTeam = () => {
    skip("Invite Team", { reason: "Solo user" });
  };

  const handleFinish = () => {
    complete({ totalSteps: 5 });
  };

  return (
    <div>
      <button onClick={handleProfileComplete}>Complete Profile</button>
      <button onClick={handleSkipTeam}>Skip Team Invite</button>
      <button onClick={handleFinish}>Finish Onboarding</button>
    </div>
  );
}
```

**Hook Methods:**

| Method    | Description                    | Parameters                                    |
| --------- | ------------------------------ | --------------------------------------------- |
| `step()`  | Track step completion         | `(stepName: string, options?: Record<string, any>)` |
| `skip()`  | Record skipped step           | `(stepName: string, options?: Record<string, any>)` |
| `complete()` | Mark flow as completed     | `(options?: Record<string, any>)`            |

---

## Advanced Usage

### Direct Class Instantiation

For advanced use cases, you can create multiple instances of the Onbored client:

```typescript
import { OnboredClient } from "@onbored/sdk/lib";

// Create a custom client instance
const customClient = new OnboredClient("pk_live_1234567890abcdef", {
  user_id: "user_123",
  user_metadata: { plan: "premium" },
  debug: true,
  env: "development",
  storage: {
    sessionStorageKey: "custom-session-key",
    activityStorageKey: "custom-activity-key",
    flowContextStorageKey: "custom-flow-context-key",
  },
  global: {
    headers: {
      "X-Custom-Header": "value",
    },
  },
});

// Use the custom client
await customClient.flow("Custom Flow");
await customClient.step("Custom Step", { slug: "Custom Flow" });
await customClient.completed({ slug: "Custom Flow" });
```

### Custom Storage Configuration

```typescript
onbored.init({
  projectKey: "pk_live_1234567890abcdef",
  storage: {
    sessionStorageKey: "my-app-session",
    activityStorageKey: "my-app-activity",
    flowContextStorageKey: "my-app-flow-context",
  },
});
```

### Custom Global Options

```typescript
onbored.init({
  projectKey: "pk_live_1234567890abcdef",
  global: {
    headers: {
      "Authorization": "Bearer token",
      "X-Custom-Header": "value",
    },
    // Custom fetch implementation
    fetch: (url, options) => {
      // Custom fetch logic
      return fetch(url, options);
    },
  },
});
```

---

## Core Concepts

| Method        | Description                                |
| ------------- | ------------------------------------------ |
| `flow()`      | Starts a named flow                        |
| `step()`      | Tracks a step completion                   |
| `skip()`      | Records a skipped step                     |
| `completed()` | Marks a flow as completed                  |
| `capture()`   | Manually capture custom events             |
| `context()`   | Merges additional user traits              |
| `reset()`     | Regenerates the session and clears context |
| `destroy()`   | Cleanup resources and event listeners      |

---

## Event Payload Schema

```typescript
interface EventPayload {
  eventType: string;
  slug?: string;
  flowId?: string;
  step?: string;
  options: Record<string, any>;
  result?: string;
  traits?: Record<string, any>;
  sessionId: string;
  timestamp: string; // ISO 8601 format
  projectKey: string;
  url: string;
  referrer?: string;
}
```

Payloads are validated using Zod to ensure integrity.

---

## Flow Management

The SDK automatically manages flow contexts:

- Each flow gets a unique server-generated ID
- Flow contexts are persisted in sessionStorage
- Page views are automatically tracked for active flows
- Flow completion triggers immediate event flushing
- Automatic step view tracking with Intersection Observer

---

## Retry and Flush Logic

- Events are flushed every 5 seconds or on page unload
- Failed flushes are retried with exponential backoff (up to 5 attempts)
- Events are queued in memory until successfully sent
- Flow completion events are flushed immediately
- Automatic cleanup of resources and event listeners

---

## Development Mode

When `env: "development"` is set:

- Events are not sent to the server
- All actions are logged to the console
- Useful for local development and debugging
- Global flush function available at `window.__onboredFlush`

---

## Session Handling

- Sessions expire after 30 minutes of inactivity
- Session ID is stored in localStorage
- Page views are auto-captured on `init()`
- Flow contexts are restored from sessionStorage on page reload
- Automatic session regeneration on expiration

---

## Utilities

### `context(traits: Record<string, any>)`

Merge additional context traits into the current session.

```typescript
onbored.context({ companySize: "11-50", role: "admin" });
```

### `reset()`

Reset the session and clear all user traits.

```typescript
onbored.reset();
```

### `destroy()`

Cleanup resources and remove event listeners.

```typescript
onbored.destroy();
```

---

## Full Example

### Vanilla JavaScript

```typescript
// Initialize the SDK
onbored.init({
  projectKey: "pk_123",
  user_id: "alice",
  user_metadata: { plan: "premium" },
  debug: true,
});

// Start onboarding flow
onbored.flow("Onboarding");

// Track step completions
onbored.step("Sign Up", { slug: "Onboarding", method: "email" });
onbored.step("Complete Profile", { slug: "Onboarding", age: 29 });

// Record a skipped step
onbored.skip("Invite Team", { slug: "Onboarding", reason: "No team yet" });

// Mark flow as completed
onbored.completed({ slug: "Onboarding" });
```

### React Application

```tsx
import { OnboredProvider, useFlow } from "@onbored/sdk/react";

function OnboardingComponent() {
  const { step, skip, complete } = useFlow("Onboarding");

  return (
    <div>
      <button onClick={() => step("Sign Up", { method: "email" })}>
        Complete Sign Up
      </button>
      <button onClick={() => skip("Invite Team", { reason: "Solo user" })}>
        Skip Team Invite
      </button>
      <button onClick={() => complete({ totalSteps: 3 })}>
        Finish Onboarding
      </button>
    </div>
  );
}

function App() {
  return (
    <OnboredProvider
      config={{
        projectKey: "pk_live_1234567890abcdef",
        user_id: "user_123",
        debug: true,
      }}
    >
      <OnboardingComponent />
    </OnboredProvider>
  );
}
```

---

## API Endpoints

The SDK expects the following API endpoints:

- `POST /api/ingest/session` - Register new sessions
- `POST /api/ingest/flow` - Register new flows
- `POST /api/ingest` - Ingest events in batch

---

## Notes

- Payloads are structured for batch sending and analytics backend ingestion
- Debug logs are grouped for better inspection during development
- Flow contexts are automatically managed and persisted
- Events are validated using Zod schema before sending
- Automatic cleanup prevents memory leaks
- Intersection Observer tracks step visibility automatically

Let us know if you need documentation on backend integrations, plugin hooks, or event dashboards.
