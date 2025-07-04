import { v4 as uuidv4 } from "uuid";
import { DEFAULT_GLOBAL_OPTIONS } from "./constants";
import { applySettingDefaults } from "./helpers";
import { Logger } from "./logger";
import {
  Environment,
  Fetch,
  FlowContext,
  OnboredClientOptions,
  Traits,
  EventPayload,
  RetryEvent,
} from "./types";
import { eventPayloadSchema } from "./schema";

/**
 * OnBored Client.
 *
 * An isomorphic Javascript client for interacting with OnBored.
 */
export class OnboredClient {
  protected logger: Logger;
  protected env: Environment;
  protected debug: boolean;
  protected userId: string;
  protected traits: Traits;
  protected sessionId: string;
  protected sessionTimeoutMs: number;
  protected sessionStorageKey: string;
  protected activityStorageKey: string;
  protected flowContextStorageKey: string;
  protected flowContext: Map<string, FlowContext>;
  protected headers: Record<string, string>;
  protected fetch: Fetch;

  protected isInitialized = false;
  protected retryIntervalMs = 5000;
  protected queuedFlows: string[] = [];
  
  // Event queue and retry logic
  protected readonly MAX_QUEUE_SIZE = 1000;
  protected eventQueue: EventPayload[] = [];
  protected retryQueue: RetryEvent[] = [];
  protected flushInterval: number = 5000;
  protected flushTimer?: number;
  protected flushingRetry = false;

  /**
   * Create a new client for use in the browser.
   * @param projectKey The unique Onbored Key which is supplied when you create a new project in your project dashboard.
   * @param options.user_id This user id will be used to identify the user in the Onbored dashboard.
   * @param options.user_metadata The user metadata.
   * @param options.traits The traits object.
   * @param options.debug Whether to enable debug mode.
   * @param options.env Set to "development" if you want to run the client in development mode.
   * @param options.global.fetch A custom fetch implementation.
   * @param options.global.headers Any additional headers to send with each network request.
   */
  constructor(protected projectKey: string, options?: OnboredClientOptions) {
    if (!projectKey) throw new Error("[Onbored]: projectKey is required.");

    this.projectKey = projectKey;
    this.sessionId = this._getSessionId();
    this.sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
    this.flowContext = new Map<string, FlowContext>();

    // default storage keys use the onboard project key as a namespace
    const DEFAULT_STORAGE_OPTIONS = {
      sessionStorageKey: `ob-session-${this.projectKey}`,
      activityStorageKey: `ob-activity-${this.projectKey}`,
      flowContextStorageKey: `ob-flow-context-${this.projectKey}`,
    };

    const DEFAULTS = {
      global: DEFAULT_GLOBAL_OPTIONS,
      storage: DEFAULT_STORAGE_OPTIONS,
    };

    // TODO: Double check this, can storage options be overridden?
    const settings = applySettingDefaults(options, DEFAULTS);

    this.userId = settings.user_id ?? "";
    this.traits = settings.traits ?? {};
    this.env = settings.env ?? "production";
    this.debug = settings.debug ?? false;
    this.sessionStorageKey = settings.storage.sessionStorageKey ?? "";
    this.activityStorageKey = settings.storage.activityStorageKey ?? "";
    this.flowContextStorageKey = settings.storage.flowContextStorageKey ?? "";
    this.headers = settings.global.headers ?? {};
    this.fetch = settings.global.fetch ?? fetch;

    this.logger = new Logger("[Onbored]", this.debug ? "debug" : "info");

    this._restoreFlowContextFromStorage();
    this._startRetryLoop();
    this._init();

    // Global flush function for debugging
    (window as any).__onboredFlush = () => this._flush();
  }

