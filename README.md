# Onbored JS SDK

> The onboarding analytics platform that prevents churn in the first 2 weeks—before it's too late

[![npm version](https://img.shields.io/npm/v/onbored-js.svg)](https://www.npmjs.com/package/onbored-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Onbored is a retention OS designed to solve the most critical problem in SaaS: user churn - specifically, we focus on the first 2 weeks after a user signs up, a period that determines whether a user will tick around or drop off.

## ✨ Features

- **Flow Tracking** - Track complete user journeys with flow start, steps, skips, and completions
- **Session Replay** - Record and replay user sessions to see exactly what happened
- **Automatic Page Views** - Automatically capture navigation and page view events
- **Offline Support** - Queue events with retry logic and exponential backoff
- **React Integration** - First-class React support with hooks and context providers
- **Type Safety** - Full TypeScript support with comprehensive types
- **Development Mode** - Test locally without sending events to production
- **Multi-Instance** - Support for multiple projects and tenants
- **Lightweight** - Small bundle size with minimal dependencies

---

## 🚀 Quick Start (5 minutes)

### 1. Create your account

Sign up at **[onbored.io](https://onbored.io)** and create a new project to get your API key.

### 2. Install the SDK

```bash
npm install onbored-js
# or
yarn add onbored-js
# or
pnpm add onbored-js
```

### 3. Initialize and start tracking

**Vanilla JavaScript**

```typescript
import { onbored } from 'onbored-js';

// Initialize with your project key
onbored.init({
  projectKey: 'pk_live_1234567890abcdef', // Get this from onbored.io
  user_id: 'user_123',
  user_metadata: { plan: 'premium' },
  debug: true,
});

// Track your first flow
onbored.flow('onboarding');
onbored.step('profile-setup', { slug: 'onboarding' });
onbored.complete({ slug: 'onboarding' });
```

**React**

```tsx
import { OnboredProvider, useFlow } from 'onbored-js/react';

function App() {
  return (
    <OnboredProvider
      config={{
        projectKey: 'pk_live_1234567890abcdef',
        user_id: 'user_123',
        debug: true,
      }}
    >
      <OnboardingFlow />
    </OnboredProvider>
  );
}

function OnboardingFlow() {
  const { step, skip, complete } = useFlow('onboarding');

  return (
    <div>
      <button onClick={() => step('profile-setup')}>Complete Profile</button>
      <button onClick={() => skip('team-invite')}>Skip Team Invite</button>
      <button onClick={() => complete()}>Finish Onboarding</button>
    </div>
  );
}
```

That's it! 🎉 Head to your [Onbored dashboard](https://onbored.io) to see your events in real-time.

---

## 📚 Core Concepts

### Flows

A **flow** represents a complete user journey (e.g., onboarding, checkout, feature tour). Each flow has a unique slug identifier and tracks the user's progress through multiple steps.

```typescript
// Start a new flow
onbored.flow('onboarding');
```

### Steps

**Steps** are individual actions or milestones within a flow. Track when users complete important actions.

```typescript
// Track a completed step
onbored.step('profile-setup', {
  slug: 'onboarding',
  method: 'email',
  duration: 120,
});
```

### Skips

When users skip optional steps, track them with **skip** to understand which parts of your flow are being bypassed.

```typescript
// Track a skipped step
onbored.skip('team-invite', {
  slug: 'onboarding',
  reason: 'no team yet',
});
```

### Completions

Mark a flow as complete when the user finishes the entire journey.

```typescript
// Complete a flow
onbored.complete({
  slug: 'onboarding',
  totalSteps: 5,
  duration: 600,
});
```

### Sessions

Sessions are automatically managed with a 30-minute inactivity timeout. Each session is uniquely identified and persisted in localStorage.

---

## 🎯 API Reference

### `onbored.init(config)`

Initialize the Onbored SDK. Must be called before any other methods.

**Parameters:**

| Parameter        | Type                            | Required | Description                                            |
| ---------------- | ------------------------------- | -------- | ------------------------------------------------------ |
| `projectKey`     | `string`                        | ✅       | Your project key from [onbored.io](https://onbored.io) |
| `user_id`        | `string`                        | ❌       | Unique identifier for the user                         |
| `user_metadata`  | `object`                        | ❌       | Additional user properties (plan, role, etc.)          |
| `debug`          | `boolean`                       | ❌       | Enable debug logging (default: `false`)                |
| `env`            | `'development' \| 'production'` | ❌       | Environment mode (default: `'production'`)             |
| `api_host`       | `string`                        | ❌       | Custom API host (default: `'https://api.onbored.com'`) |
| `storage`        | `Storage`                       | ❌       | Custom storage keys                                    |
| `global`         | `GlobalOptions`                 | ❌       | Custom fetch and headers                               |
| `session_replay` | `SessionReplayOptions \| false` | ❌       | Session replay configuration                           |

**Example:**

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  user_id: 'user_123',
  user_metadata: {
    plan: 'premium',
    role: 'admin',
    companySize: '11-50',
  },
  debug: true,
  env: 'production',
});
```

---

### `onbored.flow(slug, metadata?)`

Start tracking a new flow. Creates a unique flow ID on the server.

**Parameters:**

- `slug` (string): Unique identifier for the flow
- `metadata` (object, optional): Additional flow context

**Example:**

```typescript
onbored.flow('checkout', {
  cartValue: 299.99,
  items: 3,
});
```

---

### `onbored.step(stepName, options)`

Track completion of a step within a flow.

**Parameters:**

- `stepName` (string): Name of the step
- `options.slug` (string): Flow slug this step belongs to
- `options.*` (any): Additional step metadata

**Example:**

```typescript
onbored.step('payment-method', {
  slug: 'checkout',
  method: 'credit_card',
  provider: 'stripe',
});
```

---

### `onbored.skip(stepName, options)`

Track when a user skips an optional step.

**Parameters:**

- `stepName` (string): Name of the skipped step
- `options.slug` (string): Flow slug this step belongs to
- `options.*` (any): Additional context (e.g., reason)

**Example:**

```typescript
onbored.skip('add-team-members', {
  slug: 'onboarding',
  reason: 'solo_user',
});
```

---

### `onbored.complete(options)`

Mark a flow as complete.

**Parameters:**

- `options.slug` (string): Flow slug to complete
- `options.*` (any): Additional completion metadata

**Example:**

```typescript
onbored.complete({
  slug: 'onboarding',
  totalSteps: 5,
  duration: 420,
  success: true,
});
```

---

### `onbored.capture(eventType, data)`

Manually capture custom events.

**Parameters:**

- `eventType` (EventType): Type of event
- `data` (object): Event payload

**Example:**

```typescript
onbored.capture('page_viewed', {
  url: window.location.href,
  title: document.title,
});
```

---

### `onbored.reset()`

Reset the session and clear all user context. Useful for logout scenarios.

**Example:**

```typescript
onbored.reset();
```

---

### `onbored.destroy()`

Clean up all resources, event listeners, and timers. Call this when unmounting your app.

**Example:**

```typescript
onbored.destroy();
```

---

## ⚛️ React Integration

### `<OnboredProvider>`

Wrap your app with the provider to automatically initialize the SDK.

**Props:**

| Prop       | Type                   | Required | Description       |
| ---------- | ---------------------- | -------- | ----------------- |
| `config`   | `OnboredClientOptions` | ✅       | SDK configuration |
| `children` | `ReactNode`            | ✅       | Child components  |

**Example:**

```tsx
import { OnboredProvider } from 'onbored-js/react';

function App() {
  return (
    <OnboredProvider
      config={{
        projectKey: 'pk_live_1234567890abcdef',
        user_id: 'user_123',
        user_metadata: { plan: 'premium' },
        debug: true,
      }}
    >
      <YourApp />
    </OnboredProvider>
  );
}
```

---

### `useFlow(slug)`

Hook for managing flows within React components. Automatically starts the flow on mount.

**Parameters:**

- `slug` (string): Flow identifier

**Returns:**

- `step(stepName, options?)` - Track a completed step
- `skip(stepName, options?)` - Track a skipped step
- `complete(options?)` - Mark flow as complete

**Example:**

```tsx
import { useFlow } from 'onbored-js/react';

function OnboardingWizard() {
  const { step, skip, complete } = useFlow('onboarding');

  const handleProfileComplete = () => {
    step('profile-setup', { method: 'email' });
  };

  const handleSkipTeamInvite = () => {
    skip('team-invite', { reason: 'solo_user' });
  };

  const handleFinish = () => {
    complete({ totalSteps: 5 });
  };

  return (
    <div>
      <button onClick={handleProfileComplete}>Complete Profile</button>
      <button onClick={handleSkipTeamInvite}>Skip Team Invite</button>
      <button onClick={handleFinish}>Finish</button>
    </div>
  );
}
```

---

## 🎥 Session Replay

Record and replay user sessions to see exactly what users experienced.

### Enable Session Replay

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  session_replay: {
    api_host: 'https://api.onbored.com',
    flush_interval: 10000, // Flush every 10 seconds
    mask_inputs: true, // Mask sensitive input fields
    block_elements: ['.sensitive-data'], // CSS selectors to block
    on_error: err => console.error('Replay error:', err),
  },
});
```

### Session Replay Options

| Option           | Type       | Default  | Description                             |
| ---------------- | ---------- | -------- | --------------------------------------- |
| `api_host`       | `string`   | Required | API endpoint for replay data            |
| `flush_interval` | `number`   | `10000`  | How often to flush events (ms)          |
| `mask_inputs`    | `boolean`  | `true`   | Automatically mask input fields         |
| `block_elements` | `string[]` | `[]`     | CSS selectors to exclude from recording |
| `on_error`       | `function` | -        | Error handler callback                  |

---

## 🔧 Advanced Configuration

### Custom Storage Keys

Customize the localStorage and sessionStorage keys used by the SDK.

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  storage: {
    sessionStorageKey: 'my-app-session',
    activityStorageKey: 'my-app-activity',
    flowContextStorageKey: 'my-app-flow-context',
  },
});
```

---

### Custom Headers

Add custom headers to all API requests.

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  global: {
    headers: {
      Authorization: 'Bearer token',
      'X-Custom-Header': 'value',
    },
  },
});
```

