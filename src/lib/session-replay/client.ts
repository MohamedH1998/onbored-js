import pako from 'pako';
import { eventWithTime, EventType, IncrementalSource } from '@rrweb/types';
import { recordOptions } from 'rrweb/typings/types';

import { Logger } from '../logger';

import { SessionReplayClientOptions } from './types';

declare global {
  interface Window {
    rrweb?: {
      takeFullSnapshot?: () => void;
    };
  }
}

const MAX_BYTES_PER_PAYLOAD = 900_000; // ~900KB (keep below 1MB)
const MAX_EVENTS_PER_PAYLOAD = 100; // Max number of events before flush
const MAX_TIME_BEFORE_FLUSH = 10_000; // 10 seconds
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

const DEFAULT_MASK_INPUT_OPTIONS = {
  password: true,
  email: true,
  tel: true,
  number: false,
  text: false,
  textarea: false,
  search: false,
  url: false,
  date: false,
  color: false,
};

const DEFAULT_PRIVATE_SELECTORS = [
  '[data-private]',
  '[data-sensitive]',
  '.private',
  '.sensitive',
  '.password',
  '.ssn',
  '.credit-card',
];

export class SessionReplayClient {
  private events: eventWithTime[] = [];
  private stopFn: (() => void) | null = null;
  private uploadTimer: ReturnType<typeof setTimeout> | null = null;
  private isRecording = false;
  private isIdle = false;
  private lastActivity = Date.now();
  private lastFlushTime = Date.now();
  private hasSeenFullSnapshot = false;
  private logger: Logger;

  private options: SessionReplayClientOptions;
  private onReplayEvent?: (
    eventType: 'replay_started' | 'replay_stopped',
    data: {
      sessionId: string;
      accountId?: string;
      userId?: string;
      timestamp: string;
    }
  ) => void;

  constructor(
    private projectKey: string,
    options: SessionReplayClientOptions
  ) {
    this.logger = new Logger(
      '[Session Recorder]',
      options.debug ? 'debug' : 'info'
    );

    this.options = {
      apiHost: options.apiHost,
      flushInterval: options.flushInterval ?? 10_000,
      maskInputs: options.maskInputs ?? true,
      maskInputOptions: {
        ...DEFAULT_MASK_INPUT_OPTIONS,
        ...(options.maskInputOptions || {}),
      },
      blockElements: options.blockElements ?? [],
      privateSelectors: [
        ...DEFAULT_PRIVATE_SELECTORS,
        ...(options.privateSelectors || []),
      ],
      onError: options.onError ?? ((err: Error) => console.error(err)),
      uploadUrl: options.uploadUrl,
      sessionId: options.sessionId,
      debug: options.debug,
      ...(options.accountId && { accountId: options.accountId }),
      ...(options.userId && { userId: options.userId }),
    };

    this.onReplayEvent = options.onReplayEvent ?? (() => {});
  }

