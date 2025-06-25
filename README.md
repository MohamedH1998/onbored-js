# Onbored SDK Documentation

The Onbored SDK is a plug-and-play JavaScript library for capturing onboarding events, user journeys, and flow analytics. It's designed to help B2B SaaS products improve user activation and reduce churn with minimal setup.

---

## Overview

The SDK allows you to:

- Track onboarding flows, steps, skips, and completions
- Auto-generate and manage sessions
- Queue and retry events with offline support
- Initialize quickly with a project key

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

onbored.init("pk_live_1234567890abcdef", {
  userId: "user_123",
  traits: { plan: "premium" },
  debug: true,
});
```

**Initialization Options:**

| Option   | Type                            | Description                               |
| -------- | ------------------------------- | ----------------------------------------- |
| `userId` | `string`                        | Optional user identifier                  |
| `traits` | `Record<string, any>`           | Optional user metadata (e.g., plan, role) |
| `debug`  | `boolean`                       | Enables debug mode                        |
| `env`    | `"development" \| "production"` | Enables development mode behavior         |

### Tracking Flows and Events

```typescript
onbored.flow("Onboarding");
onbored.step("Invite Team", { flow: "Onboarding" });
onbored.skip("Billing Info", { flow: "Onboarding" });
onbored.completed({ flow: "Onboarding" });
```

---

## Core Concepts

| Method        | Description                                |
| ------------- | ------------------------------------------ |
| `flow()`      | Starts a named flow                        |
| `step()`      | Tracks a step completion                   |
| `skip()`      | Records a skipped step                     |
| `completed()` | Marks a flow as completed                  |
| `context()`   | Merges additional user traits              |
| `reset()`     | Regenerates the session and clears context |

---

## Event Payload Schema

```typescript
interface EventPayload {
  eventType: string;
  flowName?: string;
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

## Retry and Flush Logic

- Events are flushed every 5 seconds or on page unload
- Failed flushes are retried with exponential backoff (up to 5 attempts)
- Events are queued in memory until successfully sent

---

## React Integration

### Using the Provider

```tsx
import { OnBoredProvider } from "@onbored/sdk/react";

<OnBoredProvider projectKey="pk_live_123">
  <App />
</OnBoredProvider>;
```

### useFlow Hook

```tsx
const { step, skip, complete } = useFlow("Onboarding", modalOpen);

step("Setup Profile", { method: "email" });
skip("Invite Team", { reason: "Solo user" });
complete();
```

---

## Development Mode

When `env: "development"` is set:

- Events are not sent to the server
- All actions are logged to the console
- Useful for local development and debugging

---

## Session Handling

- Sessions expire after 30 minutes of inactivity
- Session ID is stored in localStorage
- Page views are auto-captured on `init()`

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

---

## Full Example

```typescript
onbored.init("pk_123", { userId: "alice" });

onbored.flow("Onboarding");
onbored.step("Sign Up", { method: "email" });
onbored.step("Complete Profile", { age: 29 });
onbored.skip("Invite Team", { reason: "No team yet" });
onbored.completed({ flow: "Onboarding" });
```

---

## Notes

- Payloads are structured for batch sending and analytics backend ingestion
- Debug logs are grouped for better inspection during development
- Plugin system and devtools support are under development

Let us know if you need documentation on backend integrations, plugin hooks, or event dashboards.
