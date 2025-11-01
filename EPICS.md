# Product Epics: Account Insight Delivery System

> **Philosophy**: Accounts not users. Signals not events. Decide not display. Deliver not dashboard.

## Epic Priority Framework

- **P0 (MVP)**: Ship first. Validates core hypothesis. Revenue-enabling.
- **P1 (Phase 2)**: Unlocks customer retention and expansion. Delivers promised value.
- **P2 (Future)**: Differentiation and scale. AI-powered, predictive.

---

## P0: MVP EPICS (Ship First)

### Epic 1: Account-First SDK Foundation
**Goal**: Lightweight, opinionated SDK that emits meaningful account-level signals.

**Why this matters**: The SDK is our interface contract. Get this right or everything downstream breaks. Must be <5kb, zero dependencies, account-first from day one.

**Scope**:
- Core SDK package (`@onbored/sdk`)
- Account context initialization (`init({ accountId, userId, metadata })`)
- Three signal types: flow, value, friction
- Signal emission API (`signal.emit()`)
- Flow lifecycle API (`flow.start()`, `flow.complete()`)
- Browser + Node.js support
- Batching and retry logic for reliability
- Zero external dependencies

**API Surface**:
```typescript
// Initialization
onboard.init({
  apiKey: string,
  accountId: string,
  userId?: string,
  metadata?: Record<string, any>
})

// Flow tracking
onboard.flow.start(flowName: string, context?: object)
onboard.flow.complete(flowName: string, outcome: 'success' | 'abandoned' | 'error', metadata?: object)

// Direct signal emission
onboard.signal.emit(type: 'flow' | 'value' | 'friction', payload: object)
```

**Acceptance Criteria**:
- [ ] Bundle size <5kb gzipped
- [ ] Zero runtime dependencies
- [ ] Works in browser (ES6+) and Node.js (16+)
- [ ] Handles offline scenarios (queues signals)
- [ ] Respects customer's account model (doesn't force structure)
- [ ] Sub-50ms overhead per signal
- [ ] Documented with 3+ working examples
- [ ] TypeScript types included

**Out of scope**:
- Auto-tracking
- Session recording
- Generic pageview/click tracking
- Mobile SDKs

**Success Metrics**:
- SDK initialization time <100ms
- Signal delivery latency p95 <200ms
- Zero dropped signals under normal conditions
- Developer setup time <15 minutes

**Dependencies**: None (foundational)

**Estimated complexity**: Large (4-6 weeks)

---

### Epic 2: Account-Centric Data Platform
**Goal**: Build the data backbone that thinks in accounts, not events.

**Why this matters**: Traditional analytics tools think in events and users. We're betting on account-level aggregation being the unlock. This is our core differentiation.

**Scope**:
- Tinybird data pipelines for real-time signal ingestion
- Account entity model (first-class, not derived)
- User entity model (context within account)
- Signal storage (time-series, account-rolled-up)
- Account aggregation queries (signal counts, timeline)
- Signal ingestion API endpoint
- Account query API (by ID, by signals, by timeframe)

**Data Model**:
```
Accounts
  - account_id (primary)
  - first_seen
  - last_seen
  - metadata (JSON)
  - signal_counts (aggregated)

Users
  - user_id (primary)
  - account_id (foreign key)
  - first_seen
  - last_seen

Signals
  - signal_id
  - account_id (indexed heavily)
  - user_id
  - signal_type (flow/value/friction)
  - payload (JSON)
  - timestamp
  - processed (boolean)
```

**Acceptance Criteria**:
- [ ] Ingests 10k+ signals/second with p99 <100ms
- [ ] Query account by ID with full signal history <50ms
- [ ] Query all accounts with signal filters <200ms
- [ ] Automatic account creation on first signal
- [ ] Account-level aggregations update in real-time
- [ ] 30-day signal retention minimum (configurable)
- [ ] Data pipelines are idempotent (replay-safe)