---

### Multi-Instance Setup

Create multiple SDK instances for different projects or tenants.

```typescript
import { OnboredClient } from 'onbored-js/lib';

const projectA = new OnboredClient('pk_live_project_a', {
  user_id: 'user_123',
  storage: {
    sessionStorageKey: 'projecta-session',
    activityStorageKey: 'projecta-activity',
    flowContextStorageKey: 'projecta-flow',
  },
});

const projectB = new OnboredClient('pk_live_project_b', {
  user_id: 'user_123',
  storage: {
    sessionStorageKey: 'projectb-session',
    activityStorageKey: 'projectb-activity',
    flowContextStorageKey: 'projectb-flow',
  },
});

// Use independently
await projectA.flow('onboarding');
await projectB.flow('checkout');
```

---

## 🛠️ Development Mode

Run the SDK locally without sending events to production.

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  env: 'development',
  debug: true,
});

// Events are logged to console but not sent to server
onbored.flow('test-flow');
// Console: "Mock flow started: test-flow"
```

**Debug Helper:**

```javascript
// Manually flush events in development mode
window.__onboredFlush();
```

---

## 📝 TypeScript Support

The SDK is written in TypeScript and includes comprehensive type definitions.

```typescript
import type {
  OnboredClientOptions,
  EventPayload,
  FlowContext,
  Options,
  EventType,
} from 'onbored-js/lib/types';

