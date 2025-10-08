Onbored is a retention OS designed to solve the most critical problem in SaaS: user churn - specifically, we focus on the first 2 weeks after a user signs up, a period that determines whether a user will tick around or drop off.

How Onbored Solves It:

- Real-time funnel analytics: Onbored identifies exactly where users drop off during onboarding and activation, allowing teams to fix issues before users churn.
- Automated, AI-Driven Insights: our platform analyses user behaviour to detect confusion, hesitation, or failed intent, and provides insights on how to address these issues.
- Proactive User Prompting: Onbored automatically reminds or nudges who haven't complete activation, ensuring they engaged and move through the key steps in the journey
- At-Risk user alerts: if a user shows signs of hesitation or disengagement, Onbored flags them as at-risk, allowing teams to intervene early and prevent churn.
- Developer-Friendly SDK: Onbored integrates seamlessly in under 10 minutes giving SaaS teams a quickly, easy way to track and improve activation without the need for a dedicated data team

---

## Competitive Analysis & Product Assessment

### Market Position vs. Competitors

#### **vs. PostHog**
**What they do well:**
- Comprehensive product analytics platform with feature flags, A/B testing, session replay
- Self-hostable option appeals to privacy-conscious orgs
- All-in-one platform reduces vendor sprawl
- Strong developer experience with extensive SDKs

**Where Onbored could differentiate:**
- PostHog is broad; Onbored is laser-focused on the critical 0-14 day window
- Onbored's AI-driven insights for onboarding are more specialized than PostHog's general analytics
- PostHog requires more setup and data modeling to extract onboarding insights
- Onbored's proactive intervention (nudges, at-risk alerts) is more actionable out-of-the-box

**Risk:** PostHog could easily add onboarding-specific features given their platform foundation.

#### **vs. Amplitude**
**What they do well:**
- Industry-leading product analytics with sophisticated cohort analysis
- Strong data governance and enterprise features
- Behavioral cohorting and predictive analytics
- Deep integration ecosystem

**Where Onbored could differentiate:**
- Amplitude is enterprise-focused and complex; Onbored targets quick time-to-value
- Onbored's "under 10 minutes" integration vs. Amplitude's weeks-long implementations
- Onbored focuses specifically on activation funnels, not general product usage
- Price point: Amplitude is expensive; Onbored could target SMB/mid-market

**Risk:** Onbored lacks Amplitude's analytical depth and maturity.

#### **Overall Market Position**
**Strengths:**
1. **Hyper-focused niche:** The 0-14 day activation window is underserved
2. **Quick time-to-value:** "Under 10 minutes" is compelling vs. PostHog/Amplitude setup
3. **Actionable by default:** Nudges and alerts > passive dashboards
4. **AI insights:** Detecting "confusion, hesitation, failed intent" is unique

**Weaknesses:**
1. **Limited scope:** Once onboarding is solved, customers may churn or need additional tools
2. **Dependency on backend:** Without a real analytics backend, it's just an SDK
3. **Competitive moat:** Features are easily replicable by established players
4. **Market education:** "Retention OS" is unclear; need clearer positioning

**Recommended positioning:**
"The onboarding analytics platform that prevents churn in the first 2 weeks—before it's too late."

---

### SDK Quality Assessment

#### **Production Readiness: 6/10** ⚠️

**What's Good:**
1. **Solid core architecture:**
   - Instance-based design supports multi-tenancy well
   - Event queue with retry logic and exponential backoff
   - Session management with 30-minute timeouts
   - Flow context persistence via sessionStorage
   - Automatic cleanup (destroy() method)

2. **Developer experience:**
   - Clean API surface (`flow()`, `step()`, `skip()`, `complete()`)
   - React hooks integration is elegant
   - TypeScript support with Zod validation
   - Development mode prevents accidental data sends
   - Good debug logging

3. **Feature completeness:**
   - Session replay integration (rrweb)
   - Offline support with event queuing
   - Automatic page view tracking
   - Intersection Observer for step visibility
   - History API patching for SPA navigation

**What's Concerning:**

1. **Browser-only limitation:**
   - Hard requirement for `window` and `document` (line 88-93, client.ts)
   - No SSR support for Next.js/Remix apps
   - Blocks adoption in modern React frameworks
   - **Fix:** Add isomorphic wrapper that no-ops on server

2. **Testing gaps (critical):**
   - Only 70% code coverage (target: 80-90%)
   - 11 failing tests in session replay suite
   - Missing tests for:
     - Offline/online transitions
     - Network failure scenarios
     - SessionStorage corruption
     - Race conditions during init
   - **Fix:** Address failing tests immediately; add integration tests

3. **Error handling:**
   - Silent failures in many places (try/catch with only logs)
   - No error callbacks or events for consumers
   - localStorage failures are logged but not surfaced
   - **Fix:** Add `onError` callback option; emit error events

4. **Type safety issues:**
   - `Options` type is overly permissive (`Record<string, any>`)
   - `metadata` field accepts anything
   - No validation on step names or flow slugs
   - **Fix:** Stricter types for metadata; validate identifiers

5. **Bundle size concerns:**
   - rrweb dependency adds ~720KB to IIFE bundle
   - No tree-shaking for unused features
   - Session replay should be optional at build time
   - **Fix:** Make session replay a separate entrypoint

6. **API design inconsistencies:**
   - Some methods require `{ slug: string }`, others use positional args
   - `complete()` vs `complete()` naming (hooks vs client)
   - `user_id` vs `userId` (snake_case vs camelCase)
   - **Fix:** Standardize on camelCase; consistent parameter patterns

