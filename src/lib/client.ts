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
  protected accountId: string | undefined;
  protected accountTraits: Options | undefined;
  protected logger: Logger;
  protected env: string;
  protected debug: boolean;
  protected userId: string;
  protected userTraits: Options | undefined;
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

  protected eventBuffer: EventPayload[] = [];
  protected bufferKey: string;
  protected funnelBuffer: Array<{
    slug: string;
    flowId: string;
    metadata?: Options;
  }> = [];
  protected funnelBufferKey: string;

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
   * @param options.userTraits The user traits.
   * @param options.accountId The account id.
   * @param options.accountTraits The account traits.
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
    this.accountId = settings.accountId;
    this.accountTraits = settings.accountTraits ?? {};
    this.userTraits = settings.userTraits ?? {};
    this.env = settings.env ?? 'production';
    this.apiHost = settings.apiHost ?? 'https://api.onbored.com';
    this.sessionStorageKey = settings.storage.sessionStorageKey ?? '';
    this.activityStorageKey = settings.storage.activityStorageKey ?? '';
    this.flowContextStorageKey = settings.storage.flowContextStorageKey ?? '';
    this.bufferKey = `ob-buffer-${this.projectKey}`;
    this.funnelBufferKey = `ob-funnel-buffer-${this.projectKey}`;

    this.sessionId = this._getOrSetSessionId();
    this.headers = settings.global.headers ?? {};
    this.sessionReplay =
      settings.sessionReplay &&
      typeof settings.sessionReplay === 'object' &&
      'apiHost' in settings.sessionReplay
        ? (settings.sessionReplay as SessionReplayOptions)
        : false;

    this._restoreFlowContextFromStorage();
    this._startRetryLoop();
    this.initPromise = this._init();

    this._restoreBuffer();
    this._restoreFunnelBuffer();

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
          ...(this.userId && { userId: this.userId }),
          ...(this.accountId && { accountId: this.accountId }),
          debug: this.debug,
          uploadUrl: `${this.apiHost.replace(/\/$/, '')}/ingest/session-replay`,
          ...this.sessionReplay,
          onReplayEvent: (eventType, data) => {
            this.capture(eventType, {
              metadata: data,
            });
          },
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
            ...(this.userId && { user_id: this.userId }),
            ...(this.accountId && { account_id: this.accountId }),
            ...(this.accountTraits && { account_traits: this.accountTraits }),
            ...(this.userTraits && { user_traits: this.userTraits }),
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

      this.queuedFlows.forEach(flow => this.funnel(flow));
      this.queuedFlows = [];
      if (this.userId) {
        this.identify(this.userId, this.userTraits);
      }
      if (this.accountId) {
        await this.identifyAccount(this.accountId, this.accountTraits);
      }
    } catch (err) {
      this.logger.error('Initialization failed:', err);
    }

    this.isInitializing = false;
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
      this._persist(this.sessionStorageKey, newId);
    } catch (error) {
      this.logger.warn('Failed to save session to localStorage:', error);
    }
    return newId;
  }

  private _createActivity(date: number) {
    try {
      this._persist(this.activityStorageKey, date.toString());
    } catch (error) {
      this.logger.warn('Failed to save activity to localStorage:', error);
    }
  }

  private _getOrSetSessionId(): string {
    const now = Date.now();
    let lastActivity = 0;

    try {
      lastActivity = parseInt(this._load(this.activityStorageKey) || '0');
    } catch (error) {
      this.logger.warn('Failed to read activity from localStorage:', error);
    }

    if (!lastActivity) {
      const sessionId = this._createSession();
      this._createActivity(now);
      return sessionId;
    }

    let existingSessionId: string | undefined = undefined;
    try {
      existingSessionId = this._load(this.sessionStorageKey);
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

  private _getTimestampData() {
    const now = new Date();
    return {
      timestamp: now.toISOString(), // UTC
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezone_offset: -now.getTimezoneOffset(), // Convert to minutes from UTC
    };
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

  private _restoreBuffer() {
    try {
      const stored = localStorage.getItem(this.bufferKey);
      if (stored) {
        this.eventBuffer = JSON.parse(stored);
        this.logger.debug(
          `Restored ${this.eventBuffer.length} buffered events`
        );
      }
    } catch (err) {
      this.logger.warn('Failed to restore buffer:', err);
    }
  }

  private _persistBuffer() {
    try {
      localStorage.setItem(this.bufferKey, JSON.stringify(this.eventBuffer));
    } catch (err) {
      this.logger.warn('Failed to persist buffer:', err);
    }
  }

  private _restoreFunnelBuffer() {
    try {
      const stored = localStorage.getItem(this.funnelBufferKey);
      if (stored) {
        this.funnelBuffer = JSON.parse(stored);
        this.logger.debug(
          `Restored ${this.funnelBuffer.length} buffered funnels`
        );
      }
    } catch (err) {
      this.logger.warn('Failed to restore funnel buffer:', err);
    }
  }

  private _persistFunnelBuffer() {
    try {
      localStorage.setItem(
        this.funnelBufferKey,
        JSON.stringify(this.funnelBuffer)
      );
    } catch (err) {
      this.logger.warn('Failed to persist funnel buffer:', err);
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

    console.log('🟣🟢 - - _sendEvents', payload);

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
    console.log('🟣🟢 - - _flush', this.eventQueue.length);
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

  identify(userId: string, traits: Options = {}) {
    if (!userId) return;
    this.userId = userId;
    this._persistIdentity('userId', userId);
    if (Object.keys(traits).length) {
      this._mergeUserTraits(traits);
    }
  }

  async identifyAccount(accountId: string, traits: Options = {}) {
    if (!accountId) return;

    const isNewAccount = !this.accountId;

    if (this.accountId && this.accountId !== accountId) {
      // Stop recorder before rotating session
      if (this.recorder) {
        this.recorder.stop();
        this.logger.debug('Stopped recorder for account change');
      }

      this._rotateSession();

      // Restart recorder with new session
      if (
        this.recorder &&
        this.sessionReplay &&
        Object.keys(this.sessionReplay).length > 0
      ) {
        try {
          this.recorder = await createSessionReplay(this.projectKey, {
            sessionId: this.sessionId,
            ...(this.userId && { userId: this.userId }),
            ...(accountId && { accountId: accountId }),
            debug: this.debug,
            uploadUrl: `${this.apiHost.replace(/\/$/, '')}/ingest/session-replay`,
            ...this.sessionReplay,
            onReplayEvent: (eventType, data) => {
              this.capture(eventType, {
                metadata: data,
              });
            },
          });
          this.logger.debug('Restarted recorder with new session');
        } catch (recErr) {
          this.logger.error('Failed to restart session replay:', recErr);
        }
      }
    }

    this.accountId = accountId;

    this._persistIdentity('accountId', accountId);
    if (Object.keys(traits).length) {
      this._mergeAccountTraits(traits);
    }

    if (isNewAccount && this.eventBuffer.length > 0) {
      const eventsToFlush = this.eventBuffer.map(e => ({
        ...e,
        account_id: accountId,
        ...(this.accountTraits && { account_traits: this.accountTraits }),
        ...(this.userTraits && { user_traits: this.userTraits }),
        metadata: {
          ...e.metadata,
          preauth: true,
        },
      }));

      this.logger.info(
        `Flushing ${eventsToFlush.length} buffered events with account_id`
      );

      // Add to event queue for normal processing
      this.eventQueue.push(...eventsToFlush);

      // Clear buffer
      this.eventBuffer = [];
      try {
        localStorage.removeItem(this.bufferKey);
      } catch (err) {
        this.logger.warn('Failed to clear buffer from storage:', err);
      }

      // Flush immediately
      this._flush();
    }

    // Process buffered funnels
    if (isNewAccount && this.funnelBuffer.length > 0) {
      this.logger.info(
        `Flushing ${this.funnelBuffer.length} buffered funnels with account_id`
      );

      const funnelsToFlush = [...this.funnelBuffer];
      this.funnelBuffer = [];

      try {
        localStorage.removeItem(this.funnelBufferKey);
      } catch (err) {
        this.logger.warn('Failed to clear funnel buffer from storage:', err);
      }

      // Process each buffered funnel - send flow_started event with existing flowId
      for (const bufferedFunnel of funnelsToFlush) {
        const context = this._getFlowContext(bufferedFunnel.slug);
        if (!context) {
          this.logger.warn(
            'No flow context found for buffered funnel:',
            bufferedFunnel.slug
          );
          continue;
        }

        try {
          const timestampData = this._getTimestampData();
          const payload: EventPayload = {
            id: crypto.randomUUID(),
            event_type: 'flow_started',
            flow_id: bufferedFunnel.flowId,
            step_id: 'flow_started',
            funnel_slug: bufferedFunnel.slug,
            ...(bufferedFunnel.metadata && {
              metadata: bufferedFunnel.metadata,
            }),
            session_id: this.sessionId,
            timestamp: timestampData.timestamp,
            timezone: timestampData.timezone,
            timezone_offset: timestampData.timezone_offset,
            project_key: this.projectKey,
            ...(this.userId && { user_id: this.userId }),
            ...(accountId && { account_id: accountId }),
            ...(this.userTraits && { user_traits: this.userTraits }),
            ...(this.accountTraits && { account_traits: this.accountTraits }),
            url: window.location.href,
            ...(document.referrer && { referrer: document.referrer }),
          };

          if (this.env === 'development') {
            this.logger.info(
              'Mock funnel started (buffered):',
              bufferedFunnel.slug
            );
            this.eventQueue.push(payload);
            this._processQueuedStepViews(bufferedFunnel.slug);
            continue;
          }

          const response = await fetch(this.apiHost + '/ingest/flow', {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: this.headers,
          });

          const data: { status: string } = await response.json();
          if (data.status !== 'ok') {
            this.logger.error('Buffered funnel registration failed:', data);
            continue;
          }

          this.trackingPageviewsForFlows.add(bufferedFunnel.flowId);
          this._processQueuedStepViews(bufferedFunnel.slug);
        } catch (err) {
          this.logger.error('Buffered funnel registration failed:', err);
        }
      }
    }
  }

  // Public API methods
  async funnel(slug: string, metadata?: Options) {
    if (this.isInitializing) {
      this.queuedFlows.push(slug);
      this.logger.debug('Queued funnel:', slug);
      return;
    }

    await this.waitForInit();

    if (this.flowContext.has(slug)) {
      this.logger.debug(`Funnel ${slug} already exists`);
      return;
    }

    // Generate flowId and timestamp data before buffering or sending
    const timestampData = this._getTimestampData();
    const flowId = crypto.randomUUID();

    // Store flow context immediately so events can reference it
    this.flowContext.set(slug, {
      id: flowId,
      startedAt: new Date(timestampData.timestamp).getTime(),
      status: 'started',
    });
    this._saveFlowContextToStorage();

    // Buffer funnel if no accountId
    if (!this.accountId) {
      this.funnelBuffer.push({
        slug,
        flowId,
        ...(metadata && { metadata }),
      });
      this._persistFunnelBuffer();
      this.logger.debug(
        'Funnel buffered (no account):',
        slug,
        'flowId:',
        flowId
      );
      return;
    }

    try {
      const payload: EventPayload = {
        id: crypto.randomUUID(),
        event_type: 'flow_started',
        flow_id: flowId,
        step_id: 'flow_started',
        funnel_slug: slug,
        ...(metadata && { metadata }),
        session_id: this.sessionId,
        timestamp: timestampData.timestamp,
        timezone: timestampData.timezone,
        timezone_offset: timestampData.timezone_offset,
        project_key: this.projectKey,
        ...(this.userId && { user_id: this.userId }),
        ...(this.accountId && { account_id: this.accountId }),
        ...(this.userTraits && { user_traits: this.userTraits }),
        ...(this.accountTraits && { account_traits: this.accountTraits }),
        url: window.location.href,
        ...(document.referrer && { referrer: document.referrer }),
      };

      if (this.env === 'development') {
        this.logger.info('Mock funnel started:', slug);
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
        this.logger.error('Funnel registration failed:', data);
        return;
      }
      this.trackingPageviewsForFlows.add(flowId);

      this._processQueuedStepViews(slug);
    } catch (err) {
      this.logger.error('Funnel registration failed:', err);
    }
  }

  async step(stepName: string, options: { slug: string } & Options) {
    await this.waitForInit();
    const context = this._getFlowContext(options.slug);
    if (!context) {
      this.logger.warn('No context in this step', stepName);
      // this.queuedStepViews.push({ stepName, options });
      return;
    }

    this.capture('step_completed', {
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
    this.capture('flow_completed', {
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
    const userTraits = this._loadIdentity<Options>('userTraits');
    const accountTraits = this._loadIdentity<Options>('accountTraits');
    const timestampData = this._getTimestampData();

    const payload: EventPayload = {
      id: crypto.randomUUID(),
      event_type,
      ...(flow_id && { flow_id }),
      ...(step_id && { step_id }),
      ...(funnel_slug && { funnel_slug }),
      ...(metadata && { metadata }),
      session_id: this.sessionId,
      timestamp: timestampData.timestamp,
      timezone: timestampData.timezone,
      timezone_offset: timestampData.timezone_offset,
      project_key: this.projectKey,
      url: window.location.href,
      ...(this.userId && { user_id: this.userId }),
      ...(this.accountId && { account_id: this.accountId }),
      ...(userTraits && { user_traits: userTraits }),
      ...(accountTraits && { account_traits: accountTraits }),
      ...(document.referrer && { referrer: document.referrer }),
    };

    try {
      eventPayloadSchema.parse(payload);

      if (!this.accountId) {
        this.eventBuffer.push(payload);
        this._persistBuffer();
        this.logger.debug('Event buffered (no account):', event_type);
        return payload;
      }

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

  private _persistIdentity(k: 'userId' | 'accountId', v: string) {
    this._persist(`${this.sessionStorageKey}-${k}`, v);
  }

  private _persist(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      this.logger.warn('Failed to persist:', k, v);
    }
  }

  private _loadIdentity<T = unknown>(k: string): T | undefined {
    return this._load(`${this.sessionStorageKey}-${k}`);
  }

  private _load<T = unknown>(k: string): T | undefined {
    try {
      const v = localStorage.getItem(`${this.sessionStorageKey}-${k}`);
      return v ? JSON.parse(v) : undefined;
    } catch {
      return undefined;
    }
  }

  private _stashIdentity(k: string, v: unknown) {
    this._stash(`${this.sessionStorageKey}-${k}`, v);
  }

  private _stash(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      this.logger.warn('Failed to stash:', k, v);
    }
  }

  private _mergeUserTraits(t: Options) {
    this._stashIdentity('userTraits', {
      ...(this._loadIdentity('userTraits') || {}),
      ...t,
    });
  }
  private _mergeAccountTraits(t: Options) {
    this._stashIdentity('accountTraits', {
      ...(this._loadIdentity('accountTraits') || {}),
      ...t,
    });
  }

  private _rotateSession() {
    this.sessionId = this._createSession();
    this.flowContext.clear();
    this._saveFlowContextToStorage();
  }

  reset() {
    this.sessionId = uuidv4();
    this.flowContext.clear();
    this.eventQueue = [];
    this.retryQueue = [];
    this.queuedStepViews = [];
    this.trackingPageviewsForFlows.clear();
    this.eventBuffer = [];
    this.funnelBuffer = [];
    try {
      localStorage.removeItem(this.bufferKey);
      localStorage.removeItem(this.funnelBufferKey);
    } catch (err) {
      this.logger.warn('Failed to clear buffers on reset:', err);
    }
    this.logger.debug('Reset session');
    this.recorder?.stop();
  }

  destroy() {
    this._flush(true);

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

    this.eventBuffer = [];

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

  _getBufferedEvents() {
    return [...this.eventBuffer];
  }

  _getBufferSize() {
    return this.eventBuffer.length;
  }

  _getAccountId() {
    return this.accountId;
  }

  _getUserId() {
    return this.userId;
  }

  _getBufferedFunnels() {
    return [...this.funnelBuffer];
  }
}
