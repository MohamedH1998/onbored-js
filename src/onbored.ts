import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

export const eventPayloadSchema = z.object({
  eventType: z.string(),
  flowId: z.string().optional(),
  funnelSlug: z.string().optional(),
  step: z.string().optional(),
  options: z.record(z.any()).default({}),
  result: z.string().optional(),
  traits: z.record(z.any()).optional(),
  sessionId: z.string().uuid(),
  timestamp: z.string(), // ISO date
  projectKey: z.string(),
  url: z.string().url(),
  referrer: z.string().url().optional(),
});

interface OnboredOptions {
  userId?: string;
  traits?: Record<string, any>;
  debug?: boolean;
  env?: "development" | "production";
}

type RetryEvent = {
  payload: EventPayload[];
  attempt: number;
  nextAttemptAt: number;
};

export interface EventPayload {
  eventType: string;
  flowId?: string;
  funnelSlug?: string;
  step?: string;
  options: OnboredOptions & Record<string, any>;
  result?: string;
  traits?: Record<string, any>;
  sessionId: string;
  timestamp: string;
  projectKey: string;
  url: string;
  referrer?: string;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_STORAGE_KEY = "__onbored_session_id";
const ACTIVITY_STORAGE_KEY = "__onbored_last_activity";

interface OnboredConfig {
  projectKey: string;
  userId?: string;
  traits?: Record<string, any>;
  debug?: boolean;
  env?: "development" | "production";
  flushInterval?: number;
  maxQueueSize?: number;
  maxRetries?: number;
  retryIntervalMs?: number;
  sessionTimeoutMs?: number;
}

class Onbored {
  private projectKey: string;
  private userId?: string;
  private traits?: Record<string, any>;
  private sessionId: string;
  private debug: boolean = false;
  private eventQueue: EventPayload[] = [];
  private readonly MAX_QUEUE_SIZE: number;
  private flushInterval: number;
  private flushTimer?: number;
  private isDev: boolean = false;
  private isInitialized = false;
  private queuedFlows: string[] = [];
  private trackingPageviewsForFlows = new Set<string>();
  private maxRetries: number;
  private retryIntervalMs: number;
  private sessionTimeoutMs: number;
  private activeFlowSlug?: string;
  private queuedViewEvents: Array<{ stepName: string; funnelSlug: string }> = [];

  constructor(config: OnboredConfig) {
    this.projectKey = config.projectKey;
    this.userId = config.userId;
    this.traits = config.traits;
    this.debug = config.debug || false;
    this.isDev = config.env === "development";
    this.MAX_QUEUE_SIZE = config.maxQueueSize || 1000;
    this.flushInterval = config.flushInterval || 5000;
    this.maxRetries = config.maxRetries || 5;
    this.retryIntervalMs = config.retryIntervalMs || 5000;
    this.sessionTimeoutMs = config.sessionTimeoutMs || 30 * 60 * 1000;

    this.sessionId = this.loadOrCreateSessionId();
    this.restoreFlowContextsFromStorage();

    if (typeof window !== "undefined") {
      // Make flush available globally with unique identifier
      const flushKey = `__onboredFlush_${this.projectKey}`;
      (window as any)[flushKey] = () => this.flush();
      this.startRetryLoop();
    }
  }

  async flow(funnelSlug: string) {
    // Auto-initialize if not already done
    if (!this.isInitialized && !this.isDev) {
      await this.initialize();
    }

    if (!this.isInitialized) {
      this.queuedFlows.push(funnelSlug);
      if (this.debug) console.log("[Onbored] Queued flow:", funnelSlug);
      return;
    }

    if (this.flowContexts.has(funnelSlug)) {
      if (this.debug)
        console.warn(`[Onbored] Flow ${funnelSlug} already exists`);
      return;
    }

    if (this.isDev) {
      console.log("Mock flow started:", funnelSlug);
      return;
    }

    fetch("/api/ingest/flow", {
      method: "POST",
      body: JSON.stringify({
        sessionId: this.sessionId,
        projectKey: this.projectKey,
        funnelSlug,
        startedAt: new Date().toISOString(),
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data: { status: string; flowId: string }) => {
        if (this.debug) console.log("[Onbored] Flow registered", data);
        this.capture("Flow Started", { options: { flowId: data.flowId } });
        this.flowContexts.set(funnelSlug, {
          id: data.flowId,
          startedAt: Date.now(),
          status: "started",
        });
        this.activeFlowSlug = funnelSlug;
        this.trackingPageviewsForFlows.add(data.flowId);
      })
      .catch((err) => {
        if (this.debug)
          console.error("[Onbored] Flow registration failed:", err);
      });
    this.saveFlowContextsToStorage();
  }

  step(
    stepName: string,
    options: { funnelSlug: string } & Record<string, any>
  ) {
    const context = this.getFlowContext(options.funnelSlug);

    if (!context) return;

    this.capture("Step Completed", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        funnelSlug: options.funnelSlug,
      },
    });

    if (this.debug) {
      console.log(
        `[Onbored] Step started: ${stepName} (flow: ${options.funnelSlug})`
      );
    }
  }

