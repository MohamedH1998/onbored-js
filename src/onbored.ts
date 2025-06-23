import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
// import { Axiom } from "@axiomhq/js";
// import { AXIOM_PUBLIC_CONFIG } from "./config";

export const eventPayloadSchema = z.object({
  eventType: z.string(),
  flowId: z.string().optional(),
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
  private readonly MAX_QUEUE_SIZE = 1000;
  private flushInterval: number = 5000;
  private flushTimer?: number;
  private isDev: boolean = false;
  private isInitialized = false;
  private queuedFlows: string[] = [];
  private trackingPageviewsForFlows = new Set<string>();

  constructor() {
    this.sessionId = this.loadOrCreateSessionId();
    this.restoreFlowContextsFromStorage();
    if (typeof window !== "undefined") {
      (window as any).__onboredFlush = () => this.flush();
      this.startRetryLoop();
    }
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
      this.trackPageview();
    } catch (err) {
      if (this.debug)
        console.error("[Onbored] Session registration failed:", err);
    }
  }

  async flow(id: string) {
    console.log("🔵🟡 - flow", id);
    console.log("🔵🟡 - isInitialized", this.isInitialized);
    if (!this.isInitialized) {
      this.queuedFlows.push(id);
      if (this.debug) console.log("[Onbored] Queued flow:", id);
      return;
    }

    if (this.flowContexts.has(id)) {
      if (this.debug) console.warn(`[Onbored] Flow ${id} already exists`);
      return;
    }

    if (this.isDev) {
      console.log("Mock flow started:", id);
      return;
    }

    fetch("/api/ingest/flow", {
      method: "POST",
      body: JSON.stringify({
        sessionId: this.sessionId,
        projectKey: this.projectKey,
        flowId: id,
        startedAt: new Date().toISOString(),
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data: { status: string; flowId: string }) => {
        if (this.debug) console.log("[Onbored] Flow registered", data);
        this.capture("Flow Started", { options: { flowId: data.flowId } });
        this.flowContexts.set(id, {
          id: data.flowId,
          startedAt: Date.now(),
          status: "started",
        });
        this.trackingPageviewsForFlows.add(data.flowId);
      })
      .catch((err) => {
        if (this.debug)
          console.error("[Onbored] Flow registration failed:", err);
      });
    this.saveFlowContextsToStorage();
    // ✅ Only this capture
    // const payload = this.capture(
    //   "Flow Started",
    //   {
    //     options: { flow: id },
    //   },
    //   false // do not queue
    // );

    // // ✅ And only this manual flush
    // fetch("/api/ingest", {
    //   method: "POST",
    //   body: JSON.stringify([payload]),
    //   headers: { "Content-Type": "application/json" },
    // })
    //   .then(() => {
    //     if (this.debug) console.log("[Onbored] Flow Started event flushed");
    //   })
    //   .catch((err) => {
    //     if (this.debug)
    //       console.error("[Onbored] Failed to flush Flow Started event:", err);
    //   });
  }

  step(stepName: string, options: { flowId: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flowId);

    if (!context) return;

    this.capture("Step Completed", {
      step: stepName,
      options,
    });

    if (this.debug) {
      console.log(
        `[Onbored] Step started: ${stepName} (flow: ${options.flowId})`
      );
    }
  }

  skip(stepName: string, options: { flowId: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flowId);

    if (!context) return;

    this.capture("Step Abandoned", {
      step: stepName,
      options,
    });
  }

  completed(options: { flowId: string } & Record<string, any>) {
    const context = this.getFlowContext(options.flowId);

    if (!context) return;

    this.capture("Flow Completed", {
      options: {
        ...options,
        flowId: options.flowId,
      },
    });

    if (this.debug) {
      console.log("[Onbored] Flow completed:", {
        flowId: options.flowId,
      });
    }

    this.flowContexts.set(options.flowId, {
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
      options?: { flowId?: string } & Record<string, any>;
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

  private saveFlowContextsToStorage() {
    if (typeof window === "undefined") return;
    const raw = JSON.stringify({
      sessionId: this.sessionId,
      flows: Array.from(this.flowContexts.entries()),
    });
    sessionStorage.setItem("__onbored_flow_contexts", raw);
  }

  private restoreFlowContextsFromStorage() {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("__onbored_flow_contexts");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.sessionId !== this.sessionId) return; // session changed

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
      id: string; // ✅ new
      startedAt: number;
      status?: "started" | "completed" | "abandoned";
    }
  >();

  private getFlowContext(
    flowId: string
  ): { id: string; startedAt: number; status?: string } | null {
    const context = this.flowContexts.get(flowId);
    if (!context) {
      console.warn(`[Onbored] No context for flow: "${flowId}"`);
      return null;
    }
    return context;
  }

  private trackPageview() {
    if (typeof window === "undefined") {
      console.warn("[Onbored - trackPageview] No window object found");
      return;
    }

    const flowIds = Array.from(this.trackingPageviewsForFlows);

    this.capture("Page View", {
      options: {
        path: window.location.pathname,
        title: document.title,
        // @TODO: Add support for multiple flows
        ...(flowIds.length > 0 && { flowId: flowIds[0] }),
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
}

const onbored = new Onbored();
export default onbored;