**Out of scope**:
- User journey visualization
- Event-level drill-down UI
- Data exports (CSV, etc.)
- PostHog integration (later epic)

**Success Metrics**:
- Ingestion latency p99 <100ms
- Query latency p95 <200ms
- Zero data loss
- Handles 100+ customers with isolated data

**Dependencies**: Epic 1 (SDK signal format)

**Estimated complexity**: Large (5-7 weeks)

---

### Epic 3: Rule-Based Decision Engine
**Goal**: Simple, powerful IF/THEN rules that turn signals into insights.

**Why this matters**: This is where "decide, don't display" comes to life. Rules codify customer knowledge about what matters. Start simple, provably correct, then add complexity.

**Scope**:
- Rule definition schema (JSON-based, portable)
- Rule evaluation engine (runs on signal ingestion)
- Account-level rule matching
- Insight generation (structured output)
- Rule management API (CRUD operations)
- Template rules library for common patterns
- Rule testing/dry-run mode

**Rule Schema**:
```json
{
  "id": "rule_abc123",
  "name": "Stalled onboarding flow",
  "conditions": {
    "all": [
      { "signal_type": "flow.started", "flow_name": "onboarding" },
      { "not": { "signal_type": "flow.completed", "flow_name": "onboarding" } },
      { "time_window": "3 days" }
    ]
  },
  "actions": {
    "create_insight": {
      "type": "friction",
      "severity": "medium",
      "message": "Account {{account_id}} started onboarding but hasn't completed in 3 days",
      "suggested_action": "Reach out to check for blockers",
      "owner": "cs_team"
    }
  }
}
```

**Template Rules** (ship with product):
1. Stalled flow detection (flow started, not completed, >X days)
2. High friction account (3+ friction signals in 24h)
3. Value milestone achieved (first value signal emitted)
4. Re-engagement detected (value signal after 30d silence)
5. Critical error pattern (3+ error-outcome flows in 1 week)

**Acceptance Criteria**:
- [ ] Evaluates rules in <10ms per signal
- [ ] Supports nested conditions (AND, OR, NOT)
- [ ] Time-window queries work correctly (sliding windows)
- [ ] Prevents duplicate insights for same condition
- [ ] Rule syntax is validated on save
- [ ] Dry-run mode shows which accounts would match
- [ ] Ships with 5 battle-tested template rules
- [ ] Non-technical users can modify basic rules

**Out of scope**:
- AI-assisted rule creation
- ML-based anomaly detection
- Complex statistical functions
- Cross-account pattern matching

**Success Metrics**:
- Rule evaluation latency <10ms
- Rule match accuracy 99.9% (no false positives from bugs)
- 80% of customers use 3+ rules
- Template rules used by 100% of customers

**Dependencies**: Epic 2 (account/signal data model)

**Estimated complexity**: Large (5-6 weeks)

---

### Epic 4: Slack-Native Insight Delivery
**Goal**: Push insights to where teams live. Make Slack the primary interface, not an afterthought.

**Why this matters**: "Deliver, don't dashboard" is the core bet. If insights live in a dashboard, they get ignored. Slack is where decisions happen.

**Scope**:
- Slack app boilerplate (OAuth, workspace install)
- Per-account thread management (continuity)
- Rich insight formatting (blocks API, actionable buttons)
- Routing by owner (DMs, channels, or both)
- Feedback collection ("Was this useful?" inline)
- Digest mode (batch low-priority insights)
- Delivery retry with backoff
- Link back to dashboard for context

**Slack Message Format**:
```
🚨 Friction Alert: Acme Corp

Account: Acme Corp (#12345)
Issue: Onboarding flow started 3 days ago, not completed
Last activity: 2 hours ago by jane@acme.com

Suggested action: Reach out to check for blockers

[View Account] [Mark Resolved] [Not Useful]
```