  skip(
    stepName: string,
    options: { funnelSlug: string } & Record<string, any>
  ) {
    const context = this.getFlowContext(options.funnelSlug);

    if (!context) return;

    this.capture("Step Abandoned", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        funnelSlug: options.funnelSlug,
      },
    });
  }

  completed(options: { funnelSlug: string } & Record<string, any>) {
    const context = this.getFlowContext(options.funnelSlug);

    if (!context) return;

    this.capture("Flow Completed", {
      options: {
        ...options,
        flowId: context.id,
        funnelSlug: options.funnelSlug,
      },
    });

    if (this.debug) {
      console.log("[Onbored] Flow completed:", {
        funnelSlug: options.funnelSlug,
        flowId: context.id,
      });
    }

    this.flowContexts.set(options.funnelSlug, {
      id: context.id,
      startedAt: context.startedAt,
      status: "completed",
    });

    this.trackingPageviewsForFlows.delete(context.id);

    this.flush(); // flush immediately after completion
  }

  capture(
    eventType: string,
    data: {
      step?: string;
      options?: { flowId?: string; funnelSlug?: string } & Record<string, any>;
      result?: string;
    },
    enqueue: boolean = true
  ): EventPayload | null {
    const payload: EventPayload = {
      eventType,
      flowId: data.options?.flowId,
      step: data.step,
      options: {
        ...data.options,
        flowId: data.options?.flowId,
        funnelSlug: data.options?.funnelSlug,
      },
      result: data.result,
      traits: this.traits,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      projectKey: this.projectKey,
      url: typeof window !== "undefined" ? window.location.href : "",
      referrer:
        typeof document !== "undefined"
          ? document.referrer || undefined
          : undefined,
    };

    if (this.isDev) {
      console.log("Mock capture:", payload);
      return payload;
    }

    try {
      eventPayloadSchema.parse(payload);

      if (enqueue) {
        // Check queue size limit
        if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
          console.warn(
            `[Onbored] Queue full (${this.MAX_QUEUE_SIZE}), dropping oldest event`
          );
          this.eventQueue.shift(); // Remove oldest event
        }

        this.eventQueue.push(payload);
        if (this.debug) console.log("☢️ - [Onbored] Captured:", payload);
      }

      return payload;
    } catch (error) {
      console.error("[Onbored] Invalid event payload:", error, payload);
      return null;
    }
  }

  private retryQueue: RetryEvent[] = [];

  private startRetryLoop() {
    // Start the retry loop that checks for retryable events
    setInterval(() => this.flushRetryQueue(), this.retryIntervalMs);
  }
  private flushingRetry = false;

  private async flushRetryQueue() {
    if (this.flushingRetry) return;
    this.flushingRetry = true;

    try {
      const now = Date.now();
      const ready = this.retryQueue.filter((e) => e.nextAttemptAt <= now);
      this.retryQueue = this.retryQueue.filter((e) => e.nextAttemptAt > now);

      for (const event of ready) {
        try {
          await this.sendEvents(event.payload);
        } catch {
          const nextAttempt = event.attempt + 1;
          if (nextAttempt < 5) {
            this.retryQueue.push({
              payload: event.payload,
              attempt: nextAttempt,
              nextAttemptAt: Date.now() + Math.pow(2, nextAttempt) * 1000,
            });
          } else {
            console.log("Max retries reached. Dropping event", event.payload);
            // this.reportToAxiom("max_retry_exceeded", event.payload);
          }
        }
      }
    } finally {
      this.flushingRetry = false;
    }
  }

  private async sendEvents(payload: EventPayload[]) {
    if (this.isDev) {
      console.log("Mock sendEvents:", payload);
      return;
    }

    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      // Add to retry queue with exponential backoff
      const nextAttempt = 1; // First retry attempt
      this.retryQueue.push({
        payload,
        attempt: nextAttempt,
        nextAttemptAt: Date.now() + Math.pow(2, nextAttempt) * 1000, // 2^1 * 1000ms = 2 seconds
      });
      throw error; // Re-throw to be caught by the caller
    }
  }

  private saveFlowContextsToStorage() {
    if (typeof window === "undefined") return;
    const raw = JSON.stringify({
      sessionId: this.sessionId,
      flows: Array.from(this.flowContexts.entries()),
    });
    sessionStorage.setItem(this.getFlowContextsStorageKey(), raw);
  }

  private restoreFlowContextsFromStorage() {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(this.getFlowContextsStorageKey());
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.sessionId !== this.sessionId) return;

      this.flowContexts = new Map(parsed.flows);
      if (this.debug)
        console.log("[Onbored] Restored flowContexts:", this.flowContexts);
    } catch (err) {
      console.warn("[Onbored] Failed to restore flow context:", err);
    }
  }

  context(contextTraits: Record<string, any>) {
    this.traits = { ...this.traits, ...contextTraits };
    if (this.debug) console.log("[Onbored] Context updated:", this.traits);
  }

  reset() {
    this.sessionId = uuidv4();
    this.traits = undefined;
    this.flowContexts.clear();
    this.trackingPageviewsForFlows.clear();
    if (this.debug) console.log("[Onbored] Reset session and traits");
  }

  private flowContexts = new Map<
    string,
    {
      id: string;
      startedAt: number;
      status?: "started" | "completed" | "abandoned";
      lastVisitedPath?: string;
    }
  >();

  private getFlowContext(
    funnelSlug: string
  ): { id: string; startedAt: number; status?: string } | null {
    const context = this.flowContexts.get(funnelSlug);
    if (!context) {
      console.warn(`[Onbored] No context for flow: "${funnelSlug}"`);
      return null;
    }
    return context;
  }

  private trackPageview = () => {
    if (typeof window === "undefined") return;

    const flowIds = Array.from(this.trackingPageviewsForFlows);
    const pageViewOptions: Record<string, any> = {
      path: window.location.pathname,
      title: document.title,
    };

    if (flowIds.length > 0) {
      // @TODO: Add support for multiple flows
      pageViewOptions.flowId = flowIds[0];
    }

    this.capture("Page View", { options: pageViewOptions });
  };

  private enableAutoPageviewTracking(): void {
    if (typeof window === "undefined") return;

    // 1. Capture back/forward
    window.addEventListener("popstate", this.trackPageview);

    // 2. Patch pushState/replaceState
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    const patched =
      (method: any, orig: any) =>
      (...args: any[]) => {
        const result = orig.apply(this, args);

        setTimeout(() => {
          const path = window.location.pathname;

          const ctx = this.activeFlowSlug
            ? this.flowContexts.get(this.activeFlowSlug)
            : null;
          if (ctx) {
            const last = ctx.lastVisitedPath;
            if (last && path !== last) {
              this.capture("Page View", {
                options: {
                  from: last,
                  to: path,
                  flowId: ctx.id,
                  funnelSlug: this.activeFlowSlug,
                  path: window.location.pathname,
                  title: document.title,
                },
              });
            }
            ctx.lastVisitedPath = path;
          }

          this.saveFlowContextsToStorage();
        }, 0);

        return result;
      };

    history.pushState = patched("pushState", origPush);
    history.replaceState = patched("replaceState", origReplace);

    if (this.debug) console.log("[Onbored] SPA route change tracking enabled");
  }

  private viewStep(
    stepName: string,
    options: { funnelSlug: string } & Record<string, any>
  ) {
    console.log("🔵🔵🔵🔵🔵 - viewStep", stepName, options);
    
    // Check if flow is initialized
    if (!this.isInitialized && !this.isDev) {
      this.queuedViewEvents.push({ stepName, funnelSlug: options.funnelSlug });
      if (this.debug) console.log("[Onbored] Queued view event:", { stepName, funnelSlug: options.funnelSlug });
      return;
    }
    
    const context = this.getFlowContext(options.funnelSlug);
    if (!context) return;
    
    this.capture("Step Viewed", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        funnelSlug: options.funnelSlug,
      },
    });

    if (this.debug) {
      console.log(
        `[Onbored] Step viewed: ${stepName} (flow: ${options.funnelSlug})`
      );
    }
  }

  private enableStepViewTracking(): void {
    if (typeof window === "undefined") return;

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target as HTMLElement;
          const stepName = el.getAttribute("data-onbored-step");
          const funnelSlug = el.getAttribute("data-onbored-funnel");

          if (stepName && funnelSlug) {
            this.viewStep(stepName, { funnelSlug });
          }
        });
      },
      { threshold: 0.5 }
    );

    const observed = new WeakSet<Element>();

    const observeMatchingElements = () => {
      const elements = document.querySelectorAll<HTMLElement>(
        "[data-onbored-step][data-onbored-funnel]"
      );

      elements.forEach((el) => {
        if (!observed.has(el)) {
          intersectionObserver.observe(el);
          observed.add(el);
        }
      });
    };

    // Initial pass
    observeMatchingElements();

    // Re-observe on DOM changes (SPA nav, re-renders, etc.)
    const mutationObserver = new MutationObserver(() => {
      observeMatchingElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (this.debug) {
      console.log("[Onbored] Step view tracking enabled (with SPA support)");
    }
  }

  private getSessionStorageKey(): string {
    return `__onbored_session_id_${this.projectKey}`;
  }

  private getActivityStorageKey(): string {
    return `__onbored_last_activity_${this.projectKey}`;
  }

  private getFlowContextsStorageKey(): string {
    return `__onbored_flow_contexts_${this.projectKey}`;
  }

  private loadOrCreateSessionId(): string {
    if (typeof window === "undefined") return uuidv4();

    const now = Date.now();
    const lastActivity = parseInt(
      localStorage.getItem(this.getActivityStorageKey()) || "0",
      10
    );
    const existingSessionId = localStorage.getItem(this.getSessionStorageKey());
    const isExpired =
      !lastActivity || now - lastActivity > this.sessionTimeoutMs;

    if (!existingSessionId || isExpired) {
      const newId = uuidv4();
      localStorage.setItem(this.getSessionStorageKey(), newId);
      localStorage.setItem(this.getActivityStorageKey(), now.toString());
      return newId;
    }

    localStorage.setItem(this.getActivityStorageKey(), now.toString());
    return existingSessionId;
  }

  private startFlushTimer() {
    if (typeof window === "undefined") {
      console.warn("[Onbored - startFlushTimer] No window object found");
      return;
    }

    this.flushTimer = window.setInterval(
      () => this.flush(),
      this.flushInterval
    );
  }

  private flush(isUnload = false) {
    if (!this.eventQueue.length) return;
    if (!navigator.onLine) return; // skip if offline

    const payload = [...this.eventQueue];
    this.eventQueue = [];

    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    const endpoint = "/api/ingest";

    if (navigator.sendBeacon && isUnload) {
      navigator.sendBeacon(endpoint, blob);
    } else {
      this.sendEvents(payload).catch((err) => {
        this.eventQueue.unshift(...payload); // retry next flush
        if (this.debug) console.error("[Onbored] Flush failed:", err);
      });
    }

    if (this.debug) {
      console.groupCollapsed("[Onbored] Flushing Events");
      console.table(
        payload.map((p) => ({
          event: p.eventType,
          step: p.step,
          timestamp: p.timestamp,
        }))
      );
      console.groupEnd();
    }
  }

  destroy() {
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Clear retry queue
    this.retryQueue = [];

    // Remove global flush function
    if (typeof window !== "undefined") {
      const flushKey = `__onboredFlush_${this.projectKey}`;
      delete (window as any)[flushKey];
    }

    // Remove event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", () => this.flush(true));
    }

    // Clear queues
    this.eventQueue = [];
    this.queuedFlows = [];
    this.queuedViewEvents = []; // Clear queued view events
    this.trackingPageviewsForFlows.clear();
    this.flowContexts.clear();

    if (this.debug) console.log("[Onbored] Instance destroyed");
  }

  private async initialize() {
    if (this.isInitialized) return;

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => this.flush(true));
      this.startFlushTimer();
    }

    try {
      await fetch("/api/ingest/session", {
        method: "POST",
        body: JSON.stringify({
          sessionId: this.sessionId,
          projectKey: this.projectKey,
          traits: this.traits,
          userId: this.userId,
          startedAt: new Date().toISOString(),
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (this.debug) console.log("[Onbored] Session registered");

      this.isInitialized = true;
      this.queuedFlows.forEach((flow) => this.flow(flow));
      this.queuedFlows = [];
      
      // Process queued view events
      this.queuedViewEvents.forEach(({ stepName, funnelSlug }) => {
        this.viewStep(stepName, { funnelSlug });
      });
      this.queuedViewEvents = [];
      
      this.trackPageview();
      this.enableAutoPageviewTracking();
      this.enableStepViewTracking();
    } catch (err) {
      if (this.debug)
        console.error("[Onbored] Session registration failed:", err);
    }
  }
}

export { Onbored };
export type { OnboredConfig, OnboredOptions };

// Optionally provide a default instance for backward compatibility
const defaultOnbored = new Onbored({
  projectKey: "",
  debug: false,
  env: "production",
});

export default defaultOnbored;