// All methods are fully typed
onbored.step('profile-setup', {
  slug: 'onboarding',
  // TypeScript will validate these properties
  method: 'email',
  duration: 120,
});
```

---

## 💡 Complete Examples

### SaaS Onboarding with React

```tsx
import { OnboredProvider, useFlow } from 'onbored-js/react';

function App() {
  return (
    <OnboredProvider
      config={{
        projectKey: 'pk_live_1234567890abcdef',
        user_id: currentUser.id,
        user_metadata: {
          plan: currentUser.plan,
          role: currentUser.role,
          companySize: currentUser.company.size,
        },
        debug: process.env.NODE_ENV === 'development',
      }}
    >
      <OnboardingWizard />
    </OnboredProvider>
  );
}

function OnboardingWizard() {
  const { step, skip, complete } = useFlow('onboarding');
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = (stepName: string, metadata?: any) => {
    step(stepName, metadata);
    setCurrentStep(prev => prev + 1);
  };

  const handleSkip = (stepName: string, reason: string) => {
    skip(stepName, { reason });
    setCurrentStep(prev => prev + 1);
  };

  const handleFinish = () => {
    complete({
      totalSteps: 5,
      completionRate: 0.8,
      duration: 420,
    });
  };

  return (
    <div>
      {currentStep === 1 && (
        <ProfileSetup onComplete={() => handleNext('profile-setup')} />
      )}
      {currentStep === 2 && (
        <TeamInvite
          onComplete={() => handleNext('team-invite')}
          onSkip={() => handleSkip('team-invite', 'solo_user')}
        />
      )}
      {currentStep === 3 && (
        <IntegrationSetup
          onComplete={provider => handleNext('integration', { provider })}
        />
      )}
      {currentStep === 4 && (
        <BillingSetup onComplete={() => handleNext('billing')} />
      )}
      {currentStep === 5 && <FinalStep onComplete={handleFinish} />}
    </div>
  );
}
```

---

### E-commerce Checkout Flow

```typescript
// Initialize SDK
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  user_id: user.id,
  user_metadata: {
    plan: user.plan,
    lifetimeValue: user.ltv,
  },
});