**Delivery Routing**:
- Rules specify owner (CS, PM, Eng, custom)
- Org config maps owner → Slack destination
- Options: DM, channel, or both
- Account threads in channels for context
- Fallback to default channel if owner not found

**Acceptance Criteria**:
- [ ] OAuth flow completes in <60 seconds
- [ ] Insights delivered within 30s of generation
- [ ] Per-account threads maintained (not spammed)
- [ ] Actionable buttons work (mark resolved, view account)
- [ ] Feedback captured and stored
- [ ] Handles Slack API rate limits gracefully
- [ ] Digest mode batches insights every 4 hours
- [ ] Works with Slack Enterprise Grid

**Out of scope**:
- Slack slash commands
- Two-way conversation (bot replies)
- Insight modification from Slack
- MS Teams, Discord, etc.

**Success Metrics**:
- Delivery latency p95 <30s
- 60%+ feedback engagement rate
- 70%+ "useful" rating on insights
- Zero missed insights due to delivery failures

**Dependencies**: Epic 3 (insight generation)

**Estimated complexity**: Medium (3-4 weeks)

---

### Epic 5: Minimal Viable Dashboard
**Goal**: Simple web UI for account overview, signal inspection, and rule management. Dashboard is fallback, not hero.

**Why this matters**: Teams need to see account history, configure rules, and review insights when Slack isn't enough. But keep it minimal—don't build another analytics tool.

**Scope**:
- Authentication (login, workspace/org selection)
- Account list view (sortable, filterable)
- Account detail view (signal timeline, insights)
- Rule management UI (list, create, edit, test)
- Insight feed (all insights, filterable by type/owner)
- Basic account search
- Settings page (Slack connection, team config)

**Key Views**:

**1. Account List**
- Columns: Account name, Last active, Signal count (7d), Open insights, Health score
- Filters: By signal type, time range, has open insights
- Sort: By last active, signal count, health score

**2. Account Detail**
- Header: Account metadata, health score, key metrics
- Timeline: Signals over time (flow, value, friction markers)
- Insights: Active and resolved insights
- Quick actions: Create manual insight, export signals

**3. Rule Management**
- List: All rules, toggle active/inactive
- Create/Edit: Form builder for rule conditions
- Test: Dry-run against accounts to preview matches

**4. Insight Feed**
- All insights across accounts
- Filter by type, severity, owner, status
- Quick actions: Resolve, reassign, mark not useful

**Acceptance Criteria**:
- [ ] Loads account list in <500ms
- [ ] Account detail renders in <300ms
- [ ] Rule testing gives instant feedback (<1s)
- [ ] Mobile-friendly (responsive, not native app)
- [ ] Works without Slack connected (graceful degradation)
- [ ] Keyboard shortcuts for power users
- [ ] Dark mode support

**Out of scope**:
- Custom dashboards/charts
- Data exports
- Collaboration features (comments, tagging)
- Public/embedded views
- Advanced filtering/segmentation

**Success Metrics**:
- Dashboard sessions <10% of total engagement (Slack is primary)
- Rule creation completion rate >80%
- Account detail page viewed for 60%+ of delivered insights
- Page load times p95 <500ms

**Dependencies**: Epic 2 (data API), Epic 3 (rule API), Epic 4 (Slack connection)

**Estimated complexity**: Medium (4-5 weeks)

---

## P1: PHASE 2 EPICS (Next)

### Epic 6: PostHog Enrichment Layer (Optional)
**Goal**: Allow customers to connect PostHog for behavioral context without owning all tracking.

**Why this matters**: "Sit on data, don't own it." Customers already have PostHog/Amplitude. We enrich signals with their behavioral data, not replace their stack.

**Scope**:
- PostHog API integration (OAuth or API key)
- Account property mapping (their `company_id` → our `account_id`)
- Event sync to Tinybird (cached for rule evaluation)
- Rule conditions can query PostHog events
- Dashboard shows PostHog events alongside signals
- Incremental sync (only new events)
- Respects PostHog rate limits

