# OnBored SDK - Work Remaining

> **Target:** 99th percentile production-ready OSS release
> **Focus:** Core functionality + actionable Axiom logging

---

## 🚨 **P0 - CRITICAL (Ship Blockers)**

### **TICKET-001: Fix Schema Validation Mismatch** 
**⏱️ 2-3 hours | 🎯 Core Functionality**
- **Issue:** `eventPayloadSchema` (schema.ts) doesn't match `EventPayload` interface (types.ts)
- **Problem:** Schema expects `slug` but code uses `funnel_slug`, causing validation failures
- **Action:** 
  - Align schema.ts with actual EventPayload interface
  - Fix field names: `slug` → `funnel_slug`, add missing `metadata` field
  - Remove unused `options`, `result`, `traits` from schema
- **Files:** `src/lib/schema.ts`, `src/lib/types.ts`

### **TICKET-002: Implement Actionable Axiom Logging**
**⏱️ 4-6 hours | 🎯 Observability**
- **Issue:** Empty Axiom config, only console logging, no actionable insights
- **Impact:** Cannot monitor SDK health, user adoption, or errors in production
- **Action:**
  - Configure Axiom client with real token/orgId
  - Add SDK performance metrics logging
  - Log actionable events: init failures, retry attempts, session timeouts
  - Add user journey drop-off alerts
  - Track API response times and error rates
- **Files:** `src/config.ts`, `src/lib/logger.ts`

### **TICKET-003: Fix Broken README Examples**
**⏱️ 1-2 hours | 🎯 Developer Experience**
- **Issue:** Code examples in README don't match actual API
- **Problem:** Import paths wrong, prop names inconsistent
- **Action:**
  - Fix import: `@onbored/sdk` → `@momito/onbored-js`
  - Fix API examples: `funnelSlug` → `slug`
  - Add working React example
- **Files:** `README.md`

---

## 🔥 **P1 - HIGH (Launch Ready)**

### **TICKET-004: Add Production Package Metadata**
**⏱️ 1 hour | 🎯 Distribution**
- **Issue:** Missing repository, homepage, bugs URLs in package.json
- **Action:**
  - Add repository URL
  - Add homepage and bugs URLs
  - Update keywords for better discoverability
  - Add engines requirement
- **Files:** `package.json`

### **TICKET-005: Improve Error Handling & Logging**
**⏱️ 3-4 hours | 🎯 Reliability**
- **Issue:** Inconsistent error handling, silent failures
- **Action:**
  - Add structured error types
  - Log initialization failures to Axiom with context
  - Add retry queue overflow alerts
  - Track session registration failure rates
- **Files:** `src/lib/client.ts`, `src/lib/logger.ts`

### **TICKET-006: Session Replay Validation & Error Handling**
**⏱️ 2-3 hours | 🎯 Core Functionality**
- **Issue:** TODO comment about session replay validation
- **Action:**
  - Add proper SessionReplayOptions validation
  - Handle rrweb import failures gracefully
  - Add session replay upload failure metrics
- **Files:** `src/lib/client.ts`, `src/lib/session-replay/client.ts`

---

## ⚡ **P2 - MEDIUM (Polish)**

### **TICKET-007: Basic Core Functionality Tests**
**⏱️ 4-6 hours | 🎯 Quality**
- **Scope:** Core flows only, not 100% coverage
- **Action:**
  - Test SDK initialization
  - Test flow creation and completion
  - Test React hooks basic functionality
  - Test session replay start/stop
- **Files:** `src/__tests__/`

### **TICKET-008: Performance Optimizations**
**⏱️ 2-3 hours | 🎯 Performance**
- **Action:**
  - Add bundle size monitoring
  - Optimize event queue memory usage
  - Add performance metrics to Axiom logs
  - Track initialization time
- **Files:** `src/lib/client.ts`, `tsup.config.ts`

### **TICKET-009: Developer Experience Improvements**
**⏱️ 2-3 hours | 🎯 DX**
- **Action:**
  - Add ESLint + Prettier
  - Add pre-commit hooks
  - Improve TypeScript strict mode compliance
  - Add type documentation
- **Files:** `.eslintrc.js`, `.prettierrc`, `package.json`

---

## 📊 **Key Axiom Logging Metrics (TICKET-002 Details)**

### **SDK Health Metrics**
```typescript
// Log to Axiom for actionable alerts
{
  event: "sdk_init_failed",
  projectKey: string,
  error: string,
  userAgent: string,
  timestamp: ISO,
  action_required: "Check API endpoint health"
}

{
  event: "retry_queue_overflow", 
  queueSize: number,
  droppedEvents: number,
  action_required: "Investigate network issues"
}

{
  event: "session_registration_failed",
  statusCode: number,
  retryAttempt: number,
  action_required: "Check API key validity"
}
```

### **User Journey Metrics**
```typescript
{
  event: "flow_abandonment_rate",
  flowSlug: string,
  dropOffStep: string,
  sessionDuration: number,
  action_required: "Review onboarding flow UX"
}

{
  event: "sdk_performance",
  initTime: number,
  eventQueueSize: number,
  memoryUsage: number,
  action_required: "Optimize if > thresholds"
}
```

---

## ✅ **Definition of Done**

- [ ] All P0 tickets complete
- [ ] Schema validation passes for all events
- [ ] Axiom logging configured with real credentials
- [ ] README examples work out-of-the-box
- [ ] Package published successfully to npm
- [ ] Core functionality tests pass
- [ ] Bundle size < 50KB gzipped
- [ ] No TypeScript errors in strict mode

---

**Estimated Total Time:** 15-20 hours
**Critical Path:** TICKET-001 → TICKET-002 → TICKET-003 (Can ship after P0)