  private async _init() {
    this.logger.debug("Initialized", this);

    if (this.env === "development") {
      this.logger.info("Dev mode enabled – no network requests will be sent");
      return;
    }

    window.addEventListener("beforeunload", () => this._flush(true));
    this._startFlushTimer();

    try {
      await this.fetch("/api/ingest/session", {
        method: "POST",
        body: JSON.stringify({
          sessionId: this.sessionId,
          projectKey: this.projectKey,
          traits: this.traits,
          userId: this.userId,
          startedAt: new Date().toISOString(),
        }),
        headers: this.headers,
      });

      this.logger.debug("Session registered");

      this.isInitialized = true;
      this.queuedFlows.forEach((flow) => this.flow(flow));
      this.queuedFlows = [];
    } catch (err) {
      this.logger.error("Session registration failed:", err);
    }
  }

  private _createSession() {
    const newId = uuidv4();
    localStorage.setItem(this.sessionStorageKey, newId);
    return newId;
  }

  private _createActivity(date: number) {
    localStorage.setItem(this.activityStorageKey, date.toString());
  }

  private _getSessionId(): string {
    const now = Date.now();
    const lastActivity = parseInt(
      localStorage.getItem(this.activityStorageKey) || "0"
    );

    if (!lastActivity) {
      const sessionId = this._createSession();
      this._createActivity(now);
      return sessionId;
    }

    const existingSessionId = localStorage.getItem(this.sessionStorageKey);

    if (!existingSessionId) {
      const sessionId = this._createSession();
      this._createActivity(now);
      return sessionId;
    }

    const isSessionExpired = now - lastActivity > this.sessionTimeoutMs;

    if (isSessionExpired) {
      const sessionId = this._createSession();
      this._createActivity(now);
      return sessionId;
    }

    this._createActivity(now);
    return existingSessionId;
  }