7. **Performance concerns:**
   - 5-second flush interval could batch too much
   - No max batch size for event payloads
   - Intersection Observer observes all elements (no unobserve)
   - MutationObserver on entire `document.body`
   - **Fix:** Add batch size limits; optimize observers

8. **Missing enterprise features:**
   - No consent management integration
   - No data sampling/rate limiting
   - No client-side PII redaction
   - No custom transport layer
   - **Fix:** Add privacy-first features for GDPR compliance

9. **Lack of observability:**
   - No internal metrics (events queued, flush success rate, etc.)
   - No health check endpoint
   - Consumers can't monitor SDK health
   - **Fix:** Add `getStatus()` method; emit lifecycle events

10. **Documentation gaps:**
    - No migration guide for version updates
    - Missing troubleshooting section
    - No best practices for multi-page apps
    - Examples lack error handling
    - **Fix:** Comprehensive docs with real-world scenarios

#### **Specific Code Issues:**

1. **Race condition in initialization:**
   ```typescript
   // client.ts:570-574
   async flow(slug: string, metadata?: Options) {
     if (this.isInitializing) {
       this.queuedFlows.push(slug);
       return; // But what if init fails? Queued flows lost
     }
   ```
   **Fix:** Retry queued flows even on init failure

2. **Memory leak potential:**
   ```typescript
   // client.ts:540-553 - IntersectionObserver never unobserves
   const observed = new WeakSet<Element>();
   this.intersectionObserver?.observe(el);
   ```
   **Fix:** Unobserve elements when they're removed from DOM

3. **Unsafe type coercion:**
   ```typescript
   // client.ts:728 - Dangerous 'any' cast
   const { flow_id, step_id, funnel_slug, metadata, ...otherData } = data as any;
   ```
   **Fix:** Proper type guards or discriminated unions

4. **Missing cleanup:**
   ```typescript
   // client.ts:789-798 - destroy() clears intervals but not eventQueue
   destroy() {
     // ... clears timers and observers
     // But this.eventQueue, this.retryQueue still in memory
   }
   ```
   **Fix:** Clear all queues in destroy()

---

### What Would Make It Even Better

#### **Priority 1: Stability & Reliability**
1. **Fix all failing tests** - Non-negotiable for production
2. **SSR/SSG support** - Add server-side safe initialization
3. **Error boundaries** - Surface errors to consumers
4. **Network resilience** - Better offline handling and retry logic
5. **Bundle optimization** - Split session replay into separate chunk

#### **Priority 2: Enterprise Readiness**
1. **Privacy controls:**
   - PII redaction API
   - Consent mode integration (Google/OneTrust)
   - Data sampling controls
   - IP anonymization option

2. **Observability:**
   - SDK health monitoring
   - Internal metrics (queue depth, flush rate, errors)
   - Debug mode enhancements (visualize event flow)

3. **Security:**
   - CSP-compliant inline scripts
   - Subresource integrity (SRI) for CDN
   - API key rotation support

#### **Priority 3: Developer Experience**
1. **Framework-specific integrations:**
   - Next.js plugin with App Router support
   - Vue.js composables
   - Svelte stores
   - Angular services

2. **DevTools:**
   - Browser extension to visualize flows in real-time
   - Event inspector (like Redux DevTools)
   - Flow graph visualization

3. **Testing utilities:**
   - Mock client for unit tests
   - Playwright fixtures for E2E tests
   - Cypress plugin

4. **Better TypeScript:**
   - Strict mode compatible
   - Generic type parameters for metadata
   - Inferred types from flow definitions

#### **Priority 4: Feature Expansion**
1. **Advanced analytics:**
   - Client-side event aggregation
   - Funnel conversion calculations
   - Anomaly detection (client-side ML)

2. **Smart queueing:**
   - Priority queues (critical events first)
   - Deduplication
   - Local caching with IndexedDB

3. **Advanced session replay:**
   - Canvas/WebGL recording
   - Network request logging
   - Console message capture
   - Rage click detection

---

### Critical Path to Production

**Before v1.0:**
1. ✅ Fix all 11 failing tests
2. ✅ Add SSR support (React 18+, Next.js)
3. ✅ Implement proper error handling with callbacks
4. ✅ Add bundle size optimizations
5. ✅ Write comprehensive integration tests
6. ✅ Create migration/upgrade guide
7. ✅ Add health monitoring APIs
8. ✅ Security audit (especially session replay)

**Nice-to-haves for v1.0:**
- Privacy controls (consent mode)
- Framework plugins (Vue, Svelte)
- DevTools browser extension

---

### Final Verdict

**The Good:**
- Core SDK architecture is solid and well-thought-out
- Flow tracking model is intuitive and matches mental model
- React integration is clean and ergonomic
- Session replay integration adds significant value

**The Bad:**
- Browser-only limitation blocks modern framework adoption
- Test failures indicate instability
- Missing enterprise/privacy features
- Bundle size is concerning for performance-sensitive apps

**The Ugly:**
- Without the backend analytics platform, it's unclear what makes this better than PostHog/Amplitude
- "Retention OS" positioning doesn't match SDK scope
- Competitive moat is weak—features are table stakes for analytics platforms

**Recommendation:**
1. **Immediate:** Fix failing tests, add SSR support, reduce bundle size
2. **Short-term:** Build out the AI insights backend that justifies the "Retention OS" positioning
3. **Long-term:** Expand beyond onboarding or risk being a feature, not a platform

**Production readiness timeline:**
- **Current state:** Alpha/Beta (v0.1.0-alpha.1 is accurate)
- **With fixes:** 6-8 weeks to production-ready v1.0
- **Realistic GA:** 3-4 months with proper testing and customer validation

The SDK shows promise, but needs polish before it's truly production-ready for demanding customers.