// Start checkout flow
onbored.flow('checkout', {
  cartValue: 299.99,
  items: 3,
});

// Track steps
onbored.step('cart-review', { slug: 'checkout' });
onbored.step('shipping-info', {
  slug: 'checkout',
  country: 'US',
  method: 'express',
});
onbored.step('payment-method', {
  slug: 'checkout',
  method: 'credit_card',
});

// Complete checkout
onbored.complete({
  slug: 'checkout',
  orderId: 'ord_123',
  revenue: 299.99,
});
```

---

### Automatic Step View Tracking

Track when users view specific steps without manual instrumentation using data attributes.

```html
<div data-onbored-step="welcome-screen" data-onbored-funnel="onboarding">
  Welcome to our app!
</div>

<div data-onbored-step="profile-setup" data-onbored-funnel="onboarding">
  Complete your profile
</div>
```

The SDK automatically tracks when these elements become visible using Intersection Observer.

---

## 🔍 How It Works

### Architecture

```
┌─────────────────┐
│   Your App      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Onbored SDK    │◄─── Session Management
│                 │◄─── Event Queue & Retry
│                 │◄─── Flow Context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Endpoints  │
│                 │
│ /ingest/session │─── Register sessions
│ /ingest/flow    │─── Register flows
│ /ingest/events  │─── Batch event ingestion
└─────────────────┘
```

### Event Queue & Retry Logic

- Events are queued in memory and flushed every 5 seconds
- Failed requests retry with exponential backoff (up to 5 attempts)
- Events are sent via `sendBeacon` on page unload
- Flow completion events are flushed immediately

### Session Management

- Sessions expire after 30 minutes of inactivity
- Session IDs are stored in localStorage
- Flow contexts are stored in sessionStorage
- Automatic session regeneration on expiration

### Flow Context

- Each flow gets a unique server-generated ID
- Flow state is persisted across page reloads
- Automatic page view tracking for active flows
- Flow completion triggers immediate event flush

---

## ❓ Troubleshooting

### Events not showing up in dashboard

**Check:**

1. Is `env: 'development'` enabled? Events won't be sent in dev mode.
2. Is your project key correct? Verify at [onbored.io](https://onbored.io)
3. Check browser console for errors with `debug: true`
4. Verify network requests in DevTools Network tab

**Example:**

```typescript
onbored.init({
  projectKey: 'pk_live_1234567890abcdef',
  debug: true, // Enable debug logging
  env: 'production', // Make sure it's not 'development'
});
```

---

### React hooks not working

**Issue:** `useFlow` throws "SDK not initialized"

**Solution:** Ensure `OnboredProvider` wraps your components

```tsx
// ❌ Wrong
<YourComponent />

// ✅ Correct
<OnboredProvider config={{ projectKey: '...' }}>
  <YourComponent />
</OnboredProvider>
```

---

### Session not persisting

**Issue:** New session on every page load

**Solution:** Check localStorage access. Some browsers block localStorage in incognito mode or with strict privacy settings.

```typescript
// Check localStorage availability
try {
  localStorage.setItem('test', 'test');
  localStorage.removeItem('test');
} catch (e) {
  console.error('localStorage not available');
}
```

---

### Flow context lost on page reload

**Issue:** Flow context not restored after navigation

**Solution:** Flow contexts are stored in sessionStorage. Ensure:

1. You're using the same `projectKey`
2. SessionStorage is available
3. Flow was properly initialized before navigation

---

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more details.

### Development Setup

```bash
# Clone the repo
git clone https://github.com/MohamedH1998/onbored-js.git
cd onbored-js

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Build the project
pnpm build

# Watch mode for development
pnpm dev
```

### Running Tests

```bash
# Unit tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e

# E2E tests with UI
pnpm test:e2e:ui

# All tests
pnpm test:all
```

---

## 📄 License

MIT © [Onbored](https://onbored.io)

---

## 🔗 Links

- **Website:** [https://onbored.io](https://onbored.io)
- **Documentation:** Coming soon...
- **NPM Package:** [https://www.npmjs.com/package/onbored-js](https://www.npmjs.com/package/onbored-js)
- **GitHub:** [https://github.com/MohamedH1998/onbored-js](https://github.com/MohamedH1998/onbored-js)
- **Issues:** [https://github.com/MohamedH1998/onbored-js/issues](https://github.com/MohamedH1998/onbored-js/issues)

---

## 💬 Support

Need help? Reach out:

- 📧 Email: info@onbored.io
- 🐦 Twitter: [@momito](https://twitter.com/momito)

---

Made with ❤️ by Mohamed