  private _restoreFlowContextFromStorage() {
    const raw = sessionStorage.getItem(this.flowContextStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.sessionId !== this.sessionId) return; // session changed

      this.flowContext = new Map(parsed.flows);

      if (this.debug)
        this.logger.debug("Restored flowContexts:", this.flowContext);
    } catch (err) {
      this.logger.warn("Failed to restore flow context:", err);
    }
  }

  private _saveFlowContextToStorage() {
    const raw = JSON.stringify({
      sessionId: this.sessionId,
      flows: Array.from(this.flowContext.entries()),
    });
    sessionStorage.setItem(this.flowContextStorageKey, raw);
  }

  private _startRetryLoop() {
    setInterval(() => this._flushRetryQueue(), this.retryIntervalMs);
  }

  private async _flushRetryQueue() {
    if (this.flushingRetry) return;
    this.flushingRetry = true;

    try {
      const now = Date.now();
      const ready = this.retryQueue.filter((e) => e.nextAttemptAt <= now);
      this.retryQueue = this.retryQueue.filter((e) => e.nextAttemptAt > now);

      for (const event of ready) {
        try {
          await this._sendEvents(event.payload);
        } catch {
          const nextAttempt = event.attempt + 1;
          if (nextAttempt < 5) {
            this.retryQueue.push({
              payload: event.payload,
              attempt: nextAttempt,
              nextAttemptAt: Date.now() + Math.pow(2, nextAttempt) * 1000,
            });
          } else {
            this.logger.warn("Max retries reached. Dropping event", event.payload);
          }
        }
      }
    } finally {
      this.flushingRetry = false;
    }
  }

  private async _sendEvents(payload: EventPayload[]) {
    if (this.env === "development") {
      this.logger.debug("Mock sendEvents:", payload);
      return;
    }

    try {
      const response = await this.fetch("/api/ingest", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: this.headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      // Add to retry queue with exponential backoff
      const nextAttempt = 1;
      this.retryQueue.push({
        payload,
        attempt: nextAttempt,
        nextAttemptAt: Date.now() + Math.pow(2, nextAttempt) * 1000,
      });
      throw error;
    }
  }

  private _startFlushTimer() {
    this.flushTimer = window.setInterval(
      () => this._flush(),
      this.flushInterval
    );
  }

  private _flush(isUnload = false) {
    if (!this.eventQueue.length) return;
    if (!navigator.onLine) return; // skip if offline

    const payload = [...this.eventQueue];
    this.eventQueue = [];

    const endpoint = "/api/ingest";

    if (navigator.sendBeacon && isUnload) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      this._sendEvents(payload).catch((err) => {
        this.eventQueue.unshift(...payload); // retry next flush
        this.logger.error("Flush failed:", err);
      });
    }

    if (this.debug) {
      this.logger.debug("Flushing Events", payload.map((p) => ({
        event: p.eventType,
        step: p.step,
        timestamp: p.timestamp,
      })));
    }
  }

  private _getFlowContext(flowId: string): FlowContext | null {
    const context = this.flowContext.get(flowId);
    if (!context) {
      this.logger.warn(`No context for flow: "${flowId}"`);
      return null;
    }
    return context;
  }

  // Public API methods
  async flow(id: string) {
    this.logger.info("🔵🟡 - flow", id);
    this.logger.info("🔵🟡 - isInitialized", this.isInitialized);

    if (!this.isInitialized) {
      this.queuedFlows.push(id);
      this.logger.debug("Queued flow:", id);
      return;
    }

    if (this.flowContext.has(id)) {
      this.logger.debug(`Flow ${id} already exists`);
      return;
    }

    if (this.env === "development") {
      this.logger.info("Mock flow started:", id);
      return;
    }

    try {
      const response = await this.fetch("/api/ingest/flow", {
        method: "POST",
        body: JSON.stringify({
          sessionId: this.sessionId,
          projectKey: this.projectKey,
          flowId: id,
          startedAt: new Date().toISOString(),
        }),
        headers: this.headers,
      });

      const data: { status: string; flowId: string } = await response.json();
      
      this.logger.debug("Flow registered", data);
      this.capture("Flow Started", { options: { flowId: data.flowId } });
      
      this.flowContext.set(id, {
        id: data.flowId,
        startedAt: Date.now(),
        status: "started",
      });
      
      this._saveFlowContextToStorage();
    } catch (err) {
      this.logger.error("Flow registration failed:", err);
    }
  }

  step(stepName: string, options: { flowId: string } & Record<string, any>) {
    const context = this._getFlowContext(options.flowId);
    if (!context) return;

    this.capture("Step Completed", {
      step: stepName,
      options,
    });

    this.logger.debug(`Step started: ${stepName} (flow: ${options.flowId})`);
  }

  skip(stepName: string, options: { flowId: string } & Record<string, any>) {
    const context = this._getFlowContext(options.flowId);
    if (!context) return;

    this.capture("Step Abandoned", {
      step: stepName,
      options,
    });
  }

  completed(options: { flowId: string } & Record<string, any>) {
    const context = this._getFlowContext(options.flowId);
    if (!context) return;

    this.capture("Flow Completed", {
      options: {
        ...options,
        flowId: options.flowId,
      },
    });

    this.logger.debug("Flow completed:", { flowId: options.flowId });

    this.flowContext.set(options.flowId, {
      id: context.id,
      startedAt: context.startedAt,
      status: "completed",
    });

    this._saveFlowContextToStorage();
    this._flush(); // flush immediately after completion
  }

  capture(
    eventType: string,
    data: {
      step?: string;
      options?: { flowId?: string } & Record<string, any>;
      result?: string;
    } = {},
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
      url: window.location.href,
      referrer: document.referrer || undefined,
    };

    if (this.env === "development") {
      this.logger.debug("Mock capture:", payload);
      return payload;
    }

    try {
      eventPayloadSchema.parse(payload);

      if (enqueue) {
        this.eventQueue.push(payload);
        this.logger.debug("Captured:", payload);
      }

      return payload;
    } catch (error) {
      this.logger.error("Invalid event payload:", error, payload);
      return null;
    }
  }

  context(contextTraits: Record<string, any>) {
    this.traits = { ...this.traits, ...contextTraits };
    this.logger.debug("Context updated:", this.traits);
  }

  reset() {
    this.sessionId = uuidv4();
    this.traits = {};
    this.flowContext.clear();
    this.eventQueue = [];
    this.retryQueue = [];
    this.logger.debug("Reset session and traits");
  }
}