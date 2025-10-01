import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_GLOBAL_OPTIONS } from './constants';
import { applySettingDefaults, isValidUUID, sanitize } from './helpers';
import { Logger } from './logger';
import {
  FlowContext,
  OnboredClientOptions,
  EventPayload,
  RetryEvent,
  EventType,
  Options,
  OnboredClientInterface,
} from './types';
import { eventPayloadSchema } from './schema';
import { SessionReplayOptions } from './session-replay/types';
import { SessionReplayClient } from './session-replay/client';
import { createSessionReplay } from './session-replay';

/**
 * OnBored Client.
 *
 * An isomorphic Javascript client for interacting with OnBored.
 */
export class OnboredClient implements OnboredClientInterface {
  protected logger: Logger;
  protected env: string;
  protected debug: boolean;
  protected userId: string;
  protected sessionId: string;
  protected sessionTimeoutMs: number;
  protected sessionStorageKey: string;
  protected activityStorageKey: string;
  protected flowContextStorageKey: string;
  protected apiHost: string;
  protected flowContext: Map<string, FlowContext>;
  protected headers: Record<string, string>;
  protected sessionReplay: false | SessionReplayOptions;
  protected recorder: SessionReplayClient | null = null;

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

  protected queuedStepViews: Array<{
    stepName: string;
    options: { slug: string } & Options;
  }> = [];

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
   * @param options.userId This user id will be used to identify the user in the Onbored dashboard.
   * @param options.userMetadata The user metadata.
   * @param options.debug Whether to enable debug mode.
   * @param options.apiHost The API host.
   * @param options.env Set to "development" if you want to run the client in development mode.
   * @param options.global.fetch A custom fetch implementation.
   * @param options.global.headers Any additional headers to send with each network request.
   * @param options.sessionReplay The session replay options.
   * @param options.storage The storage options.
   * @param options.global The global options.
   */
  constructor(
    protected projectKey: string,
    options?: OnboredClientOptions
  ) {
    if (!projectKey) throw new Error('[Onbored]: projectKey is required.');
    if (
      typeof globalThis.window === 'undefined' ||
      typeof globalThis.document === 'undefined'
    ) {
      throw new Error(
        '[Onbored]: OnboredClient can only be initialized in a browser environment.'
      );
    }

    this.projectKey = projectKey;

    const settings = applySettingDefaults(options, {
      global: DEFAULT_GLOBAL_OPTIONS,
      storage: {
        sessionStorageKey: `ob-session-${this.projectKey}`,
        activityStorageKey: `ob-activity-${this.projectKey}`,
        flowContextStorageKey: `ob-flow-context-${this.projectKey}`,
      },
    });

    this.debug = settings.debug ?? false;
    this.logger = new Logger('[Onbored]', this.debug ? 'debug' : 'info');

    this.sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
    this.flowContext = new Map<string, FlowContext>();

    this.userId = settings.userId ?? '';
    this.env = settings.env ?? 'production';
    this.apiHost = settings.apiHost ?? 'https://api.onbored.com';
    this.sessionStorageKey = settings.storage.sessionStorageKey ?? '';
    this.activityStorageKey = settings.storage.activityStorageKey ?? '';
    this.flowContextStorageKey = settings.storage.flowContextStorageKey ?? '';

    // Get session ID AFTER storage keys are set
    this.sessionId = this._getOrSetSessionId();
    this.headers = settings.global.headers ?? {};
    this.sessionReplay =
      settings.sessionReplay &&
      typeof settings.sessionReplay === 'object' &&
      'apiHost' in settings.sessionReplay
        ? (settings.sessionReplay as SessionReplayOptions)
        : false;
    // this.fetch = settings.global.fetch ?? fetch;

    this._restoreFlowContextFromStorage();
    this._startRetryLoop();
    this.initPromise = this._init();

    // Global flush function for debugging
    if (this.env === 'development' && typeof window !== 'undefined') {
      (window as Window & { __onboredFlush?: () => void }).__onboredFlush =
        () => this._flush();
    }
  }