**Use Cases**:
- Rule: "IF onboarding flow incomplete AND <3 login events in 7d → high risk"
- Rule: "IF value signal AND >50 feature events same day → power user"
- Dashboard: Show pageviews/clicks between flow start and complete

**Acceptance Criteria**:
- [ ] Connects to PostHog in <2 minutes
- [ ] Syncs last 30d of events on first connection
- [ ] Incremental sync runs every 5 minutes
- [ ] Rules can query PostHog events with <20ms overhead
- [ ] Handles PostHog API downtime gracefully (stale data OK)
- [ ] Respects customer's PostHog project isolation
- [ ] Only PostHog (not Amplitude, Mixpanel, etc.)

**Out of scope**:
- Two-way sync (we don't write to PostHog)
- Real-time streaming (5min delay is fine)
- Multiple analytics tool support
- PostHog session replay integration

**Success Metrics**:
- 40% of customers connect PostHog
- Rules using PostHog events have 20% higher "useful" rating
- Sync latency p95 <10 minutes
- Zero PostHog API rate limit violations

**Dependencies**: Epic 2 (data model), Epic 3 (rule engine)

**Estimated complexity**: Large (4-5 weeks)

---

### Epic 7: Time-Intelligent Rule Engine
**Goal**: Add temporal logic to rules—windows, delays, frequency, recency.

**Why this matters**: MVP rules are stateless. Customers need "X happened Y times in Z days" or "X happened but Y didn't within Z hours."

**Scope**:
- Sliding time windows (last 7d, 30d, 90d)
- Frequency conditions (>=3 times in window)
- Delay conditions (X happened but Y didn't within Z hours)
- Recency conditions (not seen in 30d, then reappeared)
- Cooldown periods (don't alert again for 7d)
- Rule scheduling (only run during business hours)

**Example Rules**:
```json
// High friction account
{
  "conditions": {
    "signal_type": "friction",
    "frequency": { "gte": 3, "window": "24 hours" }
  }
}

// Stalled with delay
{
  "conditions": {
    "all": [
      { "signal_type": "flow.started", "flow_name": "onboarding" },
      { "not": { "signal_type": "flow.completed" }, "within": "3 days" }
    ]
  }
}

// Re-engagement after silence
{
  "conditions": {
    "all": [
      { "signal_type": "value", "recency": { "gt": "30 days" } },
      { "signal_type": "value", "within": "1 day" }
    ]
  }
}
```

**Acceptance Criteria**:
- [ ] Supports sliding windows (1h to 90d)
- [ ] Frequency counts are accurate (tested against known data)
- [ ] Delay conditions work with signal ordering
- [ ] Cooldown prevents duplicate insights
- [ ] Scheduled rules respect timezone (per-customer)
- [ ] Rule complexity doesn't degrade performance (still <10ms)
- [ ] Template rules updated to use time logic

**Out of scope**:
- Cron-like scheduling (exact times)
- Predictive windows (ML-based)
- Cross-account time comparisons

**Success Metrics**:
- 80% of customers use time-based rules
- False positive rate drops 30% vs. MVP rules
- Rule evaluation still <10ms p99

**Dependencies**: Epic 3 (rule engine foundation)

**Estimated complexity**: Medium (3-4 weeks)

---

### Epic 8: Multi-Channel Delivery (HubSpot, Linear, Email)
**Goal**: Deliver insights to CRM, project management, and email—not just Slack.

**Why this matters**: Different insights need different homes. CS uses HubSpot. Eng uses Linear. Executives use email. Meet them where they are.

**Scope**:

**HubSpot Integration**:
- OAuth connection
- Create task on company record
- Add note to company timeline
- Update custom property (e.g., "Onboarding Risk")
- Map accounts to HubSpot companies

**Linear Integration**:
- OAuth connection
- Create issue with account context
- Assign to team/person based on owner
- Link issue to account (custom field)
- Auto-close when insight resolved

**Email Delivery**:
- Per-owner email addresses
- HTML template for insights
- Daily/weekly digest option
- Unsubscribe handling
- Link to dashboard for details

**Routing Logic**:
- Rules specify owner (CS → HubSpot, Eng → Linear, Exec → Email)
- Per-customer delivery preferences
- Fallback chain (Linear → Slack → Email)
- Opt-out per channel

**Acceptance Criteria**:
- [ ] HubSpot OAuth completes in <60s
- [ ] Tasks created in HubSpot <30s after insight
- [ ] Linear issues created with correct team assignment
- [ ] Email delivery p95 <2 minutes
- [ ] Handles API failures gracefully (retries, alerts)
- [ ] All channels support feedback collection
- [ ] Works with HubSpot/Linear enterprise plans

**Out of scope**:
- Two-way sync (closing Linear issue doesn't auto-resolve insight—yet)
- Salesforce, Intercom, Zendesk (later)
- SMS, push notifications
- Custom webhooks (later)

**Success Metrics**:
- 60% of customers use 2+ delivery channels
- HubSpot users rate insights 15% more useful
- Email open rate >40%, click rate >20%
- Zero delivery failures due to our bugs

**Dependencies**: Epic 4 (delivery infrastructure)

**Estimated complexity**: Large (5-6 weeks)

---

### Epic 9: Insight Feedback Loop & Learning
**Goal**: Close the loop—track if insights were useful, acted on, and led to outcomes.

**Why this matters**: We're blind without feedback. Which insights drive action? Which are noise? Use this to tune rules and eventually train AI.

**Scope**:
- Feedback collection UI (Slack, dashboard, email)
- Feedback schema: useful (yes/no), action taken (dropdown), outcome (text)
- Feedback API endpoint
- Analytics on feedback patterns
- Rule effectiveness scores (% useful, % acted on)
- Auto-disable low-performing rules (opt-in)
- Insight resolution tracking (marked resolved, time to resolve)

**Feedback Schema**:
```json
{
  "insight_id": "ins_123",
  "useful": true,
  "action_taken": "contacted_customer" | "created_task" | "no_action" | "other",
  "outcome": "Resolved blocker, customer re-engaged",
  "time_to_action": 3600, // seconds
  "responder_id": "user_456"
}
```

**Analytics**:
- Per-rule: useful rate, action rate, avg time to action
- Per-account: insight count, resolution rate
- Per-owner: engagement rate with insights
- Trends over time (are we getting better?)

**Acceptance Criteria**:
- [ ] Feedback collected for 70%+ of insights
- [ ] Rule effectiveness scores update in real-time
- [ ] Dashboard shows top/bottom performing rules
- [ ] Auto-disable kicks in after 20 "not useful" in 30d (configurable)
- [ ] Feedback influences rule priority/sensitivity
- [ ] Export feedback data for analysis

**Out of scope**:
- Outcome tracking (did customer actually churn?)
- A/B testing rules
- ML-based feedback analysis (later)

**Success Metrics**:
- Feedback collection rate >70%
- Useful rate >70% (if lower, rules need tuning)
- Avg time to action <4 hours for high-severity insights
- 50% of customers use feedback to tune rules

**Dependencies**: Epic 4 (delivery channels), Epic 3 (rule engine)

**Estimated complexity**: Medium (3-4 weeks)

---

### Epic 10: Account Health Score
**Goal**: Single number that summarizes account trajectory. Leading indicator of churn/expansion.

**Why this matters**: CS teams need triage. Health score bubbles up accounts that need attention. Must be simple, transparent, actionable.

**Scope**:
- Health score algorithm (0-100)
- Real-time score updates on signal ingestion
- Score history (trend over time)
- Configurable weights per signal type
- Score breakdown (what's driving score up/down)
- Alerts on score drops (>20 points in 7d)
- Dashboard visualization (score distribution, trend)

**Algorithm** (simple, transparent, tunable):
```
Base score: 50

Positive signals:
- Flow completed: +5
- Value signal: +10
- Consistent activity (signal every <7d): +10

Negative signals:
- Flow abandoned: -10
- Friction signal: -5
- Inactivity (no signal >14d): -20
- High friction frequency (3+ in 24h): -20

Time decay:
- Signals older than 30d contribute 50% weight
- Signals older than 60d contribute 25% weight

Floor: 0, Ceiling: 100
```

**Acceptance Criteria**:
- [ ] Score updates in real-time (<1s after signal)
- [ ] Score history retained for 1 year
- [ ] Dashboard shows score distribution across accounts
- [ ] Alerts fire on score drops (configurable threshold)
- [ ] Score breakdown explains what changed
- [ ] Customers can customize weights (advanced mode)
- [ ] Export score history for analysis

**Out of scope**:
- ML-based scoring (later)
- Predictive scoring (probability of churn)
- Benchmarking across customers (privacy concern)

**Success Metrics**:
- Health score correlates with churn (validate with customer data)
- CS teams use score for prioritization (survey)
- 80% of customers trust the score (qualitative)
- Score alerts have >70% useful rate

**Dependencies**: Epic 2 (account data model)

**Estimated complexity**: Medium (3-4 weeks)

---

## P2: FUTURE EPICS (Differentiation)

### Epic 11: AI-Powered Pattern Detection
**Goal**: Let AI find patterns humans miss. Suggest rules, detect anomalies, predict outcomes.

**Why this matters**: Rules are powerful but limited by what customers know to look for. AI unlocks "unknown unknowns."

**Scope**:
- Pattern detection across accounts (unsupervised clustering)
- Anomaly detection (account behavior deviating from norm)
- Suggested rule creation ("I noticed X correlates with Y")
- Natural language rule builder ("alert me when accounts go quiet")
- Predictive insights ("Account Z likely to churn in 30d")
- Confidence scores on AI-generated insights

**Use Cases**:
- "Accounts with 2+ friction signals in onboarding are 3x more likely to churn"
- "Account ABC's behavior is unusual—30% more friction than similar accounts"
- "Rule suggestion: Alert when account has value signal but no activity for 14d"

**Acceptance Criteria**:
- [ ] Patterns detected across 100+ accounts minimum (privacy-preserving)
- [ ] Suggested rules have >60% acceptance rate
- [ ] Anomaly detection false positive rate <10%
- [ ] Natural language → rule conversion works for 80% of prompts
- [ ] Predictive insights validated against outcomes (AUC >0.75)
- [ ] AI explanations are human-readable
- [ ] Opt-in (customers choose to enable AI)

**Out of scope**:
- Custom ML model training per customer (use general model)
- Real-time prediction (batch is fine)
- Cross-customer learning (privacy violation)

**Success Metrics**:
- 40% of customers enable AI features
- AI-suggested rules have same useful rate as human-created
- 30% reduction in time to create effective rules

**Dependencies**: Epic 9 (feedback loop for training data), Epic 2 (sufficient signal volume)

**Estimated complexity**: X-Large (8-10 weeks)

---

### Epic 12: Predictive Account Insights
**Goal**: Don't just react to signals—predict what happens next.

**Why this matters**: Ultimate value is preventing churn, identifying expansion opportunities before competitors.

**Scope**:
- Churn risk prediction (0-100% in next 30/60/90d)
- Expansion readiness score (likely to upgrade/expand)
- Time-to-value prediction (will they reach value milestone?)
- Intervention recommendations (what action reduces churn risk most?)
- Model explainability (what features drive prediction?)
- Continuous model retraining on feedback outcomes

**Predictions**:
```json
{
  "account_id": "acc_123",
  "predictions": {
    "churn_risk_30d": 0.65,
    "churn_risk_60d": 0.72,
    "expansion_readiness": 0.15,
    "time_to_value_days": 45
  },
  "drivers": [
    { "factor": "No activity in 14d", "impact": +0.20 },
    { "factor": "3 friction signals", "impact": +0.15 }
  ],
  "recommended_actions": [
    "Schedule check-in call",
    "Send tutorial for feature X"
  ]
}
```

**Acceptance Criteria**:
- [ ] Churn prediction AUC >0.80 (validated on holdout data)
- [ ] Predictions update daily
- [ ] Explainability shows top 5 drivers
- [ ] Recommended actions are specific and actionable
- [ ] Model performance tracked over time (drift detection)
- [ ] Handles cold-start problem (new accounts)

**Out of scope**:
- Real-time prediction (daily batch is fine)
- Per-customer custom models (use general model)
- What-if simulation ("what if we do X?")

**Success Metrics**:
- Churn prediction accuracy >80%
- 50% of high-risk accounts contacted within 48h (via CS)
- Customers report catching churn risks they'd have missed

**Dependencies**: Epic 11 (AI foundation), Epic 9 (outcome data for training)

**Estimated complexity**: X-Large (10-12 weeks)

---

## Cross-Cutting Epics

### Epic 13: Enterprise-Grade Security & Compliance
**Goal**: SOC 2, GDPR, data isolation, audit logs—table stakes for selling to enterprises.

**Scope**:
- SOC 2 Type II certification
- GDPR compliance (data portability, right to delete)
- Data encryption at rest and in transit
- Row-level security (customer data isolation)
- Audit logs (all API access, changes)
- SSO/SAML support
- IP allowlisting
- Data residency options (US, EU)

**Acceptance Criteria**:
- [ ] SOC 2 Type II certified
- [ ] GDPR compliant (legal review)
- [ ] Customer data 100% isolated (tested)
- [ ] Audit logs capture all sensitive operations
- [ ] SSO works with Okta, Google, Azure AD
- [ ] Security questionnaire <5% blockers

**Out of scope**:
- On-premise deployment
- HIPAA/PCI compliance (unless needed for ICP)
- Custom data retention per customer

**Success Metrics**:
- Pass enterprise security reviews 90%+ of time
- Zero data breaches
- Audit log queries <100ms

**Dependencies**: Epic 2 (data architecture must support isolation)

**Estimated complexity**: X-Large (12+ weeks, includes certification process)

---

### Epic 14: Developer Experience & Extensibility
**Goal**: Make it easy for developers to extend, customize, and integrate.

**Scope**:
- REST API for all platform operations
- Webhooks for insight delivery (custom integrations)
- SDK plugins (middleware, custom signal types)
- Terraform provider (infrastructure as code)
- OpenAPI spec (auto-generated client libraries)
- Developer docs site
- Sandbox environment (test rules without affecting prod)

**Acceptance Criteria**:
- [ ] Full CRUD API for accounts, signals, rules, insights
- [ ] Webhooks deliver <30s with retry logic
- [ ] SDK plugin system supports custom enrichment
- [ ] Terraform provider in HashiCorp registry
- [ ] Auto-generated clients for JS, Python, Go
- [ ] Docs have <5min quickstart for every feature
- [ ] Sandbox isolated from prod data

**Out of scope**:
- GraphQL API (REST is sufficient)
- gRPC (overkill for use case)
- CLI tool (use API clients)

**Success Metrics**:
- 30% of customers use API or webhooks
- Developer docs rated 4.5+ stars
- API uptime >99.9%

**Dependencies**: None (can be parallel with other work)

**Estimated complexity**: Large (6-8 weeks)

---

## Open Questions to Validate

1. **Account identification**: How do customers define "account" in their product? Does one account = one org? What about multi-tenant products?

2. **Signal volume economics**: What's the pricing model? Per signal, per account, flat rate? Does signal volume matter for cost?

3. **Rule complexity ceiling**: When do rules become too complex? Should we limit nesting depth, condition count?

4. **PostHog vs. DIY tracking**: Will customers actually use PostHog integration, or will they want us to track more ourselves?

5. **AI timing**: Is Phase 2 too early for AI? Do we need more data volume first?

6. **Dashboard vs. delivery**: Are we under-investing in dashboard? Over-investing in delivery channels?

7. **Health score algorithm**: Should score be ML-based from start, or simple heuristic is better?

8. **Customer success integration**: How do CS teams actually work today? Are we solving real workflow problems?

---

## Success Criteria for MVP Launch

**Product**:
- [ ] SDK installable via npm, <15min to first signal
- [ ] 3 customers using in production for 30+ days
- [ ] 100+ accounts being tracked per customer
- [ ] 10+ rules active per customer
- [ ] Insights delivered to Slack <30s from signal
- [ ] Dashboard loads in <500ms for 1000+ accounts

**Business**:
- [ ] 3 paying customers (LOI or contract)
- [ ] $50k+ ARR committed or closed
- [ ] 1 "caught a churn risk" customer story
- [ ] NPS >40 from beta users

**Technical**:
- [ ] 99.9% uptime
- [ ] <0.01% signal loss rate
- [ ] p95 latencies hit targets (SDK, ingestion, delivery)
- [ ] Supports 10 concurrent customers without scaling work

---

## What Good Looks Like: 6 Months Post-MVP

- **10 customers** in production, $300k ARR
- **80% retention** (customers don't churn, they expand)
- **5 delivery channels** (Slack, HubSpot, Linear, Email, + 1 surprise winner)
- **PostHog integration** used by 40% of customers
- **Health score** trusted by CS teams as primary triage tool
- **Insight useful rate >70%** (feedback loop working)
- **"We prevented a churn"** stories from 50% of customers
- **Expansion motion** (customers add more accounts, want more features)
- **Category creation** ("insight delivery" becomes a known category)

---

## Build Sequencing & Parallelization

**Week 1-8: Foundation (parallel)**
- Epic 1: SDK (weeks 1-6)
- Epic 2: Data platform (weeks 1-7)
- Epic 3: Rule engine (weeks 3-8, depends on Epic 2 starting)

**Week 9-13: MVP Completion (parallel)**
- Epic 4: Slack delivery (weeks 9-12, depends on Epic 3)
- Epic 5: Dashboard (weeks 9-13, depends on Epic 2, 3)

**Week 14-16: Beta & iteration**
- Onboard first 3 customers
- Fix issues, tune rules, improve DX
- Validate core assumptions

**Week 17+: Phase 2 (parallel)**
- Epic 6: PostHog (weeks 17-21)
- Epic 7: Time rules (weeks 17-20)
- Epic 8: Multi-channel (weeks 21-26)
- Epic 9: Feedback loop (weeks 21-24)
- Epic 10: Health score (weeks 24-27)

---

**Total MVP build time: 13-16 weeks (3-4 months) with 2-3 engineers.**

**Phase 2 build time: 10-12 weeks with 3-4 engineers.**

---

## Risk Mitigation

**Technical Risks**:
- SDK performance (bundle size, overhead) → Build performance tests first, measure continuously
- Tinybird scale limits → Load test early, have Postgres fallback plan
- Rule engine correctness → Extensive test suite, dry-run mode, gradual rollout

**Product Risks**:
- Customers don't trust insights → Feedback loop from day 1, transparency in rule logic
- Slack delivery ignored → Make messages actionable, track engagement, iterate fast
- Rules too complex for non-technical users → Start with templates, add wizard UI

**Market Risks**:
- "Just another dashboard" → Lead with delivery, dashboard is fallback
- Incumbents copy us → Speed to market, tight customer feedback loop, brand as category creator
- Wrong ICP (too small, won't pay) → Validate pricing early, focus on B2B SaaS with CS teams

---

This is ambitious. This is differentiated. This is buildable.

Let's ship the future of how companies understand their accounts.
