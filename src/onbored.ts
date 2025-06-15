import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
// import { Axiom } from "@axiomhq/js";
// import { AXIOM_PUBLIC_CONFIG } from "./config";

export const eventPayloadSchema = z.object({
  eventType: z.string(),
  flowName: z.string().optional(),
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
  flowName?: string;
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
const SESSION_STORAGE_KEY = "__smartreplay_session_id";
const ACTIVITY_STORAGE_KEY = "__smartreplay_last_activity";

// const axiom = new Axiom(AXIOM_PUBLIC_CONFIG);

class Onbored {
  private projectKey: string = "";
  private userId?: string;
  private traits?: Record<string, any>;
  private sessionId: string;
  private debug: boolean = false;
  private eventQueue: EventPayload[] = [];
  private flushInterval: number = 5000;
  private flushTimer?: number;
  private isDev: boolean = false;

  constructor() {
    this.sessionId = this.loadOrCreateSessionId();
    (window as any).__onboredFlush = () => this.flush(); // for local dev testing
    this.startRetryLoop(); // Start the retry loop
  }

  async init(projectKey: string, options: OnboredOptions = {}) {
    this.projectKey = projectKey;
    this.traits = options.traits;
    this.userId = options.userId;
    this.debug = options.debug || false;
    this.isDev = options.env === "development";

    if (typeof window !== "undefined" && !this.sessionId) {
      this.sessionId = this.loadOrCreateSessionId();
    }

    if (this.debug) console.log("[Onbored] Initialized", this);

    if (this.isDev) {
      console.log("Dev mode enabled – no network requests will be sent");
      return;
    }

    window.addEventListener("beforeunload", () => this.flush(true));
    this.startFlushTimer();

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
    } catch (err) {
      if (this.debug)
        console.error("[Onbored] Session registration failed:", err);
    }

    this.trackPageview();
  }

  async flow(name: string) {
    this.flowContexts.set(name, {
      startedAt: Date.now(),
      status: "started",
    });

    if (this.isDev) {
      console.log("Mock flow started:", name);
      return;
    }

    this.capture("Flow Started", { options: { flow: name } }, false);

    fetch("/api/ingest/flow", {
      method: "POST",
      body: JSON.stringify({
        sessionId: this.sessionId,
        projectKey: this.projectKey,
        flowName: name,
        startedAt: new Date().toISOString(),
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then(() => {
        if (this.debug) console.log("[Onbored] Flow registered");
      })
      .catch((err) => {
        if (this.debug)
          console.error("[Onbored] Flow registration failed:", err);
      });

    // ✅ Only this capture
    const payload = this.capture(
      "Flow Started",
      {
        options: { flow: name },
      },
      false // do not queue
    );

    console.log("🟡 - payload", payload);

    // ✅ And only this manual flush
    fetch("/api/ingest", {
      method: "POST",
      body: JSON.stringify([payload]),
      headers: { "Content-Type": "application/json" },
    })
      .then(() => {
        if (this.debug) console.log("[Onbored] Flow Started event flushed");
      })
      .catch((err) => {
        if (this.debug)
          console.error("[Onbored] Failed to flush Flow Started event:", err);
      });
  }

  step(stepName: string, options: { flow: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flow);

    if (!context) return;

    this.capture("Step Completed", {
      step: stepName,
      options,
    });

    if (this.debug) {
      console.log(
        `[Onbored] Step started: ${stepName} (flow: ${options.flow})`
      );
    }
  }

  skip(stepName: string, options: { flow: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flow);

    if (!context) return;

    this.capture("Step Abandoned", {
      step: stepName,
      options,
    });
  }

  completed(options: { flow: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flow);

    if (!context) return;

    this.capture("Flow Completed", {
      options: {
        ...options,
        flow: options.flow,
      },
    });

    if (this.debug) {
      console.log("[Onbored] Flow completed:", {
        flow: options.flow,
      });
    }

    this.flowContexts.set(options.flow, {
      ...context,
      status: "completed",
    });

    this.flush(); // flush immediately after completion
  }

  capture(
    eventType: string,
    data: {
      step?: string;
      options?: Record<string, any>;
      result?: string;
    },
    enqueue: boolean = true
  ): EventPayload | null {
    const payload: EventPayload = {
      eventType,
      flowName: data.options?.flow,
      step: data.step,
      options: {
        ...data.options,
        flow: data.options?.flow,
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
  private retryIntervalMs = 5000;

  private startRetryLoop() {
    // Start the retry loop that checks for retryable events
    setInterval(() => this.flushRetryQueue(), this.retryIntervalMs);
  }

  // private async reportToAxiom(type: string, payload: any) {
  //   try {
  //     await axiom.ingest("onbored-sdk", [
  //       {
  //         type,
  //         timestamp: new Date().toISOString(),
  //         payload,
  //         sessionId: this.sessionId,
  //         url: typeof window !== "undefined" ? window.location.href : "",
  //       },
  //     ]);
  //   } catch (err) {
  //     console.log("Axiom error", err);
  //   }
  // }

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

  context(contextTraits: Record<string, any>) {
    this.traits = { ...this.traits, ...contextTraits };
    if (this.debug) console.log("[Onbored] Context updated:", this.traits);
  }

  reset() {
    this.sessionId = uuidv4();
    this.traits = undefined;
    this.flowContexts.clear();
    if (this.debug) console.log("[Onbored] Reset session and traits");
  }

  private flowContexts = new Map<
    string,
    {
      startedAt: number;
      status?: "started" | "completed" | "abandoned";
    }
  >();

  private getFlowContext(
    flow: string
  ): { startedAt: number; status?: string } | null {
    const context = this.flowContexts.get(flow);
    if (!context) {
      console.warn(`[Onbored] No context for flow: "${flow}"`);
      return null;
    }
    return context;
  }

  private trackPageview() {
    this.capture("Page View", {
      options: {
        path: window.location.pathname,
        title: document.title,
      },
    });
  }

  private loadOrCreateSessionId(): string {
    if (typeof window === "undefined") return uuidv4();

    const now = Date.now();
    const lastActivity = parseInt(
      localStorage.getItem(ACTIVITY_STORAGE_KEY) || "0",
      10
    );
    const existingSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    const isExpired = !lastActivity || now - lastActivity > SESSION_TIMEOUT_MS;

    if (!existingSessionId || isExpired) {
      const newId = uuidv4();
      localStorage.setItem(SESSION_STORAGE_KEY, newId);
      localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
      return newId;
    }

    localStorage.setItem(ACTIVITY_STORAGE_KEY, now.toString());
    return existingSessionId;
  }

  private startFlushTimer() {
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
}

const onbored = new Onbored();
export default onbored;