  private async _init() {
    // @TODO: Add better validation for the sessionReplay object
    if (this.sessionReplay && Object.keys(this.sessionReplay).length > 0) {
      if (this.debug) this.logger.debug('Creating session replay recorder');
      try {
        this.recorder = await createSessionReplay(this.projectKey, {
          sessionId: this.sessionId,
          debug: this.debug,
          ...this.sessionReplay,
        });
        this.capture('page_viewed', {
          url: window.location.href,
          ...(document.title && { title: document.title }),
        });
      } catch (recErr) {
        this.logger.error('Failed to init session replay:', recErr);
      }
    }

    if (this.env === 'development') {
      this.logger.info('Dev mode enabled – no network requests will be sent');
      this.isInitializing = false;
      return;
    }

    this.beforeUnloadHandler = () => this._flush(true);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this._startFlushTimer();

    try {
      try {
        const res = await fetch(this.apiHost + '/ingest/session', {
          method: 'POST',
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
        this.logger.error('Session registration failed:', fetchErr);
      }

      this.logger.debug('Session registered');
      this.isInitializing = false;

      this._trackPageView();
      this._enableStepViewTracking();

      this.queuedFlows.forEach(flow => this.flow(flow));
      this.queuedFlows = [];
    } catch (err) {
      this.logger.error('Initialization failed:', err);
      this.isInitializing = false;
    }
  }

  private async waitForInit(): Promise<void> {
    try {
      return await this.initPromise;
    } catch (error) {
      this.logger.error('Initialization failed:', error);
    }
  }

  private _createSession() {
    const newId = uuidv4();
    try {
      localStorage.setItem(this.sessionStorageKey, newId);
    } catch (error) {
      this.logger.warn('Failed to save session to localStorage:', error);
    }
    return newId;
  }

  private _createActivity(date: number) {
    try {
      localStorage.setItem(this.activityStorageKey, date.toString());
    } catch (error) {
      this.logger.warn('Failed to save activity to localStorage:', error);
    }
  }

  private _getOrSetSessionId(): string {
    const now = Date.now();
    let lastActivity = 0;

    try {
      lastActivity = parseInt(
        localStorage.getItem(this.activityStorageKey) || '0'
      );
    } catch (error) {
      this.logger.warn('Failed to read activity from localStorage:', error);
    }

    if (!lastActivity) {
      const sessionId = this._createSession();
      this._createActivity(now);
      return sessionId;
    }

    let existingSessionId: string | null = null;
    try {
      existingSessionId = localStorage.getItem(this.sessionStorageKey);
    } catch (error) {
      this.logger.warn('Failed to read session from localStorage:', error);
    }

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
    try {
      const raw = sessionStorage.getItem(this.flowContextStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (parsed.sessionId !== this.sessionId) return; // session changed

      this.flowContext = new Map(parsed.flows);

      if (this.debug)
        this.logger.debug('Restored flowContexts:', this.flowContext);
    } catch (err) {
      this.logger.warn('Failed to restore flow context:', err);
    }
  }

  private _saveFlowContextToStorage() {
    try {
      const raw = JSON.stringify({
        sessionId: this.sessionId,
        flows: Array.from(this.flowContext.entries()),
      });
      sessionStorage.setItem(this.flowContextStorageKey, raw);
    } catch (err) {
      this.logger.warn('Failed to save flow context to storage:', err);
    }
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
      const ready = this.retryQueue.filter(e => e.nextAttemptAt <= now);
      this.retryQueue = this.retryQueue.filter(e => e.nextAttemptAt > now);

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
              'Max retries reached. Dropping event',
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
    if (this.env === 'development') {
      this.logger.debug('Mock sendEvents:', payload);
      return;
    }

    try {
      const response = await fetch(this.apiHost + '/ingest/events', {
        method: 'POST',
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

    // In development mode, don't actually flush (keep events for testing)
    if (this.env === 'development') {
      if (this.debug) {
        this.logger.debug(
          'Mock flush (development mode)',
          this.eventQueue.map(p => ({
            event: p.event_type,
            step: p.step_id,
            timestamp: p.timestamp,
          }))
        );
      }
      return;
    }

    const payload = [...this.eventQueue];
    this.eventQueue = [];

    const endpoint = this.apiHost + '/ingest/events';

    if (navigator.sendBeacon && isUnload) {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'application/json',
      });
      navigator.sendBeacon(endpoint, blob);
    } else {
      this._sendEvents(payload).catch(err => {
        this.eventQueue.unshift(...payload); // retry next flush
        this.logger.error('Flush failed:', err);
      });
    }

    if (this.debug) {
      this.logger.debug(
        'Flushing Events',
        payload.map(p => ({
          event: p.event_type,
          step: p.step_id,
          timestamp: p.timestamp,
        }))
      );
    }
  }

  _getFlowContext(flowId: string): FlowContext | null {
    const context = this.flowContext.get(flowId);
    if (!context) {
      this.logger.warn(`No context for flow: "${flowId}"`);
      return null;
    }
    return context;
  }

  private _trackPageView(): void {
    if (typeof window === 'undefined') return;

    this.popstateHandler = () => {
      this.capture('page_viewed', {
        url: window.location.href,
        ...(document.referrer && { referrer: document.referrer }),
      });
    };

    window.addEventListener('popstate', this.popstateHandler);

    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    const patched =
      (method: any, orig: any) =>
      (...args: any[]) => {
        const result = orig.apply(this, args);

        setTimeout(() => {
          const path = sanitize(window.location.pathname);
          const lastPath = this._getLastPath();

          this.capture('page_viewed', {
            url: window.location.href,
            ...(document.referrer && { referrer: document.referrer }),
          });

          // Update last path for next comparison
          this._setLastPath(path);
        }, 0);

        return result;
      };

    history.pushState = patched('pushState', this.originalPushState);
    history.replaceState = patched('replaceState', this.originalReplaceState);
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

  private _viewStep(stepName: string, options: { slug: string } & Options) {
    const context = this._getFlowContext(options.slug);

    if (!context) {
      this.queuedStepViews.push({ stepName, options });
      return;
    }

    this.capture(
      'step_viewed',
      {
        step_id: stepName,
        flow_id: context.id,
        funnel_slug: options.slug,
        metadata: {
          ...options,
        },
      },
      true
    );

    if (this.debug) {
      this.logger.debug(
        `[Onbored] Step viewed: ${stepName} (flow: ${options.slug})`
      );
    }
  }

  private _enableStepViewTracking(): void {
    if (typeof window === 'undefined') return;

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const el = entry.target as HTMLElement;
          const stepName = el.getAttribute('data-onbored-step');
          const slug = el.getAttribute('data-onbored-funnel');

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
        '[data-onbored-step][data-onbored-funnel]'
      );

      elements.forEach(el => {
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
  }

  // Public API methods
  async flow(slug: string, metadata?: Options) {
    if (this.isInitializing) {
      this.queuedFlows.push(slug);
      this.logger.debug('Queued flow:', slug);
      return;
    }

    await this.waitForInit();

    if (this.flowContext.has(slug)) {
      this.logger.debug(`Flow ${slug} already exists`);
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const flowId = crypto.randomUUID();
      const payload: EventPayload = {
        id: crypto.randomUUID(),
        event_type: 'flow_started',
        flow_id: flowId,
        step_id: 'flow_started',
        funnel_slug: slug,
        ...(metadata && { metadata }),
        session_id: this.sessionId,
        timestamp: timestamp,
        project_key: this.projectKey,
        url: window.location.href,
        ...(document.referrer && { referrer: document.referrer }),
      };

      // Store flow context before sending network request
      this.flowContext.set(slug, {
        id: flowId,
        startedAt: new Date(timestamp).getTime(),
        status: 'started',
      });

      this._saveFlowContextToStorage();

      if (this.env === 'development') {
        this.logger.info('Mock flow started:', slug);
        // Queue the event in development mode
        this.eventQueue.push(payload);
        this._processQueuedStepViews(slug);
        return;
      }

      const response = await fetch(this.apiHost + '/ingest/flow', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: this.headers,
      });

      const data: { status: string } = await response.json();
      if (data.status !== 'ok') {
        this.logger.error('Flow registration failed:', data);
        return;
      }
      this.trackingPageviewsForFlows.add(flowId);

      this._processQueuedStepViews(slug);
    } catch (err) {
      this.logger.error('Flow registration failed:', err);
    }
  }

  private _processQueuedStepViews(flowSlug: string) {
    const relevantStepViews = this.queuedStepViews.filter(
      queued => queued.options.slug === flowSlug
    );

    this.queuedStepViews = this.queuedStepViews.filter(
      queued => queued.options.slug !== flowSlug
    );

    relevantStepViews.forEach(({ stepName, options }) => {
      this._viewStep(stepName, options);
    });
  }

  async step(stepName: string, options: { slug: string } & Options) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) {
      this.logger.warn('No context in this step', stepName);
      // this.queuedStepViews.push({ stepName, options });
      return;
    }

    this.capture('step_complete', {
      step_id: stepName,
      flow_id: context.id,
      funnel_slug: options.slug,
      metadata: {
        ...options,
      },
    });
    this.trackingPageviewsForFlows.add(context.id);

    this.logger.debug(`Step started: ${stepName} (flow: ${options.slug})`);
  }

  async skip(stepName: string, options: { slug: string } & Options) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) return;

    this.capture('step_abandoned', {
      step_id: stepName,
      flow_id: context.id,
      funnel_slug: options.slug,
      metadata: {
        ...options,
      },
    });

    this.logger.debug(`Step skipped: ${stepName} (flow: ${options.slug})`);
  }

  async complete(options: { slug: string } & Options) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) return;
    this.capture('flow_complete', {
      flow_id: context.id,
      funnel_slug: options.slug,
      metadata: {
        ...options,
      },
    });