  public async start(): Promise<void> {
    if (this.isRecording) {
      this.logger.info('Already recording');
      return;
    }

    const rrweb = await import('rrweb');

    this.isRecording = true;
    this.lastActivity = Date.now();
    this.hasSeenFullSnapshot = false;

    const blockSelectors = [
      ...(this.options.blockElements || []),
      ...(this.options.privateSelectors || []),
    ].join(',');

    const recordOptions: recordOptions<eventWithTime> = {
      emit: event => {
        this.events.push(event);
        this._checkIdle(event);
        this._maybeFlushSnapshot();

        if (event.type === EventType.FullSnapshot) {
          this.hasSeenFullSnapshot = true;
          this._uploadEvents();
        }

        this.logger.debug('Event captured');
      },
      ...(blockSelectors && { blockSelector: blockSelectors }),
      maskAllInputs: this.options.maskInputs ?? true,
      maskInputOptions: this.options.maskInputOptions ?? {
        ...DEFAULT_MASK_INPUT_OPTIONS,
        ...(this.options.maskInputOptions || {}),
      },
      recordCanvas: false,
      sampling: {
        mousemove: true,
        mousemoveCallback: 50,
        input: 'last',
      },
    };

    this.stopFn = rrweb.record(recordOptions) as (() => void) | null;

    setTimeout(() => {
      if (!this.hasSeenFullSnapshot) {
        window.rrweb?.takeFullSnapshot?.();
      }
    }, 1000);

    this._startUploadTimer();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.onReplayEvent?.('replay_started', {
      sessionId: this.options.sessionId,
      ...(this.options.accountId && { accountId: this.options.accountId }),
      ...(this.options.userId && { userId: this.options.userId }),
      timestamp: new Date().toISOString(),
    });
    this.logger.debug('Emitted replay_started event');
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this._uploadEvents();
    }
  };

  public stop(): void {
    if (!this.isRecording) return;

    this.logger.debug('Stopping session recording');
    this.isRecording = false;

    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );

    this.stopFn?.();
    this.stopFn = null;

    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
      this.uploadTimer = null;
    }

    this._uploadEvents(); // Final flush

    this.onReplayEvent?.('replay_stopped', {
      sessionId: this.options.sessionId,
      ...(this.options.accountId && { accountId: this.options.accountId }),
      ...(this.options.userId && { userId: this.options.userId }),
      timestamp: new Date().toISOString(),
    });
    this.logger.debug('Emitted replay_stopped event');
  }

  public clearEvents(): void {
    this.events = [];
  }

  public addCustomEvent(tag: string, payload: any): void {
    const event: eventWithTime = {
      type: EventType.Custom,
      data: { tag, payload },
      timestamp: Date.now(),
    };
    this.events.push(event);
    this.logger.debug('Custom event added', { tag, payload });
  }

  public _getEvents(): eventWithTime[] {
    return [...this.events];
  }

  private _startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      if (this.events.length > 0 && !this.isIdle) {
        this._uploadEvents();
      }
    }, this.options.flushInterval);
  }

  private _maybeFlushSnapshot(): void {
    const now = Date.now();
    const timeSinceLastFlush = now - this.lastFlushTime;
    const eventCount = this.events.length;
    const payloadSize = new Blob([JSON.stringify(this.events)]).size;

    const shouldFlushBySize = payloadSize > MAX_BYTES_PER_PAYLOAD;
    const shouldFlushByCount = eventCount >= MAX_EVENTS_PER_PAYLOAD;
    const shouldFlushByTime = timeSinceLastFlush >= MAX_TIME_BEFORE_FLUSH;

    if (shouldFlushBySize) {
      this.logger.debug(
        `Payload exceeded max size (${payloadSize} bytes), flushing...`
      );
      this._uploadEvents();
    } else if (shouldFlushByCount) {
      this.logger.debug(
        `Event count exceeded max (${eventCount} events), flushing...`
      );
      this._uploadEvents();
    } else if (shouldFlushByTime) {
      this.logger.debug(
        `Time exceeded max (${timeSinceLastFlush}ms), flushing...`
      );
      this._uploadEvents();
    }
  }

  private _checkIdle(event: eventWithTime) {
    const now = Date.now();

    const isInteractive =
      event.type === EventType.IncrementalSnapshot &&
      [
        IncrementalSource.MouseMove,
        IncrementalSource.MouseInteraction,
        IncrementalSource.Input,
        IncrementalSource.TouchMove,
        IncrementalSource.MediaInteraction,
        IncrementalSource.Drag,
        IncrementalSource.Scroll,
      ].includes(event.data?.source);

    if (isInteractive) {
      const wasIdle = this.isIdle;
      this.lastActivity = now;
      this.isIdle = false;

      if (wasIdle) {
        this._forceSnapshot();
      }
    } else if (now - this.lastActivity > IDLE_TIMEOUT) {
      this.isIdle = true;
    }
  }

  private _forceSnapshot() {
    if (window.rrweb?.takeFullSnapshot) {
      window.rrweb.takeFullSnapshot();
    }
  }

  private async _uploadEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToUpload = [...this.events];
    this.events = [];
    this.lastFlushTime = Date.now();

    const lines = eventsToUpload.map(e =>
      JSON.stringify({
        projectKey: this.projectKey,
        sessionId: this.options.sessionId,
        timestamp: Math.floor(e.timestamp / 1000), // Convert to seconds
        event: e,
      })
    );

    const ndjson = lines.join('\n');

    try {
      const compressed = pako.gzip(ndjson);

      await fetch(this.options.uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-ndjson',
          'Content-Encoding': 'gzip',
        },
        body: compressed,
      });

      this.logger.debug(
        `Uploaded ${eventsToUpload.length} events (${compressed.length} bytes compressed)`
      );
    } catch (error) {
      this.options.onError?.(error as Error);
      this.events.unshift(...eventsToUpload); // Retry on failure
    }
  }
}
