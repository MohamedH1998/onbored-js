import { v4 as uuidv4 } from "uuid";
import { DEFAULT_GLOBAL_OPTIONS } from "./constants";
import { applySettingDefaults, isValidUUID, sanitize } from "./helpers";
import { Logger } from "./logger";
import {
  Environment,
  FlowContext,
  OnboredClientOptions,
  EventPayload,
  RetryEvent,
  EventType,
} from "./types";
import { eventPayloadSchema } from "./schema";
import { SessionReplayOptions } from "./session-replay/types";
import { SessionReplayClient } from "./session-replay/client";
import { createSessionReplay } from "./session-replay";

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
  protected sessionId: string;
  protected sessionTimeoutMs: number;
  protected sessionStorageKey: string;
  protected activityStorageKey: string;
  protected flowContextStorageKey: string;
  protected api_host: string;
  protected flowContext: Map<string, FlowContext>;
  protected headers: Record<string, string>;
  protected sessionReplay: false | SessionReplayOptions;
  protected recorder: SessionReplayClient | null = null;
  // protected fetch: Fetch;

  private initPromise: Promise<void>;
  private isInitializing = true;
  protected retryIntervalMs = 5000;
  protected queuedFlows: string[] = [];

  // Event queue and retry logic
  protected readonly MAX_QUEUE_SIZE = 1000;
  protected eventQueue: EventPayload[] = [];
  protected retryQueue: RetryEvent[] = [];
  protected flushInterval: number = 5000;
  protected flushTimer?: number;
  protected flushingRetry = false;
  private trackingPageviewsForFlows = new Set<string>();

  // Cleanup properties
  private retryInterval?: number;
  private intersectionObserver?: IntersectionObserver;
  private mutationObserver?: MutationObserver;
  private beforeUnloadHandler?: () => void;
  private popstateHandler?: () => void;
  private originalPushState?: typeof history.pushState;
  private originalReplaceState?: typeof history.replaceState;

  /**
   * Create a new client for use in the browser.
   * @param projectKey The unique Onbored Key which is supplied when you create a new project in your project dashboard.
   * @param options.user_id This user id will be used to identify the user in the Onbored dashboard.
   * @param options.user_metadata The user metadata.
   * @param options.debug Whether to enable debug mode.
   * @param options.api_host The API host.
   * @param options.env Set to "development" if you want to run the client in development mode.
   * @param options.global.fetch A custom fetch implementation.
   * @param options.global.headers Any additional headers to send with each network request.
   * @param options.session_replay The session replay options.
   * @param options.storage The storage options.
   * @param options.global The global options.
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
    this.env = settings.env ?? "production";
    this.debug = settings.debug ?? false;
    this.api_host = settings.api_host ?? "https://api.onbored.com";
    this.sessionStorageKey = settings.storage.sessionStorageKey ?? "";
    this.activityStorageKey = settings.storage.activityStorageKey ?? "";
    this.flowContextStorageKey = settings.storage.flowContextStorageKey ?? "";
    this.headers = settings.global.headers ?? {};
    // @ts-ignore
    this.sessionReplay = settings.session_replay ?? false;
    // this.fetch = settings.global.fetch ?? fetch;

    this.logger = new Logger("[Onbored]", this.debug ? "debug" : "info");

    this._restoreFlowContextFromStorage();
    this._startRetryLoop();
    this.initPromise = this._init();

    // Global flush function for debugging
    if (this.env === "development" && typeof window !== "undefined") {
      (window as any).__onboredFlush = () => this._flush();
    }
  }

  private async _init() {
    this.logger.debug("Initialized", this);

    if (this.env === "development") {
      this.logger.info("Dev mode enabled – no network requests will be sent");
      this.isInitializing = false;
      return;
    }

    this.beforeUnloadHandler = () => this._flush(true);
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
    this._startFlushTimer();

    try {
      // @TODO: Add better validation for the sessionReplay object
      if (this.sessionReplay && Object.keys(this.sessionReplay).length > 0) {
        if (this.debug) this.logger.debug("Creating session replay recorder");
        try {
          this.recorder = await createSessionReplay(this.projectKey, {
            sessionId: this.sessionId,
            debug: this.debug,
            ...this.sessionReplay,
          });
        } catch (recErr) {
          this.logger.error("Failed to init session replay:", recErr);
        }
      }

      try {
        const res = await fetch("/api/ingest/session", {
          method: "POST",
          body: JSON.stringify({
            id: this.sessionId,
            project_key: this.projectKey,
            user_id: this.userId,
            started_at: new Date().toISOString(),
          }),
          headers: this.headers,
        });

        if (!res.ok) {
          throw new Error(
            `Session registration failed with status ${res.status}`
          );
        }
      } catch (fetchErr) {
        this.logger.error("Session registration failed:", fetchErr);
        // You can optionally stop the recorder here if backend registration is mandatory
      }

      this.logger.debug("Session registered");
      this.isInitializing = false;

      this._trackPageView();
      this._enableStepViewTracking();

      this.queuedFlows.forEach((flow) => this.flow(flow));
      this.queuedFlows = [];
    } catch (err) {
      this.logger.error("Initialization failed:", err);
      this.isInitializing = false;
    }
  }

  private async waitForInit(): Promise<void> {
    try {
      return await this.initPromise;
    } catch (error) {
      this.logger.error("Initialization failed:", error);
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

    if (!existingSessionId || !isValidUUID(existingSessionId)) {
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
    this.retryInterval = window.setInterval(
      () => this._flushRetryQueue(),
      this.retryIntervalMs
    );
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
            this.logger.warn(
              "Max retries reached. Dropping event",
              event.payload
            );
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
      const response = await fetch(this.api_host + "/ingest/events", {
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
      this.logger.debug(
        "Flushing Events",
        payload.map((p) => ({
          event: p.eventType,
          step: p.step,
          timestamp: p.timestamp,
        }))
      );
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

  private _trackPageView(): void {
    if (typeof window === "undefined") return;

    this.popstateHandler = () => {
      this.capture("page_viewed", {
        options: {
          path: sanitize(window.location.pathname),
          title: sanitize(document.title),
        },
      });
    };

    window.addEventListener("popstate", this.popstateHandler);

    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    const patched =
      (method: any, orig: any) =>
      (...args: any[]) => {
        const result = orig.apply(this, args);

        setTimeout(() => {
          const path = sanitize(window.location.pathname);
          const lastPath = this._getLastPath();

          this.capture("page_viewed", {
            options: {
              path,
              title: sanitize(document.title),
              ...(lastPath && { from: lastPath, to: path }),
            },
          });

          // Update last path for next comparison
          this._setLastPath(path);
        }, 0);

        return result;
      };

    history.pushState = patched("pushState", this.originalPushState);
    history.replaceState = patched("replaceState", this.originalReplaceState);

    if (this.debug)
      this.logger.debug("[Onbored] SPA route change tracking enabled");
  }

  private _getLastPath(): string | undefined {
    return (
      sessionStorage.getItem(`${this.flowContextStorageKey}_last_path`) ||
      undefined
    );
  }

  private _setLastPath(path: string): void {
    sessionStorage.setItem(`${this.flowContextStorageKey}_last_path`, path);
  }

  private _viewStep(
    stepName: string,
    options: { slug: string } & Record<string, any>
  ) {
    const context = this._getFlowContext(options.slug);
    if (!context) return;

    this.capture("step_viewed", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        slug: options.slug,
      },
    });

    if (this.debug) {
      this.logger.debug(
        `[Onbored] Step viewed: ${stepName} (flow: ${options.slug})`
      );
    }
  }

  private _enableStepViewTracking(): void {
    if (typeof window === "undefined") return;

    this.logger.info("🔵🟡 - enableStepViewTracking");

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target as HTMLElement;
          const stepName = el.getAttribute("data-onbored-step");
          const slug = el.getAttribute("data-onbored-funnel");

          this.logger.info("🔵🟡 - stepName", stepName);
          this.logger.info("🔵🟡 - slug", slug);

          if (stepName && slug) {
            this._viewStep(stepName, { slug });
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
          this.intersectionObserver?.observe(el);
          observed.add(el);
        }
      });
    };
    // Initial pass
    observeMatchingElements();

    // Re-observe on DOM changes (SPA nav, re-renders, etc.)
    this.mutationObserver = new MutationObserver(() => {
      observeMatchingElements();
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (this.debug) {
      this.logger.debug(
        "[Onbored] Step view tracking enabled (with SPA support)"
      );
    }
  }

  // Public API methods
  async flow(slug: string) {
    if (this.isInitializing) {
      this.queuedFlows.push(slug);
      this.logger.debug("Queued flow:", slug);
      return;
    }

    await this.waitForInit();

    this.logger.info("🔵🟡 - flow", slug);
    this.logger.info("🔵🟡 - initialization complete");

    if (this.flowContext.has(slug)) {
      this.logger.debug(`Flow ${slug} already exists`);
      return;
    }

    if (this.env === "development") {
      this.logger.info("Mock flow started:", slug);
      return;
    }

    try {
      const response = await fetch(`/api/ingest/flow`, {
        method: "POST",
        body: JSON.stringify({
          sessionId: this.sessionId,
          projectKey: this.projectKey,
          slug: slug,
          startedAt: new Date().toISOString(),
        }),
        headers: this.headers,
      });

      const data: { status: string; flowId: string } = await response.json();

      this.logger.debug("Flow registered", data);
      this.capture("flow_started", { options: { flowId: data.flowId } });
      this.trackingPageviewsForFlows.add(data.flowId);

      this.flowContext.set(slug, {
        id: data.flowId,
        startedAt: Date.now(),
        status: "started",
      });

      this._saveFlowContextToStorage();
    } catch (err) {
      this.logger.error("Flow registration failed:", err);
    }
  }

  async step(
    stepName: string,
    options: { slug: string } & Record<string, any>
  ) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) return;

    this.capture("step_completed", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        slug: options.slug,
      },
    });
    this.trackingPageviewsForFlows.add(context.id);

    this.logger.debug(`Step started: ${stepName} (flow: ${options.slug})`);
  }

  async skip(
    stepName: string,
    options: { slug: string } & Record<string, any>
  ) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) return;

    this.capture("step_abandoned", {
      step: stepName,
      options: {
        ...options,
        flowId: context.id,
        slug: options.slug,
      },
    });

    this.logger.debug(`Step completed: ${stepName} (flow: ${options.slug})`);
  }

  async completed(options: { slug: string } & Record<string, any>) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) return;
      this.capture("flow_completed", {
      options: {
        ...options,
        flowId: context.id,
        slug: options.slug,
      },
    });

    this.logger.debug("Flow completed:", {
      flowId: context.id,
      slug: options.slug,
    });

    this.flowContext.set(options.slug, {
      id: context.id,
      startedAt: context.startedAt,
      status: "completed",
    });

    this._saveFlowContextToStorage();
    this._flush(); // flush immediately after completion
  }

  async capture(
    eventType: EventType,
    data: {
      step?: string;
      options?: { flowId?: string; slug?: string } & Record<string, any>;
      result?: string;
    } = {},
    enqueue: boolean = true
  ): Promise<EventPayload | null> {
    const payload: EventPayload = {
      eventType,
      flowId: data.options?.flowId,
      step: data.step,
      options: {
        ...data.options,
        flowId: data.options?.flowId,
        slug: data.options?.slug,
      },
      result: data.result,
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

      // Queue events that happen before initialization
      if (this.isInitializing || enqueue) {
        this.eventQueue.push(payload);
        this.logger.debug("Queued event (pre-init):", payload);
        return payload;
      }

      // Wait for initialization to complete for non-queued events
      if (!this.isInitializing) {
        await this.waitForInit();
      }

      return payload;
    } catch (error) {
      this.logger.error("Invalid event payload:", error, payload);
      return null;
    }
  }

  reset() {
    this.sessionId = uuidv4();
    this.flowContext.clear();
    this.eventQueue = [];
    this.retryQueue = [];
    this.trackingPageviewsForFlows.clear();
    this.logger.debug("Reset session");
    this.recorder?.stop();
  }

  destroy() {
    // Clear intervals
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = undefined;
    }

    // Disconnect observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = undefined;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = undefined;
    }

    // Remove event listeners
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }

    if (this.popstateHandler) {
      window.removeEventListener("popstate", this.popstateHandler);
      this.popstateHandler = undefined;
    }

    // Restore original history methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = undefined;
    }

    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = undefined;
    }

    // Remove global debug function
    if (this.env === "development" && typeof window !== "undefined") {
      delete (window as any).__onboredFlush;
    }

    this.logger.debug("OnboredClient destroyed");
  }
}