    this.logger.debug('Flow complete:', {
      flowId: context.id,
      slug: options.slug,
    });

    this.flowContext.set(options.slug, {
      id: context.id,
      startedAt: context.startedAt,
      status: 'complete',
    });

    this._saveFlowContextToStorage();
    this._flush(); // flush immediately after completion
  }

  async capture(
    event_type: EventType,
    data: Partial<
      Omit<
        EventPayload,
        'id' | 'event_type' | 'session_id' | 'timestamp' | 'project_key'
      >
    >,
    enqueue: boolean = true
  ): Promise<EventPayload | null> {
    // Extract known fields and treat the rest as metadata
    const { flow_id, step_id, funnel_slug, metadata } = data as Partial<
      Omit<
        EventPayload,
        'id' | 'event_type' | 'session_id' | 'timestamp' | 'project_key'
      >
    >;

    const payload: EventPayload = {
      id: crypto.randomUUID(),
      event_type,
      ...(flow_id && { flow_id }),
      ...(step_id && { step_id }),
      ...(funnel_slug && { funnel_slug }),
      ...(metadata && { metadata }),
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      project_key: this.projectKey,
      url: window.location.href,
      ...(document.referrer && { referrer: document.referrer }),
    };

    try {
      eventPayloadSchema.parse(payload);

      if (this.env === 'development') {
        this.logger.debug('Mock capture:', payload);
        // Still queue events in development mode for testing
        this.eventQueue.push(payload);
        return payload;
      }

      // Queue events that happen before initialization
      if (this.isInitializing || enqueue) {
        this.eventQueue.push(payload);
        this.logger.debug('Queued event (pre-init):', payload);
        return payload;
      }

      // Wait for initialization to complete for non-queued events
      if (!this.isInitializing) {
        await this.waitForInit();
      }

      return payload;
    } catch (error) {
      this.logger.error('Invalid event payload:', error, payload);
      return null;
    }
  }

  reset() {
    this.sessionId = uuidv4();
    this.flowContext.clear();
    this.eventQueue = [];
    this.retryQueue = [];
    this.queuedStepViews = [];
    this.trackingPageviewsForFlows.clear();
    this.logger.debug('Reset session');
    this.recorder?.stop();
  }

  destroy() {
    // Clear intervals
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      delete this.flushTimer;
    }

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      delete this.retryInterval;
    }

    // Disconnect observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      delete this.intersectionObserver;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      delete this.mutationObserver;
    }

    // Remove event listeners
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      delete this.beforeUnloadHandler;
    }

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      delete this.popstateHandler;
    }

    // Restore original history methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      delete this.originalPushState;
    }

    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      delete this.originalReplaceState;
    }

    // Remove global debug function
    if (this.env === 'development' && typeof window !== 'undefined') {
      delete (window as Window & { __onboredFlush?: () => void })
        .__onboredFlush;
    }

    this.logger.debug('OnboredClient destroyed');
  }

  // Debug methods for testing
  _getEvents() {
    return [...this.eventQueue];
  }

  _getSessionId() {
    return this.sessionId;
  }

  _getRecorder() {
    return this.recorder;
  }

  _getRecorderEvents() {
    if (this.recorder) {
      return this.eventQueue;
    }
    return [];
  }
}
