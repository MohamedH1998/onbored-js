# Onbored JS SDK

> Stop churn in the first 2 weeks. Funnel tracking + session replay for onboarding flows.

[![npm version](https://img.shields.io/npm/v/onbored-js.svg)](https://www.npmjs.com/package/onbored-js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**Account-first analytics**. Buffer events pre-auth, flush on identify. Session replay with privacy controls. Built for B2B SaaS.

---

## Install

```bash
npm i onbored-js
```

---

## Quick Start

**Vanilla JS**

```typescript
import { onbored } from 'onbored-js';

onbored.init({ projectKey: 'pk_live_...' });
onbored.identifyAccount('acct_123', { plan: 'enterprise' });
onbored.funnel('onboarding');
onbored.step('profile-setup', { slug: 'onboarding' });
onbored.complete({ slug: 'onboarding' });
```

**React**

```tsx
import { OnboredProvider, useFunnel } from 'onbored-js/react';

function App() {
  return (
    <OnboredProvider config={{ projectKey: 'pk_live_...', accountId: 'acct_123' }}>
      <OnboardingFlow />
    </OnboredProvider>
  );
}

function OnboardingFlow() {
  const { step, complete } = useFunnel('onboarding');
  return (
    <button onClick={() => step('setup').then(complete)}>
      Done
    </button>
    );
}
```

Events appear at [onbored.io](https://app.onbored.io) instantly.

---

## Core Concepts

**Account-First Architecture**
Events buffer until `identifyAccount()` called. Required for B2B multi-tenant tracking.

**Funnels**
Conversion journeys (e.g., onboarding, checkout). Each gets UUID flow ID.

```typescript
onbored.funnel('signup', { source: 'landing' }); // Returns flow ID
```

**Steps**
Milestones within funnels. Track completions or skips.

```typescript
onbored.step('email-verified', { slug: 'signup', method: 'magic-link' });
onbored.skip('team-setup', { slug: 'signup', reason: 'solo' });
```

**Sessions**
Auto-managed. 30min timeout. Persists in localStorage. Rotates on account switch.

---

## API

### `onbored.init(config)`

Initialize SDK. Call before other methods.

| Option | Type | Description | Required |
|--------|------|-------------|----------|
| `projectKey` | `string` | Project key | ✓ |
| `accountId` | `string` | Account identifier | |
| `accountTraits` | `object` | Account metadata | |
| `userId` | `string` | User identifier | |
| `userTraits` | `object` | User metadata | |
| `debug` | `boolean` | Console logging | |
| `env` | `string` | Skip API calls | |
| `sessionReplay` | `object` | See Session Replay section | |

### `onbored.identifyAccount(accountId, traits?)`

Identify account. Flushes buffered events. Rotates session on change.

```typescript
onbored.identifyAccount('acct_789', { plan: 'enterprise', seats: 50 });
```

### `onbored.identify(userId, traits?)`

Identify user. Optional. Merges traits.

```typescript
onbored.identify('user_101', { email: 'user@co.com', role: 'admin' });
```

### `onbored.funnel(slug, metadata?)`

Start funnel. Returns flow ID (UUID).

```typescript
onbored.funnel('signup', { source: 'google' });
```

### `onbored.step(stepName, options)`

Track step completion.

```typescript
onbored.step('email-verified', { slug: 'signup', method: 'link' });
```

### `onbored.skip(stepName, options)`

Track step skip.

```typescript
onbored.skip('team-invite', { slug: 'signup', reason: 'solo' });
```

### `onbored.complete(options)`

Complete funnel. Flushes immediately.

```typescript
onbored.complete({ slug: 'signup', duration: 420 });
```

### `onbored.capture(eventType, data)`

Custom events.

```typescript
onbored.capture('feature_used', { feature: 'export', format: 'csv' });
```

### `onbored.reset()`

Logout. Clears session + stops replay.

```typescript
onbored.reset();
```

### `onbored.destroy()`

Cleanup. Removes listeners.

```typescript
onbored.destroy();
```

---

## React

### `<OnboredProvider>`

Initializes SDK. Client-side only (use `'use client'` in Next.js App Router).

```tsx
import { OnboredProvider } from 'onbored-js/react';

<OnboredProvider config={{ projectKey: 'pk_live_...', accountId: 'acct_123' }}>
  <App />
</OnboredProvider>
```

**Next.js App Router**

```tsx
// app/providers.tsx
'use client';
import { OnboredProvider } from 'onbored-js/react';

export function Providers({ children }) {
  return (
    <OnboredProvider config={{ projectKey: 'pk_...', accountId: 'acct_...' }}>
      {children}
    </OnboredProvider>
  );
}

// app/layout.tsx
import { Providers } from './providers';
export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>;
}
```

### `useFunnel(slug)`

Auto-starts funnel on mount. Returns `{ step, skip, complete }`.

```tsx
import { useFunnel } from 'onbored-js/react';

function Wizard() {
  const { step, complete } = useFunnel('onboarding');
  return <button onClick={() => step('done').then(complete)}>Finish</button>;
}
```

---

## Session Replay

Record user sessions. GDPR-friendly. Gzip compression. Auto-pause on idle.

### Enable

```typescript
onbored.init({
  projectKey: 'pk_...',
  sessionReplay: {
    apiHost: 'https://api.onbored.com',
    flushInterval: 10000,              // Default: 10s
    maskInputs: true,                  // Default: true
    maskInputOptions: {
      password: true,                  // Always masked
      email: true,                     // Always masked
      tel: true,                       // Always masked
      text: false,                     // Configurable
    },
    blockElements: ['.cc-form'],       // CSS selectors
    privateSelectors: ['[data-ssn]'],  // Additional privacy
  },
});
```

### Privacy Defaults

**Auto-masked inputs:** `password`, `email`, `tel`
**Auto-blocked elements:** `[data-private]`, `[data-sensitive]`, `.private`, `.sensitive`, `.ssn`, `.credit-card`

### Flush Triggers

- Size: >900KB
- Event count: >100
- Time: Every 10s (configurable)
- Page hidden
- Session stop

### Account Rotation

On `identifyAccount()` call:
1. Stop current recording
2. Rotate session
3. Restart with new account context
4. Emit `replay_stopped` + `replay_started`

---

## Advanced

### Custom Storage

```typescript
onbored.init({
  projectKey: 'pk_...',
  storage: {
    sessionStorageKey: 'custom-session',
    activityStorageKey: 'custom-activity',
    flowContextStorageKey: 'custom-flow',
  },
});
```

### Custom Headers

```typescript
onbored.init({
  projectKey: 'pk_...',
  global: { headers: { Authorization: 'Bearer token' } },
});
```

### Development Mode

No API calls. Console logging. Manual flush via `window.__onboredFlush()`.

```typescript
onbored.init({ projectKey: 'pk_...', env: 'development', debug: true });
```

### TypeScript

Full type definitions included.

```typescript
import type { OnboredClientOptions, EventPayload } from 'onbored-js';
```

---

## Examples

### B2B SaaS Onboarding

```tsx
import { OnboredProvider, useFunnel } from 'onbored-js/react';

<OnboredProvider config={{
  projectKey: 'pk_...',
  accountId: org.id,
  accountTraits: { plan: org.plan, seats: org.seats },
  userId: user.id,
  sessionReplay: { apiHost: 'https://api.onbored.com' },
}}>
  <Wizard />
</OnboredProvider>

function Wizard() {
  const { step, skip, complete } = useFunnel('setup');
  return (
    <>
      <button onClick={() => step('profile')}>Profile</button>
      <button onClick={() => skip('team', { reason: 'solo' })}>Skip Team</button>
      <button onClick={() => complete()}>Done</button>
    </>
  );
}
```

### Pre-Auth Flow

```typescript
// Before user authenticates
onbored.init({ projectKey: 'pk_...' });
onbored.funnel('signup');                    // Buffered
onbored.step('email-entered', { slug: 'signup' }); // Buffered

// After auth
onbored.identifyAccount('acct_123');         // Flushes buffered events
onbored.step('verified', { slug: 'signup' });
onbored.complete({ slug: 'signup' });
```

### Auto-Tracking

```html
<div data-onbored-step="welcome" data-onbored-funnel="onboarding">
  Welcome! (tracked via IntersectionObserver at 50% visibility)
</div>
```

---

## Architecture

**Queue Strategy**
- In-memory queue: 5s flush or 100 events
- Retry: Exponential backoff, max 5 attempts
- Unload: `sendBeacon()` fallback
- Complete: Immediate flush

**Session Management**
- 30min timeout
- UUID-based, localStorage
- Auto-rotation on account switch
- Page navigation tracked (SPA support)

**Funnel Context**
- UUID flow ID per funnel
- sessionStorage persistence
- Auto page view tracking
- IntersectionObserver for step views (50% threshold)

---

## Troubleshooting

**Events not appearing**
- Check `env: 'production'` (dev mode skips API)
- Verify `projectKey` at [onbored.io](https://onbored.io)
- Enable `debug: true`, check console
- Network tab: Look for `/ingest/events`

**React hook errors**
- Ensure `<OnboredProvider>` wraps components
- Use `'use client'` in Next.js App Router

**Session not persisting**
- Check localStorage availability
- Incognito mode may block storage

**Funnel context lost**
- sessionStorage required
- Same `projectKey` across pages
- Call `funnel()` before navigation

---

## Development

```bash
git clone https://github.com/MohamedH1998/onbored-js.git && cd onbored-js
pnpm install
pnpm dev        # Watch mode
pnpm test       # Unit tests
pnpm test:e2e   # E2E (Playwright)
pnpm build      # Build for production
```

**Releases:** [Changesets](https://github.com/changesets/changesets) + GitHub Actions
1. `pnpm changeset` → describe change
2. Commit changeset file
3. Merge to `main` → auto-publish to npm

**Pre-release stages:** alpha → beta → rc → stable (currently alpha)

---

## Links

[Website](https://onbored.io) • [npm](https://npmjs.com/package/onbored-js) • [GitHub](https://github.com/MohamedH1998/onbored-js) • [Issues](https://github.com/MohamedH1998/onbored-js/issues)

**Support:** info@onbored.io • [@momito](https://twitter.com/momito)

MIT © [Onbored](https://onbored.io)
